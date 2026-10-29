import { getSubscription, verifyWebhook } from '@/lib/paypal';
import { createAdminClient } from '@/lib/supabase/admin';
import { confirmPayPalSubscription, itemForExternal, recordPayment } from '@/lib/billing';
import { narrationRenewed } from '@/lib/narration';
import { catalogEntry } from '@/lib/pricing';
import { logActivity, notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

interface Event {
  event_type: string;
  resource: {
    id: string;
    billing_agreement_id?: string;
    custom_id?: string;
    amount?: { total?: string; currency?: string; value?: string; currency_code?: string };
    plan_id?: string;
    billing_info?: { next_billing_time?: string };
  };
}

/** PayPal tells us about renewals, failed payments and cancellations of plans and narration add-ons here. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await verifyWebhook(req.headers, raw).catch(() => false))) return new Response('invalid signature', { status: 400 });
  const evt = JSON.parse(raw) as Event;
  const admin = createAdminClient();
  const subId = evt.resource.billing_agreement_id ?? evt.resource.id;

  const [{ data: profile }, { data: narration }] = await Promise.all([
    admin.from('profiles').select('id, plan').eq('paypal_subscription_id', subId).maybeSingle(),
    admin.from('narration_accounts').select('user_id, tier').eq('provider', 'paypal').eq('provider_subscription_id', subId).maybeSingle(),
  ]);

  // The author approved in PayPal but never came back to the site: start the subscription now.
  if (!profile && !narration) {
    if (evt.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED' && evt.resource.custom_id) {
      const userId = evt.resource.custom_id.split(':')[0];
      await confirmPayPalSubscription(subId, userId).catch((e) => console.error('PayPal activation from webhook failed', e));
    }
    return new Response('ok'); // not ours, or an old subscription
  }
  const userId = (profile?.id ?? narration?.user_id) as string;
  const table = profile ? 'profiles' : 'narration_accounts';
  const key = profile ? 'paypal_subscription_id' : 'provider_subscription_id';
  const statusCol = profile ? 'plan_status' : 'status';

  switch (evt.event_type) {
    case 'PAYMENT.SALE.COMPLETED': {
      const amt = evt.resource.amount;
      const sub = await getSubscription(subId);
      const what = await itemForExternal('paypal', sub.plan_id);
      const start = new Date();
      const end = sub.billing_info?.next_billing_time ? new Date(sub.billing_info.next_billing_time) : new Date(start.getTime() + 30 * 86400000);
      if (profile) {
        await admin
          .from('profiles')
          .update({ plan_status: 'active', current_period_start: start.toISOString(), current_period_end: end.toISOString(), warned_80_at: null, warned_100_at: null })
          .eq('id', profile.id);
      } else {
        await narrationRenewed(subId, start, end);
      }
      await recordPayment({
        userId, provider: 'paypal', externalId: evt.resource.id,
        amount: Number(amt?.total ?? amt?.value ?? 0), currency: amt?.currency ?? amt?.currency_code ?? 'USD',
        description: what ? catalogEntry(what.item)!.name : `${profile?.plan ?? 'narration'} plan`,
        kind: profile ? 'plan' : 'narration',
      });
      await logActivity(userId, 'billing.payment', { provider: 'paypal', amount: amt?.total ?? amt?.value });
      break;
    }
    case 'BILLING.SUBSCRIPTION.UPDATED':
    case 'BILLING.SUBSCRIPTION.ACTIVATED': {
      const end = evt.resource.billing_info?.next_billing_time;
      const what = evt.resource.plan_id ? await itemForExternal('paypal', evt.resource.plan_id) : null;
      if (profile) {
        const plan = what?.item.startsWith('plan:') ? what.item.slice(5) : null;
        await admin.from('profiles').update({ ...(plan ? { plan } : {}), plan_status: 'active', ...(end ? { current_period_end: end } : {}) }).eq('id', profile.id);
      } else {
        const tier = what?.item.startsWith('narration:') ? what.item.slice(10) : null;
        await admin.from('narration_accounts').update({ ...(tier ? { tier } : {}), status: 'active', ...(end ? { period_end: end } : {}) }).eq('user_id', userId);
      }
      break;
    }
    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.EXPIRED':
      await admin.from(table).update({ [statusCol]: 'cancelled' }).eq(key, subId);
      break;
    case 'BILLING.SUBSCRIPTION.SUSPENDED':
    case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
      await admin.from(table).update({ [statusCol]: 'past_due' }).eq(key, subId);
      await notify(userId, {
        pref: 'billing', category: 'billing', title: 'Your payment didn’t go through',
        body: `Update your payment method in PayPal to keep your ${profile ? 'plan' : 'narration add-on'}.`, link: '/dashboard/billing',
      });
      break;
  }
  return new Response('ok');
}
