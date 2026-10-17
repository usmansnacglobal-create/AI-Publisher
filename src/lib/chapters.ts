import 'server-only';
import { HttpError, type Chapter } from './api';
import type { createClient } from './supabase/server';

type SB = ReturnType<typeof createClient>;

export async function loadChapter(supabase: SB, id: string) {
  const { data } = await supabase.from('chapters').select('*').eq('id', id).single();
  if (!data) throw new HttpError(404, 'Chapter not found.');
  return data as Chapter;
}

/** Saves a version of the chapter's current text (used before any AI change). */
export async function snapshot(
  supabase: SB,
  chapter: Chapter,
  label: string,
) {
  if (!chapter.content.trim()) return;
  await supabase.from('chapter_versions').insert({
    chapter_id: chapter.id,
    user_id: chapter.user_id,
    content: chapter.content,
    word_count: chapter.word_count,
    label,
  });
}


export async function loadContext(supabase: SB, chapter: Chapter) {
  const [{ data: book }, { data: chapters }, { data: bible }] = await Promise.all([
    supabase.from('books').select('*').eq('id', chapter.book_id).single(),
    supabase.from('chapters').select('*').eq('book_id', chapter.book_id).order('position'),
    supabase.from('bible_entries').select('kind,name,details').eq('book_id', chapter.book_id),
  ]);
  if (!book) throw new HttpError(404, 'Book not found.');
  return { book: book as import('./api').Book, chapters: (chapters ?? []) as Chapter[], bible: bible ?? [] };
}
