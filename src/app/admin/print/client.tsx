'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorText } from '@/lib/client';
import { ORDER_STATUS, quote, type PrintPricing } from '@/lib/print-orders';
import { INKS, TRIM_SIZES } from '@/lib/spine';
import { Badge, Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

type Row = {
  id: string; book_id: string | null; book_title: string; format: string; ink: 'bw' | 'standard' | 'premium'; trim_size: string; paper: string; pages: number; quantity: number;
  base_unit_cost: number; unit_price: number; shipping_cost: number; total: number; status: string; tracking: string; admin_note: string;
  ship_to: Record<string, string>; created_at: string; email: string; name: string; paypal_order_id: string | null; hasCover: boolean;
};

export function OrdersAdmin({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const list = rows.filter((r) => filter === 'all' || !['delivered', 'cancelled'].includes(r.status));
  return (
    <section className="mb-12">
      <div className="mb-3 flex items-center justify-between">
        <h2>Orders</h2>
        <div className="flex gap-1.5">
          <button className="chip" aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>Open</button>
          <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
        </div>
      </div>
      {list.length ? <ul className="space-y-3">{list.map((r) => <OrderRow key={r.id} r={r} />)}</ul> : <p className="panel p-4 text-ink-muted">No orders here.</p>}
    </section>
  );
}

function OrderRow({ r }: { r: Row }) {
  const toast = useToast();
  const router = useRouter();
  const [status, setStatus] = useState(r.status);
  const [tracking, setTracking] = useState(r.tracking);
  const [note, setNote] = useState(r.admin_note);
  const [busy, setBusy] = useState(false);
  const a = r.ship_to ?? {};
  async function save() {
    setBusy(true);
    try {
      await api(`/api/admin/print-orders/${r.id}`, { method: 'PATCH', body: { status, tracking, note } });
      toast('Order updated and the author notified');
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy(false);
  }
  return (
    <li className="panel grid gap-4 p-4 text-[14px] lg:grid-cols-[1.3fr_1fr_1fr]">
      <div>
        <p className="font-medium text-ink">{r.quantity} × {r.format}: {r.book_title}</p>
        <p className="text-ink-muted">{TRIM_SIZES[r.trim_size]?.label ?? r.trim_size} · {r.pages} pages · {INKS[r.ink]?.label} · {r.paper} paper</p>
        <p className="mt-1">{r.name || r.email} <span className="text-ink-muted">({r.email})</span></p>
        <p className="text-ink-muted">Ordered {new Date(r.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        {r.book_id && <p className="mt-1 flex gap-3 text-[13px]"><a className="underline" href={`/api/books/${r.book_id}/export?format=pdf`} download>Print PDF</a><Link className="underline" href={`/dashboard/books/${r.book_id}/cover`}>Cover files</Link>{!r.hasCover && <span className="text-danger">No cover exported</span>}</p>}
      </div>
      <div>
        <p className="font-medium">Ship to</p>
        <address className="not-italic text-ink-soft">{[a.name, a.line1, a.line2, `${a.city ?? ''} ${a.postcode ?? ''}`.trim(), a.region, a.country, a.phone].filter(Boolean).map((l) => <span key={l} className="block">{l}</span>)}</address>
        <p className="mt-2">Author paid <strong>${Number(r.total).toFixed(2)}</strong> <span className="text-ink-muted">(printing ${(Number(r.unit_price) * r.quantity).toFixed(2)} + shipping ${Number(r.shipping_cost).toFixed(2)})</span></p>
        <p className="text-ink-muted">IngramSpark printing ≈ ${(Number(r.base_unit_cost) * r.quantity).toFixed(2)} (${Number(r.base_unit_cost).toFixed(2)} a copy)</p>
        {r.paypal_order_id && <p className="text-[12px] text-ink-muted">PayPal order {r.paypal_order_id}</p>}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2"><Badge tone={r.status === 'delivered' || r.status === 'shipped' ? 'cloth' : r.status === 'cancelled' ? 'neutral' : 'gilt'}>{ORDER_STATUS[r.status]?.label}</Badge></div>
        <select aria-label="Status" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
          {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input aria-label="Tracking" className="field" placeholder="Tracking number or link" value={tracking} onChange={(e) => setTracking(e.target.value)} />
        <input aria-label="Note for the author" className="field" placeholder="Note for the author (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" onClick={save} loading={busy}>Update and notify author</Button>
      </div>
    </li>
  );
}

export function PricingEditor({ initial }: { initial: PrintPricing }) {
  const toast = useToast();
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);
  const num = (v: string) => Number(v);
  const setRate = (b: 'paperback' | 'hardcover', ink: string, k: 'unit' | 'page', v: string) =>
    setP((x) => ({ ...x, rates: { ...x.rates, [b]: { ...(x.rates[b] as Record<string, { unit: number; page: number }>), [ink]: { ...(x.rates[b] as Record<string, { unit: number; page: number }>)[ink], [k]: num(v) } } } }));
  const setZone = (key: string, k: 'label' | 'order' | 'perBook' | 'days', v: string) =>
    setP((x) => ({ ...x, shipping: { ...x.shipping, [key]: { ...x.shipping[key], [k]: k === 'label' || k === 'days' ? v : num(v) } } }));
  const example = quote({ binding: 'paperback', ink: 'bw', trim: '6x9', paper: 'white', pages: 500, quantity: 1, region: Object.keys(p.shipping)[0] }, p);

  async function save() {
    setBusy(true);
    try {
      const r = await api<{ pricing: PrintPricing }>('/api/admin/print-pricing', { method: 'PUT', body: { pricing: p } });
      setP(r.pricing);
      toast('Print prices saved');
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy(false);
  }

  const rateRows: [string, 'paperback' | 'hardcover', string][] = [
    ['Paperback, black and white', 'paperback', 'bw'],
    ['Paperback, standard colour', 'paperback', 'standard'],
    ['Paperback, premium colour', 'paperback', 'premium'],
    ['Hardcover, black and white', 'hardcover', 'bw'],
    ['Hardcover, premium colour', 'hardcover', 'premium'],
  ];
  return (
    <section className="panel space-y-5 p-5" aria-labelledby="pricing">
      <div>
        <h2 id="pricing">Print pricing</h2>
        <p className="text-[14px] text-ink-muted">
          Enter IngramSpark’s printing cost (US) for each option: a cost per copy plus a cost per page. Authors pay that × the markup. Check the figures in IngramSpark’s Print &amp; Ship calculator from time to time; black-and-white paperback starts from IngramSpark’s published February 2026 rate, the others are estimates to replace.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Markup (× IngramSpark cost)" htmlFor="mult"><input id="mult" type="number" step="0.05" min={1} className="field" value={p.multiplier} onChange={(e) => setP({ ...p, multiplier: num(e.target.value) })} /></Field>
        <Field label="Large-trim page cost ×" htmlFor="large" hint="For sizes over 6.12″ wide or 9″ tall."><input id="large" type="number" step="0.05" min={1} className="field" value={p.largeTrimPageFactor} onChange={(e) => setP({ ...p, largeTrimPageFactor: num(e.target.value) })} /></Field>
        <Field label="Rates last checked" htmlFor="checked"><input id="checked" type="date" className="field" value={p.checkedOn} onChange={(e) => setP({ ...p, checkedOn: e.target.value })} /></Field>
      </div>
      <table className="w-full text-[14px]">
        <thead><tr className="text-left text-ink-muted"><th className="py-1 font-medium">IngramSpark cost</th><th className="py-1 font-medium">Per copy ($)</th><th className="py-1 font-medium">Per page ($)</th></tr></thead>
        <tbody>
          {rateRows.map(([label, b, ink]) => {
            const r = (p.rates[b] as Record<string, { unit: number; page: number }>)[ink];
            return (
              <tr key={label} className="border-t border-line">
                <td className="py-1.5 pr-3">{label}</td>
                <td className="py-1.5 pr-3"><input aria-label={`${label} per copy`} type="number" step="0.01" min={0} className="field" value={r.unit} onChange={(e) => setRate(b, ink, 'unit', e.target.value)} /></td>
                <td className="py-1.5"><input aria-label={`${label} per page`} type="number" step="0.0001" min={0} className="field" value={r.page} onChange={(e) => setRate(b, ink, 'page', e.target.value)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div>
        <h3 className="mb-1">Shipping</h3>
        <label className="mb-2 flex items-center gap-2 text-[14px]"><input type="checkbox" className="accent-cloth" checked={p.markupShipping} onChange={(e) => setP({ ...p, markupShipping: e.target.checked })} />Apply the markup to shipping too (off: shipping is charged at cost)</label>
        <table className="w-full text-[14px]">
          <thead><tr className="text-left text-ink-muted"><th className="py-1 font-medium">Destination</th><th className="py-1 font-medium">Per order ($)</th><th className="py-1 font-medium">Per copy ($)</th><th className="py-1 font-medium">Delivery time</th></tr></thead>
          <tbody>
            {Object.entries(p.shipping).map(([k, z]) => (
              <tr key={k} className="border-t border-line">
                <td className="py-1.5 pr-2"><input aria-label={`${k} name`} className="field" value={z.label} onChange={(e) => setZone(k, 'label', e.target.value)} /></td>
                <td className="py-1.5 pr-2"><input aria-label={`${z.label} per order`} type="number" step="0.01" min={0} className="field" value={z.order} onChange={(e) => setZone(k, 'order', e.target.value)} /></td>
                <td className="py-1.5 pr-2"><input aria-label={`${z.label} per copy`} type="number" step="0.01" min={0} className="field" value={z.perBook} onChange={(e) => setZone(k, 'perBook', e.target.value)} /></td>
                <td className="py-1.5"><input aria-label={`${z.label} delivery time`} className="field" value={z.days} onChange={(e) => setZone(k, 'days', e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rounded-md bg-ground px-3 py-2 text-[14px]">
        Example: one 500-page 6″ × 9″ black-and-white paperback costs about <strong>${example.baseUnit.toFixed(2)}</strong> at IngramSpark, so the author pays <strong>${example.unitPrice.toFixed(2)}</strong> a copy plus shipping.
      </p>
      <Button onClick={save} loading={busy}>Save print pricing</Button>
    </section>
  );
}
