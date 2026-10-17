import { getViewer } from '@/lib/data';
import { getUsage } from '@/lib/tokens';
import { FEATURE_LABELS } from '@/lib/plans';
import { formatNumber } from '@/lib/text';
import { ButtonLink, PageHeader, Progress } from '@/components/ui';

export const metadata = { title: 'AI usage' };

function Bars({ rows, total }: { rows: [string, number][]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <table className="w-full text-[14px]">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="group">
            <th scope="row" className="w-[40%] py-1.5 pr-3 text-left font-normal">{k}</th>
            <td className="py-1.5">
              <div className="h-3 rounded-r-[4px] bg-cloth group-hover:bg-cloth-dark" style={{ width: `${(v / max) * 100}%`, minWidth: 2 }} title={`${k}: ${formatNumber(v)} tokens`} />
            </td>
            <td className="w-28 py-1.5 pl-3 text-right tabular-nums text-ink-soft">{formatNumber(v)}<span className="ml-1 text-[12px] text-ink-muted">{Math.round((v / Math.max(1, total)) * 100)}%</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function UsagePage() {
  const { supabase, user } = await getViewer();
  const u = await getUsage(user.id);
  const { data: rows } = await supabase.from('token_usage').select('book_id, feature, total_tokens, created_at').gte('created_at', u.periodStart);
  const { data: books } = await supabase.from('books').select('id,title');
  const sum = (key: (r: NonNullable<typeof rows>[number]) => string) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(key(r), (m.get(key(r)) ?? 0) + r.total_tokens);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const byFeature = sum((r) => FEATURE_LABELS[r.feature] ?? r.feature);
  const byBook = sum((r) => books?.find((b) => b.id === r.book_id)?.title ?? 'Deleted book');

  // Daily usage across the whole cycle (zero days included so gaps are honest).
  // One bar per calendar day (UTC) from the start of the cycle to today, zero days included.
  const start = new Date(u.periodStart.slice(0, 10) + 'T00:00:00Z');
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const days: { d: string; v: number }[] = [];
  for (let t = new Date(start); t <= today; t.setUTCDate(t.getUTCDate() + 1)) days.push({ d: t.toISOString().slice(0, 10), v: 0 });
  const byDay = new Map(days.map((x) => [x.d, x]));
  for (const r of rows ?? []) {
    const day = byDay.get(new Date(r.created_at).toISOString().slice(0, 10));
    if (day) day.v += r.total_tokens;
  }
  const maxDay = Math.max(1, ...days.map((d) => d.v));
  const pct = u.usagePercent;

  return (
    <div className="mx-auto max-w-[960px]">
      <PageHeader title="AI usage" actions={<ButtonLink href="/dashboard/billing" variant="secondary">Change plan</ButtonLink>}>
        Your {u.planName} plan includes {formatNumber(u.tokenLimit)} AI tokens each billing cycle. Writing and editing with Claude uses tokens as text is read and written; cover images from ChatGPT count at {process.env.IMAGE_TOKEN_WEIGHT ?? 3}× because images cost more to make.
      </PageHeader>

      <section className="panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-serif text-[2.2rem] leading-none">{formatNumber(u.tokensUsed)}<span className="ml-2 font-sans text-[15px] text-ink-muted">of {formatNumber(u.tokenLimit)} used</span></p>
          <p className="text-[14px] text-ink-muted">
            {formatNumber(u.tokensRemaining)} left · resets {new Date(u.periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="mt-4"><Progress value={pct} tone={pct >= 100 ? 'danger' : pct >= 80 ? 'gilt' : 'cloth'} label="Tokens used" /></div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3">Tokens per day</h2>
        <div className="panel p-4">
          <div className="flex h-40 items-end gap-[2px]" role="img" aria-label="Daily token use this billing cycle; see the tables below for exact figures">
            {days.map((d) => (
              <div key={d.d} className="group relative flex h-full flex-1 items-end">
                <div className="w-full rounded-t-[4px] bg-cloth group-hover:bg-cloth-dark" style={{ height: `${(d.v / maxDay) * 100}%`, minHeight: d.v ? 2 : 0 }} />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-[12px] text-white group-hover:block">
                  {new Date(d.d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: {formatNumber(d.v)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between border-t border-line pt-1 text-[12px] text-ink-muted">
            <span>{start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            <span>Today</span>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3">By feature</h2>
          <div className="panel p-4">{byFeature.length ? <Bars rows={byFeature} total={u.tokensUsed} /> : <p className="text-[14px] text-ink-muted">No AI use yet this cycle.</p>}</div>
        </section>
        <section>
          <h2 className="mb-3">By book</h2>
          <div className="panel p-4">{byBook.length ? <Bars rows={byBook} total={u.tokensUsed} /> : <p className="text-[14px] text-ink-muted">No AI use yet this cycle.</p>}</div>
        </section>
      </div>
    </div>
  );
}
