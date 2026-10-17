import { getViewer } from '@/lib/data';
import type { Book } from '@/lib/api';
import { Editor } from './editor';

export const metadata = { title: 'Write' };

export default async function WritePage({ params, searchParams }: { params: { id: string }; searchParams: { chapter?: string } }) {
  const { supabase } = await getViewer();
  const [{ data: book }, { data: chapters }] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.id).single(),
    supabase.from('chapters').select('id,position,title,synopsis,word_count,status').eq('book_id', params.id).order('position'),
  ]);
  const list = chapters ?? [];
  const initial = list.find((c) => c.id === searchParams.chapter)?.id ?? list.find((c) => !c.word_count)?.id ?? list[0]?.id ?? null;
  return <Editor book={book as Book} chapters={list} initialId={initial} />;
}
