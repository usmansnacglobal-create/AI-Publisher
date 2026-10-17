import { getViewer, listBooks, signedCoverUrls } from '@/lib/data';
import { getPlan } from '@/lib/plans';
import { BookCard } from './book-card';
import { ButtonLink, Empty, PageHeader } from './ui';

export async function BookList({ title, intro, link, action }: { title: string; intro: string; link: (id: string) => string; action: string }) {
  const { supabase, profile } = await getViewer();
  const books = await listBooks(supabase);
  const urls = await signedCoverUrls(supabase, books.map((b) => b.cover_path));
  const plan = getPlan(profile.plan);
  const atLimit = plan.bookLimit !== null && books.length >= plan.bookLimit;
  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader
        title={title}
        actions={<ButtonLink href="/dashboard/books/new">New book</ButtonLink>}
      >
        {intro}
        {plan.bookLimit !== null && ` You're using ${books.length} of ${plan.bookLimit} books on the ${plan.name} plan.`}
      </PageHeader>
      {atLimit && (
        <p className="mb-4 rounded-md border border-gilt/40 bg-gilt-light px-4 py-3 text-[14px]">
          You’ve reached the {plan.bookLimit}-book limit of the {plan.name} plan.{' '}
          <a href="/dashboard/billing" className="font-medium underline">See plans</a>
        </p>
      )}
      {books.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {books.map((b) => (
            <BookCard key={b.id} book={b} coverUrl={b.cover_path ? urls[b.cover_path] : undefined} href={link(b.id)} action={action} />
          ))}
        </div>
      ) : (
        <Empty title="No books yet" action={<ButtonLink href="/dashboard/books/new">New book</ButtonLink>}>
          Start from an idea, or import a manuscript you’ve already written.
        </Empty>
      )}
    </div>
  );
}
