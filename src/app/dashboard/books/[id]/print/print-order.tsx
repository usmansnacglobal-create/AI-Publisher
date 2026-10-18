'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2, Package, Printer } from 'lucide-react';
import { api, errorText } from '@/lib/client';
import { INKS, TRIM_SIZES, type Binding } from '@/lib/spine';
import { ORDER_STATUS, type PrintPricing } from '@/lib/print-orders';
import { Badge, Button, Field, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';
import { getQuote, money, PriceBreakdown, Problems, QuantityInput, RegionSelect } from '@/components/print-calculator';

interface Order {
  id: string; status: string; format: Binding; quantity: number; total: number; unit_price: number; shipping_cost: number;
  created_at: string; tracking: string; admin_note: string; paypal_order_id: string | null; book_title: string;
}
interface Data {
  book: { id: string; title: string };
  readiness: { pages: number; trim: string; ink: 'bw' | 'standard' | 'premium'; paper: 'white' | 'cream'; missing: Record<Binding, string[]> };
  pricing: PrintPricing;
  orders: Order[];
  defaultName: string;
  paypal: { clientId: string } | null;
}

type PayPalNs = { Buttons: (o: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void>; close?: () => void } };
declare global {
  interface Window {
    paypalOrders?: PayPalNs;
  }
}

const EMPTY_ADDRESS = { name: '', line1: '', line2: '', city: '', region: '', postcode: '', country: '', phone: '' };
const DRAFT_KEY = 'ap:print-address';

function loadPayPal(clientId: string) {
  return new Promise<PayPalNs>((resolve, reject) => {
    if (window.paypalOrders) return resolve(window.paypalOrders);
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
    s.setAttribute('data-namespace', 'paypalOrders');
    s.onload = () => (window.paypalOrders ? resolve(window.paypalOrders) : reject(new Error('PayPal didn’t load.')));
    s.onerror = () => reject(new Error('PayPal didn’t load. Check your connection and try again.'));
    document.head.appendChild(s);
  });
}

export function PrintOrder({ bookId }: { bookId: string }) {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [format, setFormat] = useState<Binding>('paperback');
  const [quantity, setQuantity] = useState(5);
  const [region, setRegion] = useState('us');
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Order | null>(null);
  const payRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const d = await api<Data>(`/api/books/${bookId}/print`);
    setData(d);
    setRegion((r) => (d.pricing.shipping[r] ? r : Object.keys(d.pricing.shipping)[0]));
    setAddress((a) => (a.name ? a : { ...a, name: d.defaultName }));
    return d;
  }, [bookId]);

  useEffect(() => {
    load().catch((e) => toast(errorText(e), 'error'));
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
      if (saved) setAddress((a) => ({ ...a, ...saved }));
    } catch {}
  }, [load, toast]);

  // Show PayPal's buttons once an order is waiting for payment.
  useEffect(() => {
    if (!pending?.paypal_order_id || !data?.paypal || !payRef.current) return;
    let cancelled = false;
    const el = payRef.current;
    el.innerHTML = '';
    loadPayPal(data.paypal.clientId)
      .then((pp) => {
        if (cancelled) return;
        return pp
          .Buttons({
            style: { layout: 'vertical', shape: 'rect', label: 'pay' },
            createOrder: () => pending.paypal_order_id,
            onApprove: async () => {
              try {
                await api(`/api/print-orders/${pending.id}/capture`, { body: {} });
                toast('Payment received. We’ll start printing your books.');
                setPending(null);
                await load();
              } catch (e) {
                setError(errorText(e));
              }
            },
            onCancel: () => toast('Payment cancelled. Your order is saved, so you can pay later.'),
            onError: () => setError('PayPal couldn’t complete the payment. Nothing was charged.'),
          })
          .render(el);
      })
      .catch((e) => setError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [pending, data?.paypal, load, toast]);

  if (!data) return <p className="text-ink-muted">Loading…</p>;
  const { readiness: r, pricing } = data;
  const trim = TRIM_SIZES[r.trim];
  const q = getQuote({ binding: format, ink: r.ink, trim: r.trim, paper: r.paper, pages: r.pages || 0, quantity, region }, pricing)!;
  const missing = r.missing[format];
  const problems = r.pages ? q.problems : [];
  const canOrder = !missing.length && !problems.length;
  const setA = (k: keyof typeof EMPTY_ADDRESS, v: string) => setAddress((a) => ({ ...a, [k]: v }));

  async function place() {
    setError('');
    setBusy(true);
    try {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(address));
      } catch {}
      const res = await api<{ order: Order; paypalOrderId: string | null }>('/api/print-orders', { body: { bookId, format, quantity, region, shipTo: address } });
      if (res.paypalOrderId) {
        setPending(res.order);
        setTimeout(() => payRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      } else {
        toast('Order placed. We’ll email you a payment request.');
        await load();
      }
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  }

  async function cancel(id: string) {
    if (!confirm('Cancel this unpaid order?')) return;
    try {
      await api(`/api/print-orders/${id}/cancel`, { body: {} });
      if (pending?.id === id) setPending(null);
      await load();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <section>
        <PageHeader title="Order printed copies">
          Printed and bound from your final files, then posted to you. Great for launch events, reviewers, bookshops and gifts.
        </PageHeader>

        <div className="panel mb-6 grid gap-3 p-4 text-[14px] sm:grid-cols-4">
          <div><p className="text-ink-muted">Size</p><p className="font-medium">{trim?.label ?? r.trim}</p></div>
          <div><p className="text-ink-muted">Pages</p><p className="font-medium">{r.pages || 'Not measured yet'}</p></div>
          <div><p className="text-ink-muted">Interior</p><p className="font-medium">{INKS[r.ink].label}</p></div>
          <div><p className="text-ink-muted">Paper</p><p className="font-medium capitalize">{r.ink === 'bw' ? r.paper : 'white'}</p></div>
          <p className="text-[12px] text-ink-muted sm:col-span-4">To change any of these, edit your layout on the <Link href={`/dashboard/books/${bookId}/format`} className="underline">Layout tab</Link> and download the print PDF again.</p>
        </div>

        <fieldset className="mb-6">
          <legend className="label">Binding</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['paperback', 'hardcover'] as const).map((b) => (
              <label key={b} className={clsx('flex cursor-pointer gap-3 rounded-md border p-3', format === b ? 'border-cloth bg-cloth-light/60' : 'border-line bg-sheet')}>
                <input type="radio" name="binding" className="mt-1 accent-cloth" checked={format === b} onChange={() => setFormat(b)} />
                <span>
                  <span className="block font-medium">{b === 'paperback' ? 'Paperback' : 'Hardcover'}</span>
                  <span className="text-[13px] text-ink-muted">{b === 'paperback' ? 'Perfect-bound with a gloss or matte cover' : 'Case-laminate hardcover, printed cover on the boards'}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {missing.length > 0 && (
          <div className="mb-6 rounded-md border border-gilt/40 bg-gilt-light px-4 py-3 text-[14px] text-gilt-ink">
            <p className="mb-1 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" aria-hidden />Finish your print files first</p>
            <ul className="list-disc space-y-0.5 pl-5">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
            <p className="mt-2 text-[13px]">You can still use the calculator below to see what your order will cost.</p>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <QuantityInput value={quantity} onChange={setQuantity} max={pricing.maxQuantity} />
          <RegionSelect value={region} onChange={setRegion} pricing={pricing} />
        </div>

        <h2 className="mb-3 mt-8 text-[1.15rem]">Delivery address</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" htmlFor="a-name"><input id="a-name" className="field" autoComplete="name" value={address.name} onChange={(e) => setA('name', e.target.value)} /></Field>
          <Field label="Phone (for the courier, optional)" htmlFor="a-phone"><input id="a-phone" className="field" autoComplete="tel" value={address.phone} onChange={(e) => setA('phone', e.target.value)} /></Field>
          <Field label="Address line 1" htmlFor="a-l1"><input id="a-l1" className="field" autoComplete="address-line1" value={address.line1} onChange={(e) => setA('line1', e.target.value)} /></Field>
          <Field label="Address line 2 (optional)" htmlFor="a-l2"><input id="a-l2" className="field" autoComplete="address-line2" value={address.line2} onChange={(e) => setA('line2', e.target.value)} /></Field>
          <Field label="Town or city" htmlFor="a-city"><input id="a-city" className="field" autoComplete="address-level2" value={address.city} onChange={(e) => setA('city', e.target.value)} /></Field>
          <Field label="County, state or region" htmlFor="a-region"><input id="a-region" className="field" autoComplete="address-level1" value={address.region} onChange={(e) => setA('region', e.target.value)} /></Field>
          <Field label="Postcode or ZIP" htmlFor="a-post"><input id="a-post" className="field" autoComplete="postal-code" value={address.postcode} onChange={(e) => setA('postcode', e.target.value)} /></Field>
          <Field label="Country" htmlFor="a-country"><input id="a-country" className="field" autoComplete="country-name" value={address.country} onChange={(e) => setA('country', e.target.value)} /></Field>
        </div>

        {error && <p className="mt-4 text-danger" role="alert">{error}</p>}
      </section>

      <aside className="space-y-4">
        <div className="panel sticky top-6 space-y-4 p-5">
          <h2 className="flex items-center gap-2 text-[1.15rem]"><Printer className="h-5 w-5 text-cloth" aria-hidden />Your order</h2>
          <p className="text-[14px] text-ink-muted">{quantity} × {format} of <span className="text-ink">{data.book.title}</span></p>
          {r.pages ? <PriceBreakdown q={q} quantity={quantity} pricing={pricing} region={region} /> : <p className="text-[14px] text-ink-muted">Download the print PDF on the Layout tab to get an exact price.</p>}
          <Problems items={problems} />
          {pending ? (
            <div className="space-y-2 border-t border-line pt-3">
              <p className="text-[14px] font-medium">Pay {money(Number(pending.total))} securely with PayPal or a card</p>
              <div ref={payRef} />
              <button className="text-[13px] text-ink-muted underline" onClick={() => cancel(pending.id)}>Cancel this order</button>
            </div>
          ) : (
            <>
              <Button className="w-full" onClick={place} loading={busy} disabled={!canOrder || !r.pages}>
                {data.paypal ? 'Continue to payment' : 'Place order'}
              </Button>
              {!data.paypal && <p className="text-[12px] text-ink-muted">Online payment isn’t set up yet, so we’ll email you a secure payment request.</p>}
            </>
          )}
        </div>

        {data.orders.length > 0 && (
          <div className="panel p-4">
            <h3 className="mb-2 flex items-center gap-2 text-[1rem]"><Package className="h-4 w-4 text-cloth" aria-hidden />Orders for this book</h3>
            <ul className="space-y-2 text-[13px]">
              {data.orders.map((o) => (
                <li key={o.id} className="flex items-start justify-between gap-2">
                  <span>
                    {o.quantity} × {o.format} · {money(Number(o.total))}
                    <span className="block text-ink-muted">{new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{o.tracking ? ` · Tracking: ${o.tracking}` : ''}</span>
                    {o.status === 'awaiting_payment' && o.paypal_order_id && data.paypal && !pending && (
                      <button className="text-cloth underline" onClick={() => setPending(o)}>Pay now</button>
                    )}
                  </span>
                  <Badge tone={o.status === 'delivered' || o.status === 'shipped' ? 'cloth' : o.status === 'cancelled' ? 'neutral' : 'gilt'}>{ORDER_STATUS[o.status]?.label ?? o.status}</Badge>
                </li>
              ))}
            </ul>
            <Link href="/dashboard/print-orders" className="mt-3 inline-flex items-center gap-1 text-[13px] text-cloth underline"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />All print orders</Link>
          </div>
        )}
      </aside>
    </div>
  );
}
