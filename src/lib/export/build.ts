import 'server-only';
import type { Book } from '../api';
import type { createClient } from '../supabase/server';
import { toBlocks, type Manuscript } from './manuscript';

export async function buildManuscript(supabase: ReturnType<typeof createClient>, book: Book): Promise<Manuscript> {
  const [{ data: chapters }, { data: profile }, { data: sub }] = await Promise.all([
    supabase.from('chapters').select('position,title,content').eq('book_id', book.id).order('position'),
    supabase.from('profiles').select('full_name,pen_name,language').eq('id', book.user_id).single(),
    supabase.from('submissions').select('isbn').eq('book_id', book.id).not('isbn', 'is', null).order('created_at', { ascending: false }).limit(1),
  ]);
  const author = profile?.pen_name || profile?.full_name || 'Author';
  return {
    title: book.title,
    subtitle: book.subtitle,
    author,
    copyrightHolder: book.copyright_holder || author,
    dedication: book.dedication,
    year: new Date().getFullYear(),
    isbn: sub?.[0]?.isbn ?? null,
    blurb: book.blurb,
    authorBio: book.author_bio,
    language: profile?.language || 'en',
    chapters: (chapters ?? [])
      .filter((c) => c.content.trim())
      .map((c, i) => ({ number: i + 1, title: c.title || `Chapter ${i + 1}`, blocks: toBlocks(c.content) })),
  };
}
