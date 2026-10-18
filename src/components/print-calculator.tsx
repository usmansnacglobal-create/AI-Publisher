'use client';
import { clsx } from 'clsx';
import { quote, type PrintPricing, type Quote, type QuoteInput } from '@/lib/print-orders';

export const money = (n: number) => `$${n.toFixed(2)}`;
export const QUICK_QUANTITIES = [1, 5, 10, 25, 50, 100];

/** The price breakdown shown next to every print order form. */
export function PriceBreakdown({ q, quantity, pricing, region }: { q: Quote; quantity: number; pricing: PrintPricing; region: string }) {
  const zone = pricing.shipping[region];
  return (
    <dl className="space-y-1.5 text-[14px]" aria-live="polite">
      <div className="flex justify-between"><dt className="text-ink-muted">Price per copy</dt><dd className="font-medium">{money(q.unitPrice)}</dd></div>
      <div className="flex justify-between"><dt className="text-ink-muted">Printing ({quantity} {quantity === 1 ? 'copy' : 'copies'})</dt><dd>{money(q.printTotal)}</dd></div>
      <div className="flex justify-between"><dt className="text-ink-muted">Shipping{zone ? ` to ${zone.label}` : ''}</dt><dd>{money(q.shipping)}</dd></div>
      <div className="flex justify-between border-t border-line pt-2 text-[16px]"><dt className="font-medium">Total</dt><dd className="font-serif text-[1.35rem]">{money(q.total)}</dd></div>
      {zone?.days && <p className="pt-1 text-[12px] text-ink-muted">Printing takes about 3–5 working days, then delivery {zone.days}.</p>}
    </dl>
  );
}

export function QuantityInput({ value, onChange, max }: { value: number; onChange: (n: number) => void; max: number }) {
  return (
    <div>
      <label htmlFor="qty" className="label">How many copies?</label>
      <input id="qty" type="number" min={1} max={max} className="field w-32" value={value} onChange={(e) => onChange(Math.max(1, Math.min(max, Math.round(Number(e.target.value) || 1))))} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_QUANTITIES.filter((n) => n <= max).map((n) => (
          <button key={n} type="button" className="chip" aria-pressed={value === n} onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
    </div>
  );
}

export function RegionSelect({ value, onChange, pricing }: { value: string; onChange: (r: string) => void; pricing: PrintPricing }) {
  return (
    <div>
      <label htmlFor="region" className="label">Where are they going?</label>
      <select id="region" className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(pricing.shipping).map(([k, z]) => <option key={k} value={k}>{z.label}</option>)}
      </select>
    </div>
  );
}

export function getQuote(input: QuoteInput, pricing: PrintPricing | null) {
  return pricing ? quote(input, pricing) : null;
}

export function Problems({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className={clsx('space-y-1 rounded-md bg-gilt-light px-3 py-2 text-[13px] text-gilt-ink')} role="alert">
      {items.map((p) => <li key={p}>{p}</li>)}
    </ul>
  );
}
