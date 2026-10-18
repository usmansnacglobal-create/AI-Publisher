import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { requireFeature } from '@/lib/tokens';
import { narrate, audioTokenCost } from '@/lib/ai/openai';
import { chunkText, estimateMinutes, VOICES, type VoiceId } from '@/lib/audiobook';
import { plain, toBlocks } from '@/lib/export/manuscript';
import { numberWords } from '@/lib/layout';
import { logActivity } from '@/lib/notify';

export const maxDuration = 300;
type Ctx = { params: { id: string } };
type Track = { path: string; chars: number; minutes: number; voice: string; generated_at: string };

/** Chapter text as it should be read aloud: no Markdown, chapter announced first. */
function spokenText(position: number, title: string, content: string) {
  const body = toBlocks(content)
    .map((b) =>
      b.type === 'break' || b.type === 'image' ? '' : b.type === 'heading' ? `${b.text}.` : b.type === 'list' ? b.items.map((it) => plain(it)).join('. ') : plain(b.runs),
    )
    .filter((x) => x.trim())
    .join('\n\n');
  return `Chapter ${numberWords(position)}. ${title}.\n\n${body}`;
}

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const [{ data: ab }, { data: chapters }] = await Promise.all([
    supabase.from('audiobooks').select('*').eq('book_id', book.id).maybeSingle(),
    supabase.from('chapters').select('id, position, title, content, updated_at').eq('book_id', book.id).order('position'),
  ]);
  const tracks = (ab?.tracks ?? {}) as Record<string, Track>;
  const paths = Object.values(tracks).map((t) => t.path);
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data } = await supabase.storage.from('audio').createSignedUrls(paths, 3600);
    data?.forEach((d) => d.path && d.signedUrl && (urls[d.path] = d.signedUrl));
  }
  return json({
    voice: ab?.voice ?? 'american_female',
    chapters: (chapters ?? []).map((c) => {
      const t = tracks[c.id];
      const chars = spokenText(c.position, c.title, c.content).length;
      return {
        id: c.id,
        position: c.position,
        title: c.title,
        empty: !c.content.trim(),
        chars,
        estMinutes: estimateMinutes(chars),
        estTokens: audioTokenCost(chars),
        track: t ? { ...t, url: urls[t.path] ?? null, outdated: new Date(c.updated_at) > new Date(t.generated_at) || t.voice !== (ab?.voice ?? '') } : null,
      };
    }),
  });
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const { voice } = z.object({ voice: z.enum(Object.keys(VOICES) as [VoiceId, ...VoiceId[]]) }).parse(await req.json());
  await supabase.from('audiobooks').upsert({ book_id: book.id, user_id: user.id, voice }, { onConflict: 'book_id' });
  return json({ ok: true });
});

/** { chapterId } narrates one chapter; { preview: true, voice } returns a short sample to listen to. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  await requireFeature(user.id, 'audiobook');
  const body = z
    .object({ chapterId: z.string().uuid().optional(), preview: z.boolean().optional(), voice: z.enum(Object.keys(VOICES) as [VoiceId, ...VoiceId[]]).optional() })
    .parse(await req.json());
  const { data: ab } = await supabase.from('audiobooks').select('*').eq('book_id', book.id).maybeSingle();
  const voiceId = (body.voice ?? ab?.voice ?? 'american_female') as VoiceId;
  const v = VOICES[voiceId];

  if (body.preview) {
    const { data: first } = await supabase.from('chapters').select('position, title, content').eq('book_id', book.id).gt('word_count', 0).order('position').limit(1).maybeSingle();
    const sample = first ? spokenText(first.position, first.title, first.content).slice(0, 500).replace(/\s+\S*$/, '.') : `This is how ${book.title} will sound.`;
    const audio = await narrate({ userId: user.id, bookId: book.id, chunks: [sample], voice: v.voice, instructions: v.instructions, feature: 'audiobook' });
    return new Response(new Uint8Array(audio), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
  }

  if (!body.chapterId) throw new HttpError(400, 'Choose a chapter.');
  const { data: ch } = await supabase.from('chapters').select('id, position, title, content').eq('id', body.chapterId).eq('book_id', book.id).single();
  if (!ch) throw new HttpError(404, 'Chapter not found.');
  if (!ch.content.trim()) throw new HttpError(400, 'This chapter has no text to narrate.');
  const text = spokenText(ch.position, ch.title, ch.content);
  const audio = await narrate({ userId: user.id, bookId: book.id, chunks: chunkText(text), voice: v.voice, instructions: v.instructions });
  const path = `${user.id}/${book.id}/chapter-${ch.id}.mp3`;
  const { error } = await supabase.storage.from('audio').upload(path, audio, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw error;
  const tracks = { ...((ab?.tracks ?? {}) as Record<string, Track>), [ch.id]: { path, chars: text.length, minutes: estimateMinutes(text.length), voice: voiceId, generated_at: new Date().toISOString() } };
  await supabase.from('audiobooks').upsert({ book_id: book.id, user_id: user.id, voice: voiceId, tracks }, { onConflict: 'book_id' });
  await logActivity(user.id, 'audiobook.chapter', { bookId: book.id, chapter: ch.position });
  return json({ ok: true });
});
