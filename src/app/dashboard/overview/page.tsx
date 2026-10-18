import Link from 'next/link';
import { getViewer, listBooks } from '@/lib/data';
import { getUsage } from '@/lib/tokens';
import { compact, formatNumber } from '@/lib/text';
import { describeActivity, timeAgo } from '@/lib/activity';
import { Badge, PageHeader, Progress } from '@/components/ui';
import { ColumnChart, StatTile } from '@/components/column-chart';

export const metadata = { title: 'Dashboard Overview' };
export const dynamic = 'force-dynamic';

const SUB_LABEL: Record<string, [string, 'neutral' | 'cloth' | 'gilt' | 'danger']> = {
  submitted: ['Submitted', 'gilt'], in_review: ['In review', 'gilt'], changes_requested: ['Changes requested', 'danger'], formatting: ['Formatting', 'gilt'],
  publishing: ['Publishing', 'gilt'], live: ['Live', 'cloth'], rejected: ['Not approved', 'danger'], failed: ['Problem at the stores', 'danger'],
};

export default async function OverviewPage() {
  const { supabase, user } = await getViewer();
  const books = await listBooks(supabase, user.id);
  const ids = books.map((b) => b.id);
  const since30 = new Date(Date.now() - 29 * 86400_000);
  const [usage, { data: covers }, { data: audio }, { data: chapters }, { data: subs }, { data: tokens }, { data: sales }, { data: orders }, { data: activity }] = await Promise.all([
    getUsage(user.id),
    ids.length ? supabase.from('covers').select('book_id,front_path,wrap_path').in('book_id', ids) : Promise.resolve({ data: [] as { book_id: string; front_path: string | null; wrap_path: string | null }[] }),
    ids.length ? supabase.from('audiobooks').select('book_id,tracks').in('book_id', ids) : Promise.resolve({ data: [] as { book_id: string; tracks: Record<string, unknown> }[] }),
    ids.length ? supabase.from('chapters').select('book_id,word_count').in('book_id', ids) : Promise.resolve({ data: [] as { book_id: string; word_count: number }[] }),
    supabase.from('submissions').select('book_id,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('token_usage').select('total_tokens, created_at').eq('user_id', user.id).gte('created_at', since30.toISOString().slice(0, 10)),
    supabase.from('sales').select('royalty,units,period').eq('user_id', user.id),
    supabase.from('print_orders').select('status').eq('user_id', user.id),
    supabase.from('activity_logs').select('*').not('action', 'like', 'help.%').order('created_at', { ascending: false }).limit(8),
  ]);

  const latestSub = (id: string) => subs?.find((s) => s.book_id === id);
  const words = books.reduce((s, b) => s + b.progress.words, 0);
  const live = books.filter((b) => latestSub(b.id)?.status === 'live').length;
  const royalties = (sales ?? []).reduce((s, r) => s + Number(r.royalty), 0);
  const units = (sales ?? []).reduce((s, r) => s + r.units, 0);
  const openOrders = (orders ?? []).filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;

  const days: { label: string; value: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    days.push({ label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), value: 0 });
  }
  for (const t of tokens ?? []) {
    const idx = 29 - Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400_000);
    if (idx >= 0 && idx < 30) days[idx].value += t.total_tokens;
  }

  const stage = (id: string) => {
    const b = books.find((x) => x.id === id)!;
    const c = covers?.find((x) => x.book_id === id);
    const a = audio?.find((x) => x.book_id === id);
    const written = (chapters ?? []).filter((x) => x.book_id === id && x.word_count > 0).length;
    const tracks = Object.keys((a?.tracks ?? {}) as Record<string, unknown>).length;
    const approved = !!b.layout_approved_at && new Date(b.content_updated_at) <= new Date(b.layout_approved_at);
    return {
      layout: approved ? (['Approved', 'cloth'] as const) : b.layout_approved_at ? (['Outdated', 'danger'] as const) : (['Draft', 'neutral'] as const),
      cover: c?.wrap_path ? (['Print-ready', 'cloth'] as const) : c?.front_path ? (['Ebook ready', 'gilt'] as const) : (['Not started', 'neutral'] as const),
      audio: tracks ? `${tracks} of ${written || b.progress.chaptersTotal}` : '—',
      next:
        b.progress.chaptersDone < b.progress.chaptersTotal || !b.progress.chaptersTotal ? ['Keep writing', `/dashboard/books/${id}/write`]
        : !approved ? ['Approve layout', `/dashboard/books/${id}/format`]
        : !c?.front_path ? ['Design cover', `/dashboard/books/${id}/cover`]
        : !latestSub(id) ? ['Publish', `/dashboard/books/${id}/publish`]
        : ['View publishing', `/dashboard/books/${id}/publish`],
    };
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader title="Dashboard Overview">Everything across your books, AI tokens, sales and activity in one place.</PageHeader>

      <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Books" value={String(books.length)} note={`${live} live in stores`} />
        <StatTile label="Words written" value={compact(words)} note={`${books.reduce((s, b) => s + b.progress.chaptersDone, 0)} chapters written`} />
        <StatTile label="AI tokens left" value={compact(Math.max(0, usage.tokenLimit - usage.tokensUsed))} note={`of ${compact(usage.tokenLimit)} this month`} />
        <StatTile label="Copies sold" value={formatNumber(units)} note="all stores, all time" />
        <StatTile label="Royalties" value={`$${royalties.toFixed(2)}`} note="reported so far" />
        <StatTile label="Print orders" value={String((orders ?? []).length)} note={openOrders ? `${openOrders} in progress` : 'none in progress'} />
      </div>

      <div className="mb-10 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section className="panel p-5" aria-labelledby="ai-30">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="ai-30" className="text-[1.1rem]">AI tokens used, last 30 days</h2>
            <Link href="/dashboard/usage" className="text-[13px] text-cloth underline">Details</Link>
          </div>
          <ColumnChart data={days} format={(n) => compact(n)} label="AI tokens used per day, last 30 days" />
          <div className="mt-4"><Progress value={usage.usagePercent} tone={usage.usagePercent >= 100 ? 'danger' : usage.usagePercent >= 80 ? 'gilt' : 'cloth'} label="Monthly allowance used" /></div>
          <p className="mt-1 text-[12px] text-ink-muted">{Math.round(usage.usagePercent)}% of this month’s allowance used · resets {new Date(usage.periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</p>
        </section>
        <section className="panel p-5" aria-labelledby="recent">
          <h2 id="recent" className="mb-3 text-[1.1rem]">Recent activity</h2>
          {activity?.length ? (
            <ul className="space-y-2.5 text-[14px]">
              {activity.map((a) => (
                <li key={a.id}><span className="block text-ink">{describeActivity(a.action, a.details ?? {})}</span><span className="text-[12px] text-ink-muted">{timeAgo(a.created_at)}</span></li>
              ))}
            </ul>
          ) : <p className="text-[14px] text-ink-muted">Nothing yet.</p>}
          <Link href="/dashboard/activity" className="mt-3 inline-block text-[13px] text-cloth underline">All activity</Link>
        </section>
      </div>

      <section aria-labelledby="books">
        <h2 id="books" className="mb-3 text-[1.1rem]">Your books at a glance</h2>
        {books.length ? (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[820px] text-[14px]">
              <thead>
                <tr className="border-b border-line text-left text-[13px] text-ink-muted">
                  <th className="px-4 py-2 font-medium">Book</th><th className="px-3 py-2 font-medium">Writing</th><th className="px-3 py-2 font-medium">Layout</th>
                  <th className="px-3 py-2 font-medium">Cover</th><th className="px-3 py-2 font-medium">Audiobook</th><th className="px-3 py-2 font-medium">Publishing</th><th className="px-4 py-2 font-medium">Next step</th>
                </tr>
              </thead>
              <tbody>
                {books.map((b) => {
                  const s = stage(b.id);
                  const sub = latestSub(b.id);
                  const [subLabel, subTone]: [string, 'neutral' | 'cloth' | 'gilt' | 'danger'] = sub ? SUB_LABEL[sub.status] ?? [sub.status, 'neutral'] : ['Not submitted', 'neutral'];
                  return (
                    <tr key={b.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3"><Link href={`/dashboard/books/${b.id}`} className="font-medium text-ink hover:underline">{b.title}</Link><span className="block text-[12px] text-ink-muted">{b.genre}</span></td>
                      <td className="w-40 px-3 py-3">
                        <Progress value={b.progress.wordPercent} label={`${b.title} words`} />
                        <span className="text-[12px] text-ink-muted">{formatNumber(b.progress.words)} words · {b.progress.chaptersDone}/{b.progress.chaptersTotal} chapters</span>
                      </td>
                      <td className="px-3 py-3"><Badge tone={s.layout[1]}>{s.layout[0]}</Badge></td>
                      <td className="px-3 py-3"><Badge tone={s.cover[1]}>{s.cover[0]}</Badge></td>
                      <td className="px-3 py-3 text-ink-soft">{s.audio}</td>
                      <td className="px-3 py-3"><Badge tone={subTone}>{subLabel}</Badge></td>
                      <td className="px-4 py-3"><Link href={s.next[1]} className="text-cloth underline">{s.next[0]}</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="panel p-4 text-ink-muted">No books yet. <Link href="/dashboard/books/new" className="text-cloth underline">Start your first book</Link>.</p>
        )}
      </section>
    </div>
  );
}
