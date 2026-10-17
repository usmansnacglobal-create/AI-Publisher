import { getSubscription, planForPayPalPlan, verifyWebhook } from '@/lib/paypal';
import { createAdminClient } from '@/lib/supabase/admin';
import { logActivity, notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

interface Event {
  event_type: string;
  resource: {
    id: string;
    billing_agreement_id?: string;
    amount?: { total?: string; currency?: string; value?: string; currency_code?: string };
    plan_id?: string;
    billing_info?: { next_billing_time?: string };
  };
}

/** PayPal tells us about renewals, failed payments and cancellations here. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await verifyWebhook(req.headers, raw).catch(() => false))) return new Response('invalid signature', { status: 400 });
  const evt = JSON.parse(raw) as Event;
  const admin = createAdminClient();
  const subId = evt.resource.billing_agreement_id ?? evt.resource.id;
  const { data: profile } = await admin.from('profiles').select('id, plan').eq('paypal_subscription_id', subId).maybeSingle();
  if (!profile) return new Response('ok'); // not ours, or an old subscription

  switch (evt.event_type) {
    case 'PAYMENT.SALE.COMPLETED': {
      const amt = evt.resource.amount;
      await admin.from('payments').upsert(
        { user_id: profile.id, paypal_id: evt.resource.id, amount: Number(amt?.total ?? amt?.value ?? 0), currency: amt?.currency ?? amt?.currency_code ?? 'USD', description: `${profile.plan} plan`, status: 'completed' },
        { onConflict: 'paypal_id' },
      );
      const sub = await getSubscription(subId);
      const end = sub.billing_info?.next_billing_time;
      await admin
        .from('profiles')
        .update({ plan_status: 'active', current_period_start: new Date().toISOString(), ...(end ? { current_period_end: end } : {}), warned_80_at: null, warned_100_at: null })
        .eq('id', profile.id);
      await logActivity(profile.id, 'billing.payment', { amount: amt?.total ?? amt?.value });
      break;
    }
    case 'BILLING.SUBSCRIPTION.UPDATED':
    case 'BILLING.SUBSCRIPTION.ACTIVATED': {
      const plan = planForPayPalPlan(evt.resource.plan_id ?? '');
      const end = evt.resource.billing_info?.next_billing_time;
      await admin.from('profiles').update({ ...(plan ? { plan } : {}), plan_status: 'active', ...(end ? { current_period_end: end } : {}) }).eq('id', profile.id);
      break;
    }
    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.EXPIRED':
      await admin.from('profiles').update({ plan_status: 'cancelled' }).eq('id', profile.id);
      break;
    case 'BILLING.SUBSCRIPTION.SUSPENDED':
    case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
      await admin.from('profiles').update({ plan_status: 'past_due' }).eq('id', profile.id);
      await notify(profile.id, { pref: 'billing', category: 'billing', title: 'Your payment didn’t go through', body: 'Update your payment method in PayPal to keep your plan.', link: '/dashboard/billing' });
      break;
  }
  return new Response('ok');
}
