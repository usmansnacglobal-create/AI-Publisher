import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { getViewer } from '@/lib/data';
import { createAdminClient } from '@/lib/supabase/admin';
import { providersReady } from '@/lib/billing';
import { checkElevenLabs, NARRATION_MODELS, USD_PER_1K_CHARS } from '@/lib/elevenlabs';
import { narrationMargins, GBP_USD_RATE, type MarginReport } from '@/lib/margins';
import { CATALOG, NARRATION_TIERS, NARRATION_TIER_ORDER, money, type Currency } from '@/lib/pricing';
import { AdminBillingActions } from './actions';

export const metadata = { title: 'Billing setup' };
export const dynamic = 'force-dynamic';

const STRIPE_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'invoice.paid', 'invoice.payment_failed', 'customer.subscription.updated', 'customer.subscription.deleted'];
const PAYPAL_EVENTS = ['PAYMENT.SALE.COMPLETED', 'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.UPDATED', 'BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED'];

function Row({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex gap-3 px-4 py-3 text-[14px]">
      {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cloth" aria-label="Working" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-label="Needs attention" />}
      <div><p className="font-medium">{label}</p><p className="text-ink-muted">{detail}</p></div>
    </li>
  );
}

const usd = (n: number) => `$${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Margin({ title, m }: { title: string; m: MarginReport }) {
  const low = m.multiple !== null && m.multiple < 10;
  return (
    <section className="panel p-4 text-[14px]">
      <h3 className="mb-2">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt className="text-ink-muted">Narration income</dt><dd className="text-right tabular-nums">{money(m.revenue.GBP, 'GBP')} + {money(m.revenue.USD, 'USD')}</dd>
        <dt className="text-ink-muted">In dollars</dt><dd className="text-right tabular-nums">{usd(m.revenueUsd)}</dd>
        <dt className="text-ink-muted">ElevenLabs cost</dt><dd className="text-right tabular-nums">{usd(m.costUsd)}</dd>
        <dt className="text-ink-muted">Chapters narrated</dt><dd className="text-right tabular-nums">{m.jobs.toLocaleString('en-GB')} ({(m.chars / 900 / 60).toFixed(1)} h)</dd>
        <dt className="font-medium">Multiple</dt>
        <dd className={`text-right font-medium tabular-nums ${low ? 'text-danger' : 'text-cloth-dark'}`}>{m.multiple === null ? '—' : `${m.multiple.toFixed(1)}×`}</dd>
      </dl>
      {low && <p className="mt-2 text-danger">Below your 10× target. Check ElevenLabs’ current prices against the plan prices.</p>}
    </section>
  );
}

export default async function BillingSetup() {
  const { profile } = await getViewer();
  if (profile.role !== 'admin') notFound();
  const admin = createAdminClient();
  const ready = providersReady();
  const [el, { data: rows }, { data: voices }, m30, mAll] = await Promise.all([
    checkElevenLabs(),
    admin.from('billing_catalog').select('provider,item,currency,amount'),
    admin.from('app_settings').select('value').eq('key', 'elevenlabs_voices').maybeSingle(),
    narrationMargins(30),
    narrationMargins(),
  ]);
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site').replace(/\/$/, '');
  const stripeMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'live (real payments)' : 'test (no real money)';
  const has = (provider: string, item: string, currency: Currency, amount: number) => rows?.some((r) => r.provider === provider && r.item === item && r.currency === currency && Number(r.amount) === amount);
  const v = voices?.value as { refreshed_at?: string; count?: number } | undefined;
  const missing = CATALOG.flatMap((c) =>
    (['GBP', 'USD'] as Currency[]).flatMap((cur) => [
      ...(ready.stripe && !has('stripe', c.item, cur, c.prices[cur]) ? [1] : []),
      ...(ready.paypal && c.recurring && !has('paypal', c.item, cur, c.prices[cur]) ? [1] : []),
    ]),
  ).length;

  return (
    <main className="mx-auto max-w-[1000px] px-4 py-8">
      <div className="flex flex-wrap gap-4 text-[13px] text-ink-muted"><Link href="/admin">Publishing queue</Link><Link href="/admin/system">System check</Link><Link href="/admin/sales">Sales data</Link></div>
      <h1 className="mb-1 mt-1">Billing setup</h1>
      <p className="mb-8 max-w-prose text-ink-muted">Payments (Stripe and PayPal, in pounds and dollars), premium narration (ElevenLabs) and what narration is earning you.</p>

      <h2 className="mb-2">Connections</h2>
      <ul className="panel mb-8 divide-y divide-line">
        <Row ok={ready.stripe} label="Stripe (card payments)" detail={ready.stripe ? `Connected, ${stripeMode}.` : 'Add STRIPE_SECRET_KEY in Vercel, then redeploy.'} />
        <Row ok={!!process.env.STRIPE_WEBHOOK_SECRET} label="Stripe webhook" detail={process.env.STRIPE_WEBHOOK_SECRET ? 'Set.' : `In Stripe → Developers → Webhooks, add ${site}/api/billing/stripe/webhook with the events below, then put its signing secret in STRIPE_WEBHOOK_SECRET.`} />
        <Row ok={ready.paypal} label="PayPal" detail={ready.paypal ? `Connected, ${process.env.PAYPAL_ENV === 'live' ? 'live (real payments)' : 'sandbox (no real money)'}.` : 'Add NEXT_PUBLIC_PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in Vercel.'} />
        <Row ok={!!process.env.PAYPAL_WEBHOOK_ID} label="PayPal webhook" detail={process.env.PAYPAL_WEBHOOK_ID ? 'Set.' : `In your PayPal app, add a webhook to ${site}/api/billing/paypal/webhook with the events below, then put its ID in PAYPAL_WEBHOOK_ID.`} />
        <Row ok={el.ok} label="ElevenLabs (premium narration)" detail={el.ok ? `Connected. Turbo uses ${NARRATION_MODELS.turbo} ($${USD_PER_1K_CHARS.turbo}/1k characters); Standard uses ${NARRATION_MODELS.standard} ($${USD_PER_1K_CHARS.standard}/1k).` : el.detail} />
      </ul>

      <details className="panel mb-8 p-4 text-[14px]">
        <summary className="cursor-pointer font-medium">Webhook events to tick</summary>
        <p className="mt-3 font-medium">Stripe: {site}/api/billing/stripe/webhook</p>
        <p className="font-mono text-[12px] text-ink-muted">{STRIPE_EVENTS.join(', ')}</p>
        <p className="mt-3 font-medium">PayPal: {site}/api/billing/paypal/webhook</p>
        <p className="font-mono text-[12px] text-ink-muted">{PAYPAL_EVENTS.join(', ')}</p>
      </details>

      <h2 className="mb-2">Prices in Stripe and PayPal</h2>
      <p className="mb-3 max-w-prose text-[14px] text-ink-muted">One click creates every plan, narration add-on and top-up in both currencies. Run it again after changing a price in <code>src/lib/pricing.ts</code>: existing subscribers keep the price they signed up at.</p>
      <div className="mb-3 overflow-x-auto">
        <table className="panel w-full text-[14px]">
          <thead className="bg-ground text-left text-ink-muted">
            <tr><th className="px-3 py-2 font-medium">Item</th><th className="px-3 py-2 font-medium">GBP</th><th className="px-3 py-2 font-medium">USD</th><th className="px-3 py-2 font-medium">Stripe</th><th className="px-3 py-2 font-medium">PayPal</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {CATALOG.map((c) => {
              const cell = (provider: 'stripe' | 'paypal') => {
                if (!ready[provider]) return <span className="text-ink-faint">Not connected</span>;
                if (provider === 'paypal' && !c.recurring) return <span className="text-ink-muted">No setup needed</span>;
                const ok = (['GBP', 'USD'] as Currency[]).every((cur) => has(provider, c.item, cur, c.prices[cur]));
                return ok ? <span className="text-cloth-dark">Ready</span> : <span className="text-danger">Needs setup</span>;
              };
              return (
                <tr key={c.item}>
                  <td className="px-3 py-2">{c.name}{c.recurring ? ' (monthly)' : ''}</td>
                  <td className="px-3 py-2 tabular-nums">{money(c.prices.GBP, 'GBP')}</td>
                  <td className="px-3 py-2 tabular-nums">{money(c.prices.USD, 'USD')}</td>
                  <td className="px-3 py-2">{cell('stripe')}</td>
                  <td className="px-3 py-2">{cell('paypal')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AdminBillingActions missing={missing} anyProvider={ready.stripe || ready.paypal} elevenLabs={el.ok} voices={v?.count ?? 0} refreshedAt={v?.refreshed_at ?? null} />

      <h2 className="mb-2 mt-10">Narration margins</h2>
      <p className="mb-3 max-w-prose text-[14px] text-ink-muted">Income from narration add-ons and top-ups against what ElevenLabs charged for the chapters narrated. Before card fees; pounds counted at ${GBP_USD_RATE} to be safe.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Margin title="Last 30 days" m={m30} />
        <Margin title="All time" m={mAll} />
      </div>
      <section className="panel mt-4 p-4 text-[14px]">
        <h3 className="mb-2">Narration subscribers</h3>
        <ul className="grid gap-1 sm:grid-cols-3">
          {NARRATION_TIER_ORDER.map((t) => <li key={t}>{NARRATION_TIERS[t].name}: <span className="font-medium tabular-nums">{mAll.subscribers[t]}</span></li>)}
        </ul>
        <p className="mt-2 text-ink-muted">Unused top-up credits held by authors: {mAll.topupCreditsOutstanding.toLocaleString('en-GB')} (up to {usd((mAll.topupCreditsOutstanding / 1000) * USD_PER_1K_CHARS.turbo)} of future ElevenLabs cost).</p>
      </section>
    </main>
  );
}
