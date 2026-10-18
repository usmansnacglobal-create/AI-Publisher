import Link from 'next/link';
import { getViewer, listBooks, signedCoverUrls } from '@/lib/data';
import { getUsage } from '@/lib/tokens';
import { describeActivity, timeAgo } from '@/lib/activity';
import { compact, formatNumber } from '@/lib/text';
import { getPlan } from '@/lib/plans';
import { BookCard } from '@/components/book-card';
import { ButtonLink, Empty } from '@/components/ui';

export const metadata = { title: 'Home' };

export default async function Home() {
  const { supabase, user, profile } = await getViewer();
  const [books, usage, { data: activity }] = await Promise.all([
    listBooks(supabase, user.id),
    getUsage(user.id),
    supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(8),
  ]);
  const urls = await signedCoverUrls(supabase, books.map((b) => b.cover_path));
  const plan = getPlan(profile.plan);
  const totalWords = books.reduce((s, b) => s + b.progress.words, 0);
  const current = books.find((b) => b.status === 'draft');
  const first = (profile.full_name || profile.pen_name || '').split(' ')[0];

  return (
    <div className="mx-auto max-w-[1080px]">
      <h1>{first ? `Welcome back, ${first}` : 'Welcome back'}</h1>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
        {[
          ['Books', `${books.length}${plan.bookLimit ? ` of ${plan.bookLimit}` : ''}`],
          ['Published', String(books.filter((b) => b.status === 'published').length)],
          ['Words written', formatNumber(totalWords)],
          ['AI tokens left', `${compact(usage.tokensRemaining)} of ${compact(usage.tokenLimit)}`],
        ].map(([k, v]) => (
          <div key={k} className="bg-sheet px-4 py-3">
            <dt className="text-[13px] text-ink-muted">{k}</dt>
            <dd className="mt-0.5 font-serif text-[1.45rem]">{v}</dd>
          </div>
        ))}
      </dl>

      {current && (
        <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-md bg-[rgb(var(--c-banner))] px-5 py-4 text-[rgb(var(--c-on-banner))]">
          <div>
            <p className="text-[13px] opacity-75">Pick up where you left off</p>
            <p className="font-serif text-[1.3rem]">{current.title}</p>
          </div>
          <Link href={`/dashboard/books/${current.id}/write`} className="rounded bg-sheet px-4 py-2 text-[14px] font-medium text-cloth-dark hover:bg-sheet/90">
            Continue writing
          </Link>
        </section>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_300px]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2>Your books</h2>
            <ButtonLink href="/dashboard/books/new" size="sm">New book</ButtonLink>
          </div>
          {books.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {books.slice(0, 6).map((b) => (
                <BookCard key={b.id} book={b} coverUrl={b.cover_path ? urls[b.cover_path] : undefined} href={`/dashboard/books/${b.id}`} action="Open book" />
              ))}
            </div>
          ) : (
            <Empty title="Start your first book" action={<ButtonLink href="/dashboard/books/new">New book</ButtonLink>}>
              Describe your idea and AI Publisher plans the chapters with you. Or import a manuscript you’ve already written.
            </Empty>
          )}
          {books.length > 6 && (
            <Link href="/dashboard/books" className="mt-3 inline-block text-[14px] text-cloth underline">
              See all {books.length} books
            </Link>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2>Recent activity</h2>
            <Link href="/dashboard/activity" className="text-[13px] text-cloth underline">All activity</Link>
          </div>
          {activity?.length ? (
            <ol className="space-y-3 border-l border-line pl-4">
              {activity.map((a) => (
                <li key={a.id} className="text-[14px]">
                  <p>{describeActivity(a.action, a.details)}</p>
                  <p className="text-[12px] text-ink-muted">{timeAgo(a.created_at)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[14px] text-ink-muted">Things you do will show up here.</p>
          )}
        </section>
      </div>
    </div>
  );
}
