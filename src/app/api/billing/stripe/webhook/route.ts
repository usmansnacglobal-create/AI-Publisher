import { createAdminClient } from '@/lib/supabase/admin';
import { stripe, stripeReady, subscriptionPeriod, invoiceSubscriptionId, type Stripe } from '@/lib/stripe';
import { applyMainPlan, applyNarrationSub, confirmStripeSession, recordPayment } from '@/lib/billing';
import { narrationRenewed } from '@/lib/narration';
import { catalogEntry, isCatalogItem, isCurrency, type NarrationTier } from '@/lib/pricing';
import { HttpError } from '@/lib/api';
import { logActivity, notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/** Which author and what a subscription is for: from our metadata, else from the database. */
async function owner(sub: Stripe.Subscription) {
  const admin = createAdminClient();
  const item = sub.metadata?.item;
  let userId = sub.metadata?.user_id ?? null;
  const [{ data: p }, { data: n }] = await Promise.all([
    admin.from('profiles').select('id').eq('stripe_subscription_id', sub.id).maybeSingle(),
    admin.from('narration_accounts').select('user_id').eq('provider_subscription_id', sub.id).maybeSingle(),
  ]);
  userId ??= p?.id ?? n?.user_id ?? null;
  return { userId, item: isCatalogItem(item) ? item : null, isMain: !!p, isNarration: !!n };
}

/** Stripe tells us about checkouts, renewals, failed payments and cancellations here. */
export async function POST(req: Request) {
  if (!stripeReady() || !process.env.STRIPE_WEBHOOK_SECRET) return new Response('not configured', { status: 503 });
  const raw = await req.text();
  let evt: Stripe.Event;
  try {
    evt = stripe().webhooks.constructEvent(raw, req.headers.get('stripe-signature') ?? '', process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response('invalid signature', { status: 400 });
  }
  const admin = createAdminClient();

  try {
    switch (evt.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = evt.data.object as Stripe.Checkout.Session;
        if (s.metadata?.user_id) await confirmStripeSession(s.id);
        break;
      }

      case 'invoice.paid': {
        const inv = evt.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(inv);
        if (!subId) break;
        const sub = await stripe().subscriptions.retrieve(subId);
        const { userId, item, isMain, isNarration } = await owner(sub);
        if (!userId || !item) break;
        const { start, end } = subscriptionPeriod(sub);
        const currency = (inv.currency ?? '').toUpperCase();
        if (isMain) {
          await admin
            .from('profiles')
            .update({ plan_status: 'active', current_period_start: start.toISOString(), current_period_end: end.toISOString(), warned_80_at: null, warned_100_at: null })
            .eq('stripe_subscription_id', sub.id);
        } else if (isNarration) {
          await narrationRenewed(sub.id, start, end);
        } else if (isCurrency(currency)) {
          // The first payment can arrive before the checkout event: start the subscription now.
          if (item.startsWith('plan:')) await applyMainPlan({ userId, plan: item.slice(5) as 'pro' | 'agency', provider: 'stripe', subscriptionId: sub.id, currency, start, end });
          else if (item.startsWith('narration:')) await applyNarrationSub({ userId, tier: item.slice(10) as NarrationTier, provider: 'stripe', subscriptionId: sub.id, currency, start, end });
        }
        await recordPayment({ userId, provider: 'stripe', externalId: inv.id ?? `${sub.id}-${start.getTime()}`, amount: inv.amount_paid / 100, currency, description: catalogEntry(item)!.name, kind: item.startsWith('plan:') ? 'plan' : 'narration' });
        await logActivity(userId, 'billing.payment', { provider: 'stripe', amount: inv.amount_paid / 100, currency });
        break;
      }

      case 'invoice.payment_failed': {
        const subId = invoiceSubscriptionId(evt.data.object as Stripe.Invoice);
        if (!subId) break;
        const { data: p } = await admin.from('profiles').update({ plan_status: 'past_due' }).eq('stripe_subscription_id', subId).select('id');
        const { data: n } = await admin.from('narration_accounts').update({ status: 'past_due' }).eq('provider_subscription_id', subId).select('user_id');
        const userId = p?.[0]?.id ?? n?.[0]?.user_id;
        if (userId) {
          await notify(userId, { pref: 'billing', category: 'billing', title: 'Your card payment didn’t go through', body: 'Update your card on the Billing page to keep your subscription.', link: '/dashboard/billing' });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = evt.data.object as Stripe.Subscription;
        const status = sub.cancel_at_period_end || sub.cancel_at ? 'cancelled' : ['past_due', 'unpaid'].includes(sub.status) ? 'past_due' : sub.status === 'active' ? 'active' : null;
        if (!status) break;
        const { end } = subscriptionPeriod(sub);
        await admin.from('profiles').update({ plan_status: status, current_period_end: end.toISOString() }).eq('stripe_subscription_id', sub.id);
        await admin.from('narration_accounts').update({ status, period_end: end.toISOString() }).eq('provider_subscription_id', sub.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = evt.data.object as Stripe.Subscription;
        // Only end what this subscription paid for (a switched-from subscription is already replaced).
        await admin
          .from('profiles')
          .update({ plan: 'free', plan_status: 'active', stripe_subscription_id: null, billing_provider: null })
          .eq('stripe_subscription_id', sub.id);
        await admin
          .from('narration_accounts')
          .update({ tier: null, status: 'none', provider_subscription_id: null, period_start: null, period_end: null })
          .eq('provider_subscription_id', sub.id);
        break;
      }
    }
  } catch (e) {
    // Not ready yet (e.g. an unpaid async payment): Stripe will tell us again.
    if (e instanceof HttpError && e.status < 500) return new Response('ok');
    console.error('Stripe webhook failed', evt.type, e);
    return new Response('error', { status: 500 });
  }
  return new Response('ok');
}
