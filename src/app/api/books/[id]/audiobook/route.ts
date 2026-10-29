import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { requireFeature } from '@/lib/tokens';
import { narrate, audioTokenCost } from '@/lib/ai/openai';
import { chunkText, estimateMinutes, isTrackOutdated, VOICES, type VoiceId } from '@/lib/audiobook';
import { plain, toBlocks } from '@/lib/export/manuscript';
import { numberWords } from '@/lib/layout';
import { logActivity } from '@/lib/notify';
import { createAdminClient } from '@/lib/supabase/admin';
import { planAllows } from '@/lib/plans';
import { NARRATION_MODELS, chunkLimitFor, costUsd, elevenLabsReady, friendlyElevenLabsError, synthesize } from '@/lib/elevenlabs';
import { alertAdminsAboutNarration, getNarrationStatus, reserveCredits, settleCredits } from '@/lib/narration';
import { getVoice, narrationVoiceId } from '@/lib/voice-library';
import { creditsFor, isQuality, type Quality } from '@/lib/pricing';

export const maxDuration = 300;
type Ctx = { params: { id: string } };

/** A narrated chapter. Older tracks (before premium voices) have only path, chars, minutes, voice and generated_at. */
type Track = {
  path: string; chars: number; minutes: number; voice: string; generated_at: string;
  engine?: 'basic' | 'premium'; voice_name?: string; quality?: Quality; credits?: number;
};
type Settings = { engine: 'basic' | 'premium'; voice: VoiceId; premium_voice_id: string | null; premium_voice_name: string | null; quality: Quality };

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

/** A book with no narrator saved yet uses premium voices if the author has narration credits (or no basic voices). */
async function defaultEngine(userId: string, plan: string | null | undefined): Promise<Settings['engine']> {
  if (!planAllows(plan, 'audiobook')) return 'premium';
  return (await getNarrationStatus(userId)).canNarrate ? 'premium' : 'basic';
}

function settingsOf(ab: Record<string, unknown> | null, fallback: Settings['engine'] = 'basic'): Settings {
  return {
    engine: ab?.engine === 'premium' || ab?.engine === 'basic' ? ab.engine : fallback,
    voice: ((ab?.voice as string) in VOICES ? ab?.voice : 'american_female') as VoiceId,
    premium_voice_id: (ab?.premium_voice_id as string) ?? null,
    premium_voice_name: (ab?.premium_voice_name as string) ?? null,
    quality: isQuality(ab?.quality) ? ab.quality : 'turbo',
  };
}

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const [{ data: ab }, { data: chapters }, { data: profile }, narration] = await Promise.all([
    supabase.from('audiobooks').select('*').eq('book_id', book.id).maybeSingle(),
    supabase.from('chapters').select('id, position, title, content, updated_at').eq('book_id', book.id).order('position'),
    supabase.from('profiles').select('plan').eq('id', user.id).single(),
    getNarrationStatus(user.id),
  ]);
  const s = settingsOf(ab, !planAllows(profile?.plan, 'audiobook') || narration.canNarrate ? 'premium' : 'basic');
  const tracks = (ab?.tracks ?? {}) as Record<string, Track>;
  const paths = Object.values(tracks).map((t) => t.path);
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data } = await supabase.storage.from('audio').createSignedUrls(paths, 3600);
    data?.forEach((d) => d.path && d.signedUrl && (urls[d.path] = d.signedUrl));
  }
  const { warned80: _a, warned100: _b, ...status } = narration;
  const pv = s.premium_voice_id ? await getVoice(s.premium_voice_id) : null;
  return json({
    ...s,
    premiumVoice: pv
      ? { voice_id: pv.voice_id, name: pv.name, description: pv.description, use_case: pv.use_case, gender: pv.gender, age: pv.age, accent: pv.accent, language: pv.language, descriptive: pv.descriptive, featured: pv.featured, has_preview: !!pv.preview_url, active: pv.active }
      : null,
    basicAllowed: planAllows(profile?.plan, 'audiobook'),
    premiumReady: elevenLabsReady(),
    narration: status,
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
        estCredits: { turbo: creditsFor(chars, 'turbo'), standard: creditsFor(chars, 'standard') },
        track: t
          ? {
              ...t,
              engine: t.engine ?? 'basic',
              label: (t.engine ?? 'basic') === 'premium' ? `${t.voice_name ?? 'Premium voice'} · ${t.quality === 'standard' ? 'Standard' : 'Turbo'}` : VOICES[t.voice as VoiceId]?.label ?? t.voice,
              url: urls[t.path] ?? null,
              outdated: isTrackOutdated(t, c.updated_at, s),
            }
          : null,
      };
    }),
  });
});

const Put = z.object({
  engine: z.enum(['basic', 'premium']).optional(),
  voice: z.enum(Object.keys(VOICES) as [VoiceId, ...VoiceId[]]).optional(),
  premiumVoiceId: z.string().min(5).max(64).optional(),
  quality: z.enum(['turbo', 'standard']).optional(),
});

