import { getViewer } from '@/lib/data';
import { PlanGate } from '@/components/plan-gate';
import { Audiobook } from './audiobook';

export const metadata = { title: 'Audiobook' };

export default async function AudiobookPage({ params }: { params: { id: string } }) {
  const { profile } = await getViewer();
  return (
    <PlanGate plan={profile.plan} feature="audiobook" what="Turn your book into an audiobook narrated by a natural AI voice, chapter by chapter, ready to submit with your book.">
      <Audiobook bookId={params.id} />
    </PlanGate>
  );
}
