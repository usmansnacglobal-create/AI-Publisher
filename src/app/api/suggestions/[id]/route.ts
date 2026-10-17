import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { applyReplacement } from '@/lib/apply';
import { countWords } from '@/lib/text';

/** Accept (applies the change to the chapter) or reject a suggestion. */
export const PATCH = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase } = await requireUser();
  const { status } = z.object({ status: z.enum(['accepted', 'rejected']) }).parse(await req.json());
  const { data: s } = await supabase.from('suggestions').select('*').eq('id', params.id).single();
  if (!s) throw new HttpError(404, 'Suggestion not found.');
  if (s.status !== 'pending') return json({ ok: true });

  if (status === 'accepted') {
    const { data: chapter } = await supabase.from('chapters').select('*').eq('id', s.chapter_id).single();
    if (!chapter) throw new HttpError(404, 'Chapter not found.');
    const next = applyReplacement(chapter.content, s.original, s.replacement);
    if (next === null) {
      await supabase.from('suggestions').update({ status: 'rejected' }).eq('id', s.id);
      throw new HttpError(409, "That text has changed since the suggestion was made, so it can't be applied. It's been dismissed.", 'STALE');
    }
    const { data: updated, error } = await supabase
      .from('chapters')
      .update({ content: next, word_count: countWords(next), status: 'drafted' })
      .eq('id', chapter.id)
      .select('content, updated_at, word_count')
      .single();
    if (error) throw error;
    await supabase.from('suggestions').update({ status }).eq('id', s.id);
    return json({ ok: true, chapter: updated });
  }
  await supabase.from('suggestions').update({ status }).eq('id', s.id);
  return json({ ok: true });
});
