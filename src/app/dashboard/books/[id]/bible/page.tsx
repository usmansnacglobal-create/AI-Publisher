import { PlanGate } from '@/components/plan-gate';
import { getViewer } from '@/lib/data';
import { Bible } from './bible';

export const metadata = { title: 'Story bible' };

export default async function BiblePage({ params }: { params: { id: string } }) {
  const { supabase, profile } = await getViewer();
  const { data } = await supabase.from('bible_entries').select('*').eq('book_id', params.id).order('name');
  const { count } = await supabase.from('chapters').select('id', { count: 'exact', head: true }).eq('book_id', params.id).gt('word_count', 0);
  return (
    <PlanGate plan={profile.plan} feature="bible" what="Record every character, place and fact in your book. The AI follows them when it writes, and the continuity check flags contradictions between chapters.">
      <Bible bookId={params.id} entries={data ?? []} hasText={(count ?? 0) > 0} />
    </PlanGate>
  );
}
