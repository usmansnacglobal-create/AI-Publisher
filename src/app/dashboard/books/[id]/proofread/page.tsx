import { PlanGate } from '@/components/plan-gate';
import { getViewer } from '@/lib/data';
import { Checks } from './checks';

export const metadata = { title: 'Proofread' };

export default async function ProofreadPage({ params }: { params: { id: string } }) {
  const { supabase, profile } = await getViewer();
  const [{ data: chapters }, { data: reports }, { data: book }] = await Promise.all([
    supabase.from('chapters').select('id,position,title,word_count').eq('book_id', params.id).order('position'),
    supabase.from('reports').select('chapter_id,kind,result,created_at').eq('book_id', params.id),
    supabase.from('books').select('dialect').eq('id', params.id).single(),
  ]);
  const uk = book?.dialect ? book.dialect !== 'US English' && book.dialect !== 'Canadian English' : profile.language === 'en-GB';
  return (
    <PlanGate plan={profile.plan} feature="proofread" what="A full-book check for spelling, grammar, punctuation and consistency, with one-click fixes, plus a continuity check across chapters.">
      <Checks bookId={params.id} chapters={chapters ?? []} reports={reports ?? []} defaultDialect={uk ? 'UK' : 'US'} />
    </PlanGate>
  );
}
