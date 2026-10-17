import { getViewer } from '@/lib/data';
import { getPlan } from '@/lib/plans';
import { ButtonLink, PageHeader } from '@/components/ui';
import { NewBookForm } from './form';

export const metadata = { title: 'New book' };

export default async function NewBook() {
  const { supabase, profile } = await getViewer();
  const plan = getPlan(profile.plan);
  const { count } = await supabase.from('books').select('id', { count: 'exact', head: true });
  if (plan.bookLimit !== null && (count ?? 0) >= plan.bookLimit) {
    const next = plan.id === 'free' ? 'Pro for up to 10 books' : 'Agency for unlimited books';
    return (
      <div className="mx-auto max-w-[640px]">
        <PageHeader title="You’ve reached your book limit">
          Your {plan.name} plan includes {plan.bookLimit} book{plan.bookLimit === 1 ? '' : 's'}, and you have {count}. Upgrade to {next}, or delete a book you no longer need.
        </PageHeader>
        <div className="flex gap-2">
          <ButtonLink href="/dashboard/billing">See plans</ButtonLink>
          <ButtonLink href="/dashboard/books" variant="secondary">My books</ButtonLink>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader title="New book">Tell us about your book. You can change any of this later.</PageHeader>
      <NewBookForm />
    </div>
  );
}
