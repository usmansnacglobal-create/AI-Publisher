import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { bookProgress, type BookProgress } from './text';
import type { Book } from './api';

export async function getViewer() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return { supabase, user, profile: profile! };
}

export type BookWithProgress = Book & { progress: BookProgress; cover_path: string | null };

export async function listBooks(supabase: ReturnType<typeof createClient>): Promise<BookWithProgress[]> {
  const [{ data: books }, { data: chapters }, { data: covers }] = await Promise.all([
    supabase.from('books').select('*').order('updated_at', { ascending: false }),
    supabase.from('chapters').select('book_id, word_count, status'),
    supabase.from('covers').select('book_id, front_path, selected_path'),
  ]);
  return (books ?? []).map((b) => ({
    ...(b as Book),
    progress: bookProgress(b, (chapters ?? []).filter((c) => c.book_id === b.id)),
    cover_path: covers?.find((c) => c.book_id === b.id)?.front_path ?? covers?.find((c) => c.book_id === b.id)?.selected_path ?? null,
  }));
}

export async function signedCoverUrls(supabase: ReturnType<typeof createClient>, paths: (string | null)[]) {
  const list = paths.filter(Boolean) as string[];
  if (!list.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from('covers').createSignedUrls(list, 3600);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl]));
}
