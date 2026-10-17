import { PlanGate } from '@/components/plan-gate';
import { getViewer } from '@/lib/data';
import type { Book } from '@/lib/api';
import { Publish } from './publish';

export const metadata = { title: 'Publish' };

export default async function PublishPage({ params }: { params: { id: string } }) {
  const { supabase, profile } = await getViewer();
  const { data: book } = await supabase.from('books').select('*').eq('id', params.id).single();
  return (
    <PlanGate plan={profile.plan} feature="publish" what="Get your store description, keywords and categories written for you, then submit your book and follow it through review to Amazon, Apple Books and other stores.">
      <Publish book={book as Book} />
    </PlanGate>
  );
}
