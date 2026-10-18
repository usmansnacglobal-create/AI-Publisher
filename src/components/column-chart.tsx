/**
 * A single-series column chart: one hue, thin columns with rounded tops anchored to the
 * baseline, a recessive grid, a hover/focus tooltip on each column, and a hidden data table
 * for screen readers. Server-renderable (CSS-only hover).
 */
export function ColumnChart({
  data, format, label, height = 160,
}: {
  data: { label: string; value: number; detail?: string }[];
  format: (n: number) => string;
  /** What the chart shows, for the title and screen readers. */
  label: string;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  const top = max > 0 ? niceCeil(max) : 1;
  const ticks = [top, top / 2, 0];
  const every = Math.ceil(data.length / 12);
  return (
    <figure className="m-0">
      {max === 0 && <p className="mb-2 text-[13px] text-ink-muted">Nothing to show for this period yet.</p>}
      <div className="flex gap-2" aria-hidden>
        <div className="flex shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-ink-muted" style={{ height }}>
          {ticks.map((t) => <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">{format(t)}</span>)}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-0 flex flex-col justify-between" style={{ height }}>
            {ticks.map((t) => <div key={t} className="border-t border-line/70" />)}
          </div>
          <div className="relative flex items-end gap-[2px]" style={{ height }}>
            {data.map((d, i) => (
              <div key={i} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0}>
                <div
                  className="w-full max-w-[28px] rounded-t-[4px] bg-cloth group-hover:bg-cloth-dark group-focus:bg-cloth-dark"
                  style={{ height: `${top ? (d.value / top) * 100 : 0}%`, minHeight: d.value > 0 ? 2 : 0 }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-[12px] text-white shadow group-hover:block group-focus:block">
                  <span className="font-medium">{d.label}</span>: {format(d.value)}{d.detail ? ` · ${d.detail}` : ''}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex h-4 gap-[2px] text-[11px] text-ink-muted">
            {data.map((d, i) => (
              <span key={i} className="relative min-w-0 flex-1">
                {i % every === 0 && <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap">{d.label}</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{data.map((d, i) => <tr key={i}><th scope="row">{d.label}</th><td>{format(d.value)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

function niceCeil(n: number) {
  const p = 10 ** Math.floor(Math.log10(n));
  const m = n / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-sheet p-4">
      <p className="text-[13px] text-ink-muted">{label}</p>
      <p className="font-serif text-[1.6rem] leading-tight tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-[12px] text-ink-muted">{note}</p>}
    </div>
  );
}
