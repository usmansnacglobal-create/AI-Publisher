import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { loadChapter, snapshot } from '@/lib/chapters';
import { countWords } from '@/lib/text';

/**
 * Splits a chapter in two at a paragraph. Paragraph `at` (0-based) becomes the
 * first paragraph of a new chapter placed straight after this one.
 */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const { at, title } = z.object({ at: z.number().int().min(1), title: z.string().trim().max(200).default('') }).parse(await req.json());
  const chapter = await loadChapter(supabase, params.id);
  const paras = chapter.content.split(/\n\s*\n/);
  if (at >= paras.length) throw new HttpError(400, 'Choose a paragraph inside the chapter.');
  await snapshot(supabase, chapter, 'Before split');
  const first = paras.slice(0, at).join('\n\n').trim();
  const second = paras.slice(at).join('\n\n').trim();

  // Make room for the new chapter.
  const { data: after } = await supabase
    .from('chapters').select('id, position').eq('book_id', chapter.book_id).gt('position', chapter.position).order('position', { ascending: false });
  for (const c of after ?? []) await supabase.from('chapters').update({ position: c.position + 1 }).eq('id', c.id);

  await supabase.from('chapters').update({ content: first, word_count: countWords(first) }).eq('id', chapter.id);
  const { data: created, error } = await supabase
    .from('chapters')
    .insert({
      book_id: chapter.book_id,
      user_id: user.id,
      position: chapter.position + 1,
      title: title || `${chapter.title} (continued)`,
      content: second,
      word_count: countWords(second),
      status: 'drafted',
      settings: chapter.settings ?? {},
    })
    .select('id')
    .single();
  if (error) throw error;
  const { data: book } = await supabase.from('books').select('target_chapters').eq('id', chapter.book_id).single();
  const { count } = await supabase.from('chapters').select('id', { count: 'exact', head: true }).eq('book_id', chapter.book_id);
  if (book && (count ?? 0) > book.target_chapters) await supabase.from('books').update({ target_chapters: count }).eq('id', chapter.book_id);
  return json({ id: created.id });
});
