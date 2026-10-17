import { planAllows } from '@/lib/plans';
import { getViewer } from '@/lib/data';
import type { Book } from '@/lib/api';
import { Format } from './format';

export const metadata = { title: 'Format' };

export default async function FormatPage({ params }: { params: { id: string } }) {
  const { supabase, profile } = await getViewer();
  const [{ data: book }, { data: chapters }] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.id).single(),
    supabase.from('chapters').select('word_count').eq('book_id', params.id),
  ]);
  const words = (chapters ?? []).reduce((s, c) => s + c.word_count, 0);
  return <Format book={book as Book} words={words} chapterCount={chapters?.length ?? 0} canPrint={planAllows(profile.plan, 'print')} />;
}
