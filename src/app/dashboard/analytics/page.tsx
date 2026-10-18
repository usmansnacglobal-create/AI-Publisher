import Link from 'next/link';
import { getViewer } from '@/lib/data';
import { PLATFORMS } from '@/lib/publishing';
import { formatNumber } from '@/lib/text';
import { Empty, PageHeader } from '@/components/ui';
import { ColumnChart, StatTile } from '@/components/column-chart';

export const metadata = { title: 'Performance Analytics' };
export const dynamic = 'force-dynamic';

type Sale = { book_id: string; period: string; store: string; format: string; units: number; pages_read: number; revenue: number; royalty: number };
const usd = (n: number) => `$${n.toFixed(2)}`;
const storeName = (s: string) => (PLATFORMS as Record<string, { label: string }>)[s]?.label ?? s;

function Breakdown({ title, rows }: { title: string; rows: [string, { units: number; royalty: number }][] }) {
  const max = Math.max(1, ...rows.map(([, v]) => v.royalty));
  return (
    <section className="panel p-4" aria-label={title}>
      <h2 className="mb-2 text-[1.05rem]">{title}</h2>
      <table className="w-full text-[14px]">
        <thead><tr className="text-left text-[12px] text-ink-muted"><th className="py-1 font-medium">{title.replace('By ', '')}</th><th className="py-1 text-right font-medium">Copies</th><th className="py-1 pl-3 font-medium">Royalties</th></tr></thead>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="group">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal">{k}</th>
              <td className="py-1.5 text-right tabular-nums">{formatNumber(v.units)}</td>
              <td className="w-[45%] py-1.5 pl-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 rounded-r-[4px] bg-cloth group-hover:bg-cloth-dark" style={{ width: `${(v.royalty / max) * 70}%`, minWidth: v.royalty > 0 ? 2 : 0 }} />
                  <span className="tabular-nums text-ink-soft">{usd(v.royalty)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: { book?: string } }) {
  const { supabase, user } = await getViewer();
  const [{ data: books }, { data: all }] = await Promise.all([
    supabase.from('books').select('id,title').eq('user_id', user.id).order('title'),
    supabase.from('sales').select('book_id,period,store,format,units,pages_read,revenue,royalty').eq('user_id', user.id).order('period'),
  ]);
  const book = books?.find((b) => b.id === searchParams.book);
  const sales = ((all ?? []) as Sale[]).filter((s) => !book || s.book_id === book.id);
  const sum = (f: (s: Sale) => number) => sales.reduce((t, s) => t + Number(f(s)), 0);
  const group = (key: (s: Sale) => string) => {
    const m = new Map<string, { units: number; royalty: number }>();
    for (const s of sales) {
      const k = key(s);
      const v = m.get(k) ?? { units: 0, royalty: 0 };
      v.units += s.units;
      v.royalty += Number(s.royalty);
      m.set(k, v);
    }
    return [...m.entries()].sort((a, b) => b[1].royalty - a[1].royalty);
  };

  // The last 12 months, oldest first, zero months included so gaps are honest.
  const months: { key: string; label: string; value: number; detail: string }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }), value: 0, detail: '' });
  }
  for (const s of sales) {
    const m = months.find((x) => x.key === s.period.slice(0, 7));
    if (m) m.value += Number(s.royalty);
  }
  for (const m of months) {
    const u = sales.filter((s) => s.period.startsWith(m.key)).reduce((t, s) => t + s.units, 0);
    m.detail = `${formatNumber(u)} ${u === 1 ? 'copy' : 'copies'}`;
  }
  const last = months[11].value;
  const prev = months[10].value;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Performance Analytics">Sales, pages read and royalties for your published books. Our publishing team adds the figures from each store’s reports every month.</PageHeader>
      {books && books.length > 1 && (
        <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Choose a book">
          <Link href="/dashboard/analytics" className="chip" aria-current={!book ? 'page' : undefined} aria-pressed={!book}>All books</Link>
          {books.map((b) => <Link key={b.id} href={`/dashboard/analytics?book=${b.id}`} className="chip" aria-pressed={book?.id === b.id}>{b.title}</Link>)}
        </nav>
      )}
      {!sales.length ? (
        <Empty title="No sales figures yet">
          Once {book ? 'this book is' : 'your books are'} live, sales and royalties appear here after each store’s monthly report. Track where your books are on sale in <Link href="/dashboard/distribution" className="underline">Distribution Channels</Link>.
        </Empty>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-4">
            <StatTile label="Copies sold" value={formatNumber(sum((s) => s.units))} />
            <StatTile label="Kindle pages read" value={formatNumber(sum((s) => s.pages_read))} note="Kindle Unlimited" />
            <StatTile label="Sales revenue" value={usd(sum((s) => s.revenue))} />
            <StatTile label="Your royalties" value={usd(sum((s) => s.royalty))} note={prev ? `${last >= prev ? '+' : ''}${Math.round(((last - prev) / prev) * 100)}% on last month` : undefined} />
          </div>
          <section className="panel mb-8 p-5" aria-labelledby="by-month">
            <h2 id="by-month" className="mb-3 text-[1.1rem]">Royalties by month</h2>
            <ColumnChart data={months} format={(n) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`)} label="Royalties by month, last 12 months" />
          </section>
          <div className="grid gap-6 lg:grid-cols-3">
            {!book && <Breakdown title="By book" rows={group((s) => books?.find((b) => b.id === s.book_id)?.title ?? 'Deleted book')} />}
            <Breakdown title="By store" rows={group((s) => storeName(s.store))} />
            <Breakdown title="By format" rows={group((s) => s.format[0].toUpperCase() + s.format.slice(1))} />
          </div>
        </>
      )}
    </div>
  );
}