/** Saves the book's narrator: basic or premium, which voice, and (premium) which quality. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const b = Put.parse(await req.json());
  const update: Record<string, unknown> = { book_id: book.id, user_id: user.id };
  if (b.engine) update.engine = b.engine;
  else {
    // First save for this book: keep the narrator kind the author is already looking at.
    const { data: existing } = await supabase.from('audiobooks').select('id').eq('book_id', book.id).maybeSingle();
    if (!existing) {
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
      update.engine = await defaultEngine(user.id, profile?.plan);
    }
  }
  if (b.voice) update.voice = b.voice;
  if (b.premiumVoiceId) {
    const v = await getVoice(b.premiumVoiceId);
    if (!v) throw new HttpError(400, 'That voice isn’t in the library any more. Choose another.', 'VOICE_UNAVAILABLE');
    update.premium_voice_id = v.voice_id;
    update.premium_voice_name = v.name;
  }
  if (b.quality) {
    const s = await getNarrationStatus(user.id);
    if (!s.qualities.includes(b.quality)) throw new HttpError(403, 'Standard quality is part of Narration Pro.', 'QUALITY_LOCKED');
    update.quality = b.quality;
  }
  const { error } = await supabase.from('audiobooks').upsert(update, { onConflict: 'book_id' });
  if (error) throw error;
  return json({ ok: true });
});

/** { chapterId } narrates one chapter; { preview: true, voice } returns a short sample of a basic voice. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const body = z
    .object({ chapterId: z.string().uuid().optional(), preview: z.boolean().optional(), voice: z.enum(Object.keys(VOICES) as [VoiceId, ...VoiceId[]]).optional() })
    .parse(await req.json());
  const { data: ab } = await supabase.from('audiobooks').select('*').eq('book_id', book.id).maybeSingle();
  let fallback: Settings['engine'] = 'basic';
  if (!ab) {
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
    fallback = await defaultEngine(user.id, profile?.plan);
  }
  const s = settingsOf(ab, fallback);

  if (body.preview) {
    await requireFeature(user.id, 'audiobook');
    const v = VOICES[body.voice ?? s.voice];
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
  const path = `${user.id}/${book.id}/chapter-${ch.id}.mp3`;
  let track: Track;

  if (s.engine === 'premium') {
    if (!elevenLabsReady()) throw new HttpError(503, 'Premium narration isn’t set up yet.', 'AI_NOT_CONFIGURED');
    if (!s.premium_voice_id) throw new HttpError(400, 'Choose a narrator from the voice library first.', 'VOICE_REQUIRED');
    const model = NARRATION_MODELS[s.quality];
    const credits = creditsFor(text.length, s.quality);
    const reservation = await reserveCredits({
      userId: user.id, credits, quality: s.quality, model, chars: text.length, costUsd: costUsd(text.length, s.quality), bookId: book.id, chapterId: ch.id,
    });
    try {
      const voiceId = await narrationVoiceId(s.premium_voice_id);
      const audio = await synthesize({ voiceId, quality: s.quality, chunks: chunkText(text, chunkLimitFor(model)) });
      const { error } = await supabase.storage.from('audio').upload(path, audio, { contentType: 'audio/mpeg', upsert: true });
      if (error) throw error;
    } catch (e) {
      await settleCredits(reservation, false, user.id);
      const friendly = friendlyElevenLabsError(e);
      if (friendly.code === 'NARRATION_PROVIDER') await alertAdminsAboutNarration(e instanceof Error ? e.message : String(e)).catch(console.error);
      throw friendly;
    }
    await settleCredits(reservation, true, user.id);
    track = {
      path, chars: text.length, minutes: estimateMinutes(text.length), voice: s.premium_voice_id, voice_name: s.premium_voice_name ?? undefined,
      engine: 'premium', quality: s.quality, credits, generated_at: new Date().toISOString(),
    };
  } else {
    await requireFeature(user.id, 'audiobook');
    const v = VOICES[s.voice];
    const audio = await narrate({ userId: user.id, bookId: book.id, chunks: chunkText(text), voice: v.voice, instructions: v.instructions });
    const { error } = await supabase.storage.from('audio').upload(path, audio, { contentType: 'audio/mpeg', upsert: true });
    if (error) throw error;
    track = { path, chars: text.length, minutes: estimateMinutes(text.length), voice: s.voice, engine: 'basic', generated_at: new Date().toISOString() };
  }

  // Re-read the tracks so chapters narrated at the same time don't overwrite each other.
  const admin = createAdminClient();
  const { data: latest } = await admin.from('audiobooks').select('tracks').eq('book_id', book.id).maybeSingle();
  const tracks = { ...((latest?.tracks ?? {}) as Record<string, Track>), [ch.id]: track };
  await supabase.from('audiobooks').upsert({ book_id: book.id, user_id: user.id, tracks }, { onConflict: 'book_id' });
  await logActivity(user.id, 'audiobook.chapter', { bookId: book.id, chapter: ch.position, engine: track.engine, quality: track.quality });
  return json({ ok: true });
});
