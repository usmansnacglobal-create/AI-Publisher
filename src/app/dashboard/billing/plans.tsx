'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { Check, CreditCard, Mic } from 'lucide-react';
import type { Plan } from '@/lib/plans';
import type { NarrationStatus } from '@/lib/narration';
import {
  CURRENCIES, NARRATION_TIERS, NARRATION_TIER_ORDER, QUALITIES, TOPUP, catalogEntry, hoursFor, money,
  type CatalogItem, type Currency,
} from '@/lib/pricing';
import { api, errorText } from '@/lib/client';
import { Badge, Button, Modal, Progress } from '@/components/ui';
import { useToast } from '@/components/toast';

type Provider = 'stripe' | 'paypal';
type Availability = Record<Currency, Record<CatalogItem, Provider[]>>;
type Buying = { item: CatalogItem; title: string; price: number; recurring: boolean; note: string };

const fmt = (n: number) => n.toLocaleString('en-GB');
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export function Billing(props: {
  current: string; status: string; periodEnd: string; mainProvider: Provider | null; hasCard: boolean; bookCount: number; plans: Plan[];
  narration: NarrationStatus; currency: Currency; locked: Currency | null; availability: Availability;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [currency, setCurrency] = useState<Currency>(props.currency);
  const [buying, setBuying] = useState<Buying | null>(null);
  const [cancelling, setCancelling] = useState<'plan' | 'narration' | null>(null);
  const [busy, setBusy] = useState('');
  const confirmed = useRef(false);

  // Coming back from Stripe or PayPal: confirm the payment so the plan or credits update straight away.
  useEffect(() => {
    const kind = params.get('checkout');
    if (!kind || confirmed.current) return;
    confirmed.current = true;
    const body =
      kind === 'stripe' && params.get('session_id') ? { provider: 'stripe', sessionId: params.get('session_id') }
      : kind === 'paypal' && params.get('subscription_id') ? { provider: 'paypal', subscriptionId: params.get('subscription_id') }
      : kind === 'paypal-topup' && params.get('token') ? { provider: 'paypal-topup', orderId: params.get('token') }
      : null;
    if (kind === 'cancelled') toast('Payment cancelled. Nothing was charged.');
    if (!body) return router.replace('/dashboard/billing');
    setBusy('confirming');
    api<{ item: CatalogItem }>('/api/billing/confirm', { body })
      .then((r) => toast(r.item === 'topup' ? `${fmt(TOPUP.credits)} narration credits added` : `Thank you. ${catalogEntry(r.item)?.name ?? 'Your subscription'} is active.`))
      .catch((e) => toast(errorText(e), 'error'))
      .finally(() => {
        setBusy('');
        router.replace('/dashboard/billing');
        router.refresh();
      });
  }, [params, router, toast]);

  async function chooseCurrency(c: Currency) {
    if (props.locked && c !== props.locked) return toast(`Your subscriptions are billed in ${props.locked === 'GBP' ? 'pounds' : 'dollars'}. You can switch once they’ve ended.`, 'error');
    setCurrency(c);
    document.cookie = `currency=${c}; path=/; max-age=31536000; samesite=lax`;
    api('/api/billing/currency', { method: 'PUT', body: { currency: c } }).catch(() => {});
  }

  async function cancel(what: 'plan' | 'narration', resume = false) {
    setBusy(`cancel-${what}`);
    try {
      await api('/api/billing/cancel', { body: { what, resume } });
      toast(resume ? 'Your subscription will renew as normal.' : 'Cancelled. You keep everything until the end of the period you paid for.');
      setCancelling(null);
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  async function manageCard() {
    setBusy('portal');
    try {
      const { url } = await api<{ url: string }>('/api/billing/stripe/portal', { body: {} });
      window.location.href = url;
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy('');
    }
  }

  const n = props.narration;
  const rank: Record<string, number> = { free: 0, pro: 1, agency: 2 };
  const until = day(props.periodEnd);

  return (
    <>
      {busy === 'confirming' && <p className="mb-4 rounded-md border border-line bg-sheet px-4 py-3 text-[14px]" aria-live="polite">Confirming your payment…</p>}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-[14px] text-ink-muted" id="currency-label">Prices in</span>
        <div className="inline-flex rounded border border-line-strong p-0.5" role="radiogroup" aria-labelledby="currency-label">
          {(['GBP', 'USD'] as Currency[]).map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={currency === c}
              onClick={() => chooseCurrency(c)}
              disabled={!!props.locked && props.locked !== c}
              className={clsx('rounded-sm px-3 py-1 text-[14px] font-medium disabled:opacity-40', currency === c ? 'bg-cloth text-white' : 'text-ink-soft hover:bg-ink/5')}
            >
              {CURRENCIES[c].label}
            </button>
          ))}
        </div>
        {props.locked && <span className="text-[13px] text-ink-muted">Fixed while you have a subscription.</span>}
        {props.hasCard && (
          <Button size="sm" variant="ghost" onClick={manageCard} loading={busy === 'portal'} className="ml-auto">
            <CreditCard className="h-4 w-4" />Update card & invoices
          </Button>
        )}
      </div>

      {/* ───────────── Main plan ───────────── */}
      <h2 className="mb-1">Your plan</h2>
      <p className="mb-4 text-[14px] text-ink-muted">Writing, editing, covers, publishing tools and AI tokens.</p>
      {props.status === 'past_due' && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger-light px-4 py-3 text-[14px]">Your last payment didn’t go through. Update your payment method to keep your plan.</p>
      )}
      {props.status === 'cancelled' && props.current !== 'free' && (
        <p className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-gilt/40 bg-gilt-light px-4 py-3 text-[14px]">
          Your plan won’t renew. You keep it until {until}, then move to Free. Your books stay safe.
          {props.mainProvider === 'stripe' && <Button size="sm" variant="secondary" onClick={() => cancel('plan', true)} loading={busy === 'cancel-plan'}>Keep my plan</Button>}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {props.plans.map((p) => {
          const isCurrent = p.id === props.current;
          const tooMany = p.bookLimit !== null && props.bookCount > p.bookLimit;
          const price = p.prices[currency];
          return (
            <section key={p.id} className={clsx('panel flex flex-col p-5', isCurrent && 'border-cloth ring-1 ring-cloth')}>
              <div className="flex items-center justify-between">
                <h3>{p.name}</h3>
                {isCurrent && <Badge tone="cloth">Your plan</Badge>}
              </div>
              <p className="mt-2 font-serif text-[2rem] leading-none">{money(price, currency)}<span className="ml-1 font-sans text-[14px] text-ink-muted">/ month</span></p>
              <ul className="mt-4 flex-1 space-y-2 text-[14px]">
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cloth" />{f}</li>)}
              </ul>
              <div className="mt-5">
                {isCurrent ? (
                  props.current !== 'free' && props.status !== 'cancelled' ? (
                    <>
                      <p className="mb-2 text-[13px] text-ink-muted">Renews {until}{props.mainProvider ? ` · ${props.mainProvider === 'stripe' ? 'card' : 'PayPal'}` : ''}</p>
                      <Button variant="secondary" size="sm" onClick={() => setCancelling('plan')}>Cancel plan</Button>
                    </>
                  ) : (
                    <p className="text-[13px] text-ink-muted">{props.current === 'free' ? 'Free forever' : `Ends ${until}`}</p>
                  )
                ) : p.id === 'free' ? (
                  <p className="text-[13px] text-ink-muted">{props.current !== 'free' ? 'Cancel your plan to return to Free at the end of the period.' : ''}</p>
                ) : (
                  <>
                    <Button
                      className="w-full"
                      variant={rank[p.id] > rank[props.current] ? 'primary' : 'secondary'}
                      disabled={tooMany}
                      onClick={() => setBuying({ item: `plan:${p.id}` as CatalogItem, title: `${p.name} plan`, price, recurring: true, note: 'Your AI tokens reset with each payment.' })}
                    >
                      {rank[p.id] > rank[props.current] ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                    </Button>
                    {tooMany && <p className="mt-2 text-[12px] text-ink-muted">You have {props.bookCount} books; {p.name} allows {p.bookLimit}.</p>}
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* ───────────── Narration add-on ───────────── */}
      <div className="mb-1 mt-12 flex items-center gap-2"><Mic className="h-5 w-5 text-cloth" aria-hidden /><h2>Audiobook narration add-on</h2></div>
      <p className="mb-4 max-w-prose text-[14px] text-ink-muted">
        Premium narrators from the ElevenLabs voice library, on any plan. Narration uses credits: {QUALITIES.turbo.label} uses 1 credit per character and {QUALITIES.standard.label} uses 2. Monthly credits reset with each payment; top-up credits never expire.
      </p>

      {(n.tier || n.topupCredits > 0) && (
        <section className="panel mb-4 space-y-3 p-5 text-[14px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3>{n.tierName ?? 'Top-up credits'}</h3>
            {n.status === 'active' && <Badge tone="cloth">Active</Badge>}
            {n.status === 'cancelled' && <Badge tone="gilt">Ends {day(n.periodEnd)}</Badge>}
            {n.status === 'past_due' && <Badge tone="danger">Payment failed</Badge>}
          </div>
          {n.tier && (
            <>
              <div className="flex justify-between"><span>Monthly credits left</span><span className="tabular-nums">{fmt(n.allowanceRemaining)} of {fmt(n.allowance)}</span></div>
              <Progress value={(n.usedThisPeriod / Math.max(1, n.allowance)) * 100} tone={n.allowanceRemaining / Math.max(1, n.allowance) < 0.2 ? 'gilt' : 'cloth'} label="Monthly narration credits used" />
            </>
          )}
          <div className="flex justify-between"><span>Top-up credits</span><span className="tabular-nums">{fmt(n.topupCredits)}</span></div>
          <p className="text-ink-muted">
            {fmt(n.available)} credits available: {hoursFor(n.available, 'turbo')} of audio in Turbo
            {n.qualities.includes('standard') ? `, or ${hoursFor(n.available, 'standard')} in Standard` : ''}.
            {n.tier && n.status === 'active' && n.periodEnd ? ` Monthly credits reset on ${day(n.periodEnd)}${n.provider ? ` (${n.provider === 'stripe' ? 'card' : 'PayPal'})` : ''}.` : ''}
          </p>
          {n.tier && (
            <div className="flex flex-wrap gap-2">
              {n.status === 'cancelled' ? (
                n.provider === 'stripe' && <Button size="sm" variant="secondary" onClick={() => cancel('narration', true)} loading={busy === 'cancel-narration'}>Keep my add-on</Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setCancelling('narration')}>Cancel add-on</Button>
              )}
            </div>
          )}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {NARRATION_TIER_ORDER.map((id) => {
          const t = NARRATION_TIERS[id];
          const isCurrent = n.tier === id && n.status !== 'none';
          const price = t.prices[currency];
          const up = NARRATION_TIER_ORDER.indexOf(id) > (n.tier ? NARRATION_TIER_ORDER.indexOf(n.tier) : -1);
          return (
            <section key={id} className={clsx('panel flex flex-col p-5', isCurrent && 'border-cloth ring-1 ring-cloth')}>
              <div className="flex items-center justify-between gap-2">
                <h3>{t.name}</h3>
                {isCurrent ? <Badge tone="cloth">Your add-on</Badge> : t.qualities.includes('standard') && <Badge tone="gilt">Standard quality</Badge>}
              </div>
              <p className="mt-2 font-serif text-[2rem] leading-none">{money(price, currency)}<span className="ml-1 font-sans text-[14px] text-ink-muted">/ month</span></p>
              <ul className="mt-4 flex-1 space-y-2 text-[14px]">
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cloth" />{fmt(t.credits)} credits a month</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cloth" />{hoursFor(t.credits, 'turbo')} of audio in Turbo{t.qualities.includes('standard') ? `, or ${hoursFor(t.credits, 'standard')} in Standard` : ''}</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cloth" />{t.qualities.includes('standard') ? 'Choose Turbo or Standard for each book' : 'Turbo quality'}</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cloth" />Hundreds of library voices with samples</li>
              </ul>
              <p className="mt-3 text-[12px] text-ink-muted">{t.blurb}</p>
              <div className="mt-4">
                {isCurrent ? (
                  <p className="text-[13px] text-ink-muted">{n.status === 'cancelled' ? `Ends ${day(n.periodEnd)}` : `Renews ${day(n.periodEnd)}`}</p>
                ) : (
                  <Button
                    className="w-full"
                    variant={up ? 'primary' : 'secondary'}
                    onClick={() => setBuying({ item: `narration:${id}` as CatalogItem, title: t.name, price, recurring: true, note: `${fmt(t.credits)} narration credits each month.${n.tier ? ' Your current add-on stops when this one starts.' : ''}` })}
                  >
                    {n.tier ? (up ? `Upgrade to ${t.name}` : `Switch to ${t.name}`) : `Add ${t.name}`}
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="panel mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="text-[14px]">
          <h3>Top-up: {fmt(TOPUP.credits)} credits for {money(TOPUP.prices[currency], currency)}</h3>
          <p className="mt-1 text-ink-muted">One payment, no subscription. Used after your monthly credits run out, and they never expire. Without a narration add-on, top-up credits narrate in Turbo.</p>
        </div>
        <Button variant="secondary" onClick={() => setBuying({ item: 'topup', title: 'Narration top-up', price: TOPUP.prices[currency], recurring: false, note: `${fmt(TOPUP.credits)} credits that never expire.` })}>Buy a top-up</Button>
      </section>

      <Modal open={!!buying} onClose={() => setBuying(null)} title={buying ? `${buying.title}: ${money(buying.price, currency)}${buying.recurring ? ' a month' : ''}` : ''}>
        {buying && <PayChoice buying={buying} currency={currency} providers={props.availability[currency][buying.item]} />}
      </Modal>
      <Modal open={cancelling === 'plan'} onClose={() => setCancelling(null)} title="Cancel your plan?">
        <div className="space-y-4 text-[14px]">
          <p>You keep everything in your current plan until {until}. After that you move to Free: your books stay, but you can only create new ones within the Free limit and get 30,000 AI tokens a month. Your narration add-on isn’t affected.</p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => cancel('plan')} loading={busy === 'cancel-plan'}>Cancel plan</Button>
            <Button variant="secondary" onClick={() => setCancelling(null)}>Keep my plan</Button>
          </div>
        </div>
      </Modal>
      <Modal open={cancelling === 'narration'} onClose={() => setCancelling(null)} title="Cancel your narration add-on?">
        <div className="space-y-4 text-[14px]">
          <p>You can keep narrating with this month’s credits until {day(n.periodEnd)}. After that, monthly credits stop; any top-up credits stay with you. Chapters you’ve narrated are kept.</p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => cancel('narration')} loading={busy === 'cancel-narration'}>Cancel add-on</Button>
            <Button variant="secondary" onClick={() => setCancelling(null)}>Keep my add-on</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function PayChoice({ buying, currency, providers }: { buying: Buying; currency: Currency; providers: Provider[] }) {
  const toast = useToast();
  const [going, setGoing] = useState<Provider | null>(null);

  async function pay(provider: Provider) {
    setGoing(provider);
    try {
      const { url } = await api<{ url: string }>('/api/billing/checkout', { body: { item: buying.item, currency, provider } });
      window.location.href = url;
    } catch (e) {
      toast(errorText(e), 'error');
      setGoing(null);
    }
  }

  if (!providers.length) return <p className="text-[14px] text-danger">Payments for this aren’t set up yet. The site owner needs to finish Billing setup.</p>;
  return (
    <div className="space-y-4 text-[14px]">
      <p className="text-ink-muted">
        {buying.recurring ? `You’ll be charged ${money(buying.price, currency)} now and every month until you cancel. ` : `One payment of ${money(buying.price, currency)}. `}
        {buying.note}
      </p>
      <div className="flex flex-col gap-2">
        {providers.includes('stripe') && (
          <Button onClick={() => pay('stripe')} loading={going === 'stripe'} disabled={!!going}><CreditCard className="h-4 w-4" />Pay by card</Button>
        )}
        {providers.includes('paypal') && (
          <Button variant="secondary" onClick={() => pay('paypal')} loading={going === 'paypal'} disabled={!!going}>Pay with PayPal</Button>
        )}
      </div>
      <p className="text-[12px] text-ink-muted">You’ll finish paying on {providers.length > 1 ? 'Stripe’s or PayPal’s' : providers[0] === 'stripe' ? 'Stripe’s' : 'PayPal’s'} secure page, then come straight back here.</p>
    </div>
  );
}
