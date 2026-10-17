'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import type { Plan } from '@/lib/plans';
import { api, errorText } from '@/lib/client';
import { Badge, Button, Modal } from '@/components/ui';
import { useToast } from '@/components/toast';

declare global {
  interface Window {
    paypal?: {
      Buttons: (o: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void>; close: () => void };
    };
  }
}

export function Plans({ userId, current, status, periodEnd, bookCount, plans, paypal }: {
  userId: string; current: string; status: string; periodEnd: string; bookCount: number; plans: Plan[];
  paypal: { clientId: string; planIds: Record<string, string> };
}) {
  const router = useRouter();
  const toast = useToast();
  const [buying, setBuying] = useState<Plan | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const until = new Date(periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const rank = { free: 0, pro: 1, agency: 2 } as Record<string, number>;

  async function cancel() {
    setBusy(true);
    try {
      await api('/api/billing/paypal/cancel', { body: {} });
      toast(`Cancelled. You keep your plan until ${until}.`);
      setCancelOpen(false);
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy(false);
  }

  return (
    <>
      {status === 'past_due' && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger-light px-4 py-3 text-[14px]">Your last payment didn’t go through. Update your payment method in PayPal to keep your plan.</p>
      )}
      {status === 'cancelled' && current !== 'free' && (
        <p className="mb-4 rounded-md border border-gilt/40 bg-gilt-light px-4 py-3 text-[14px]">Your plan won’t renew. You keep it until {until}, then move to Free. Your books stay safe.</p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.id === current;
          const tooMany = p.bookLimit !== null && bookCount > p.bookLimit;
          return (
            <section key={p.id} className={clsx('panel flex flex-col p-5', isCurrent && 'border-cloth ring-1 ring-cloth')}>
              <div className="flex items-center justify-between">
                <h2>{p.name}</h2>
                {isCurrent && <Badge tone="cloth">Your plan</Badge>}
              </div>
              <p className="mt-2 font-serif text-[2rem] leading-none">${p.priceMonthly}<span className="ml-1 font-sans text-[14px] text-ink-muted">/ month</span></p>
              <ul className="mt-4 flex-1 space-y-2 text-[14px]">
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cloth" />{f}</li>)}
              </ul>
              <div className="mt-5">
                {isCurrent ? (
                  current !== 'free' && status !== 'cancelled' ? (
                    <>
                      <p className="mb-2 text-[13px] text-ink-muted">Renews {until}</p>
                      <Button variant="secondary" size="sm" onClick={() => setCancelOpen(true)}>Cancel plan</Button>
                    </>
                  ) : (
                    <p className="text-[13px] text-ink-muted">{current === 'free' ? 'Free forever' : `Ends ${until}`}</p>
                  )
                ) : p.id === 'free' ? (
                  <p className="text-[13px] text-ink-muted">{current !== 'free' ? 'Cancel your plan to return to Free at the end of the period.' : ''}</p>
                ) : (
                  <>
                    <Button className="w-full" variant={rank[p.id] > rank[current] ? 'primary' : 'secondary'} disabled={tooMany} onClick={() => setBuying(p)}>
                      {rank[p.id] > rank[current] ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                    </Button>
                    {tooMany && <p className="mt-2 text-[12px] text-ink-muted">You have {bookCount} books; {p.name} allows {p.bookLimit}.</p>}
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Modal open={!!buying} onClose={() => setBuying(null)} title={buying ? `${buying.name} plan, $${buying.priceMonthly} a month` : ''}>
        {buying && <PayPalCheckout plan={buying} userId={userId} paypal={paypal} onDone={() => { setBuying(null); router.refresh(); }} />}
      </Modal>
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel your plan?">
        <div className="space-y-4 text-[14px]">
          <p>You keep everything in your current plan until {until}. After that you move to Free: your books stay, but you can only create new ones within the Free limit and get 30,000 AI tokens a month.</p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={cancel} loading={busy}>Cancel plan</Button>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep my plan</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function PayPalCheckout({ plan, userId, paypal, onDone }: { plan: Plan; userId: string; paypal: { clientId: string; planIds: Record<string, string> }; onDone: () => void }) {
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'confirming' | 'error'>('loading');
  const planId = paypal.planIds[plan.id];

  useEffect(() => {
    if (!paypal.clientId || !planId) return setState('error');
    let buttons: { close: () => void } | null = null;
    const ready = () => {
      if (!window.paypal || !ref.current) return;
      const b = window.paypal.Buttons({
        style: { layout: 'vertical', label: 'subscribe' },
        createSubscription: (_: unknown, actions: { subscription: { create: (o: unknown) => Promise<string> } }) =>
          actions.subscription.create({ plan_id: planId, custom_id: userId, application_context: { shipping_preference: 'NO_SHIPPING' } }),
        onApprove: async (data: { subscriptionID: string }) => {
          setState('confirming');
          try {
            await api('/api/billing/paypal/subscribe', { body: { subscriptionId: data.subscriptionID } });
            toast(`Welcome to ${plan.name}`);
            onDone();
          } catch (e) {
            toast(errorText(e), 'error');
            setState('ready');
          }
        },
        onError: () => toast('PayPal couldn’t complete the payment. Nothing was charged.', 'error'),
      });
      buttons = b;
      b.render(ref.current).then(() => setState('ready'));
    };
    const id = 'paypal-sdk';
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing && window.paypal) ready();
    else {
      const s = existing ?? document.createElement('script');
      s.id = id;
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypal.clientId)}&vault=true&intent=subscription`;
      s.onload = ready;
      s.onerror = () => setState('error');
      if (!existing) document.body.appendChild(s);
    }
    return () => buttons?.close();
  }, [paypal.clientId, planId, plan.name, userId, onDone, toast]);

  if (state === 'error')
    return <p className="text-[14px] text-danger">Payments aren’t set up yet. The site owner needs to add the PayPal settings.</p>;
  return (
    <div className="space-y-3 text-[14px]">
      <p className="text-ink-muted">You’ll be charged ${plan.priceMonthly} now and every month until you cancel. Your AI tokens reset with each payment.</p>
      {state === 'loading' && <p className="text-ink-muted">Loading PayPal…</p>}
      {state === 'confirming' && <p aria-live="polite">Confirming with PayPal…</p>}
      <div ref={ref} className={clsx(state === 'confirming' && 'pointer-events-none opacity-50')} />
    </div>
  );
}
