import { getViewer } from '@/lib/data';
import { PlanGate } from '@/components/plan-gate';
import { CoverStudio } from './studio';

export const metadata = { title: 'Cover' };

export default async function CoverPage({ params }: { params: { id: string } }) {
  const { profile } = await getViewer();
  return (
    <PlanGate plan={profile.plan} feature="cover" what="Describe your cover and get artwork painted by ChatGPT, lettered with real fonts, with a print-ready paperback wrap sized to your exact page count.">
      <CoverStudio bookId={params.id} />
    </PlanGate>
  );
}
