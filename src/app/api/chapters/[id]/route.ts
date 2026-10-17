import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { loadChapter, snapshot } from '@/lib/chapters';
import { countWords } from '@/lib/text';

type Ctx = { params: { id: string } };
const SNAPSHOT_EVERY_MS = 15 * 60 * 1000;

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  const chapter = await loadChapter(supabase, params.id);
  const { data: suggestions } = await supabase
    .from('suggestions').select('*').eq('chapter_id', chapter.id).eq('status', 'pending').order('created_at');
  return json({ chapter, suggestions: suggestions ?? [] });
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  const chapter = await loadChapter(supabase, params.id);
  const body = z
    .object({
      title: z.string().max(200),
      synopsis: z.string().max(2000),
      content: z.string().max(400_000),
      baseUpdatedAt: z.string(),
    })
    .partial()
    .parse(await req.json());

  // Protect against two open tabs overwriting each other.
  if (body.content !== undefined && body.baseUpdatedAt && new Date(body.baseUpdatedAt) < new Date(chapter.updated_at)) {
    const drift = new Date(chapter.updated_at).getTime() - new Date(body.baseUpdatedAt).getTime();
    if (drift > 2000) throw new HttpError(409, 'This chapter was changed somewhere else (another tab or an AI edit). Reload to see the latest text.', 'CONFLICT');
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.synopsis !== undefined) updates.synopsis = body.synopsis;
  if (body.content !== undefined) {
    updates.content = body.content;
    updates.word_count = countWords(body.content);
    updates.status = body.content.trim() ? 'drafted' : 'planned';
    const { data: lastV } = await supabase
      .from('chapter_versions').select('created_at').eq('chapter_id', chapter.id).order('created_at', { ascending: false }).limit(1);
    const lastAt = lastV?.[0] ? new Date(lastV[0].created_at).getTime() : 0;
    if (Date.now() - lastAt > SNAPSHOT_EVERY_MS) await snapshot(supabase, chapter, 'Autosave');
  }
  const { data, error } = await supabase.from('chapters').update(updates).eq('id', chapter.id).select('updated_at, word_count').single();
  if (error) throw error;
  return json({ ok: true, updated_at: data.updated_at, word_count: data.word_count });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  const chapter = await loadChapter(supabase, params.id);
  await supabase.from('chapters').delete().eq('id', chapter.id);
  const { data: rest } = await supabase.from('chapters').select('id').eq('book_id', chapter.book_id).order('position');
  for (const [i, c] of (rest ?? []).entries()) await supabase.from('chapters').update({ position: i + 1 }).eq('id', c.id);
  return json({ ok: true });
});
