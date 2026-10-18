import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { getViewer } from '@/lib/data';
import { PLATFORMS, type PlatformId } from '@/lib/publishing';
import { Badge, Empty, PageHeader } from '@/components/ui';

export const metadata = { title: 'Distribution Channels' };
export const dynamic = 'force-dynamic';

const FORMAT_LABEL: Record<string, string> = { ebook: 'Ebook', paperback: 'Paperback', hardcover: 'Hardcover', audiobook: 'Audiobook' };
const STEP: Record<string, string> = { submitted: 'Submitted', in_review: 'In review', changes_requested: 'Changes requested', formatting: 'Being prepared', publishing: 'Sent to store', rejected: 'Not approved', failed: 'Problem' };

export default async function DistributionPage() {
  const { supabase, user } = await getViewer();
  const [{ data: books }, { data: subs }] = await Promise.all([
    supabase.from('books').select('id,title').eq('user_id', user.id).order('updated_at', { ascending: false }),
    supabase.from('submissions').select('book_id,status,platforms,formats,store_links,created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
  ]);
  const latest = (id: string) => subs?.find((s) => s.book_id === id);
  const formats = ['ebook', 'paperback', 'hardcover', 'audiobook'];
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Distribution Channels">Where each of your books is sold, and its status in every store. Store links appear here as soon as a book goes live.</PageHeader>
      {!books?.length ? (
        <Empty title="No books yet">Start a book, then publish it from its Publish tab to see it here.</Empty>
      ) : (
        <div className="space-y-6">
          {books.map((b) => {
            const s = latest(b.id);
            const links = (s?.store_links ?? {}) as Record<string, string>;
            return (
              <section key={b.id} className="panel p-5" aria-labelledby={`d-${b.id}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 id={`d-${b.id}`} className="text-[1.15rem]"><Link href={`/dashboard/books/${b.id}/publish`} className="hover:underline">{b.title}</Link></h2>
                  {s ? <Badge tone={s.status === 'live' ? 'cloth' : ['rejected', 'failed', 'changes_requested'].includes(s.status) ? 'danger' : 'gilt'}>{s.status === 'live' ? 'Live' : STEP[s.status] ?? s.status}</Badge> : <Link href={`/dashboard/books/${b.id}/publish`} className="text-[14px] text-cloth underline">Not published yet: publish this book</Link>}
                </div>
                {s && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {formats.map((f) => {
                      const stores = (Object.keys(PLATFORMS) as PlatformId[]).filter((p) => (PLATFORMS[p].formats as readonly string[]).includes(f));
                      const chosenFormat = (s.formats ?? []).includes(f);
                      return (
                        <div key={f}>
                          <h3 className="mb-1.5 font-sans text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{FORMAT_LABEL[f]}{!chosenFormat && ' (not selected)'}</h3>
                          <ul className="divide-y divide-line rounded-md border border-line text-[14px]">
                            {stores.map((p) => {
                              const chosen = chosenFormat && (s.platforms ?? []).includes(p);
                              const link = links[p];
                              return (
                                <li key={p} className="flex items-center justify-between gap-2 px-3 py-2">
                                  <span className={chosen ? 'text-ink' : 'text-ink-muted'}>{PLATFORMS[p].label}</span>
                                  {!chosen ? (
                                    <span className="text-[12px] text-ink-muted">Not selected</span>
                                  ) : link ? (
                                    <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] font-medium text-cloth underline">View in store<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
                                  ) : s.status === 'live' ? (
                                    <Badge tone="cloth">Live</Badge>
                                  ) : (
                                    <Badge tone={['rejected', 'failed'].includes(s.status) ? 'danger' : 'gilt'}>{STEP[s.status] ?? s.status}</Badge>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
