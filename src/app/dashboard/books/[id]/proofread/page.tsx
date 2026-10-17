import { PlanGate } from '@/components/plan-gate';
import { getViewer } from '@/lib/data';
import { Checks } from './checks';

export const metadata = { title: 'Proofread' };

export default async function ProofreadPage({ params }: { params: { id: string } }) {
  const { supabase, profile } = await getViewer();
  const [{ data: chapters }, { data: reports }] = await Promise.all([
    supabase.from('chapters').select('id,position,title,word_count').eq('book_id', params.id).order('position'),
    supabase.from('reports').select('chapter_id,kind,result,created_at').eq('book_id', params.id),
  ]);
  return (
    <PlanGate plan={profile.plan} feature="proofread" what="A full-book check for spelling, grammar, punctuation and consistency, with one-click fixes, plus a continuity check across chapters.">
      <Checks bookId={params.id} chapters={chapters ?? []} reports={reports ?? []} defaultDialect={profile.language === 'en-GB' ? 'UK' : 'US'} />
    </PlanGate>
  );
}
