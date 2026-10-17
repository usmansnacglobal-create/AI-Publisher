import { getViewer } from '@/lib/data';
import { bookProgress } from '@/lib/text';
import type { Book, Chapter } from '@/lib/api';
import { Overview } from './overview';

export default async function BookPage({ params, searchParams }: { params: { id: string }; searchParams: { autowrite?: string } }) {
  const { supabase } = await getViewer();
  const [{ data: book }, { data: chapters }] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.id).single(),
    supabase.from('chapters').select('id,position,title,synopsis,word_count,status,updated_at').eq('book_id', params.id).order('position'),
  ]);
  const list = (chapters ?? []) as Chapter[];
  return <Overview book={book as Book} chapters={list} progress={bookProgress(book!, list)} autowrite={searchParams.autowrite === '1'} />;
}
