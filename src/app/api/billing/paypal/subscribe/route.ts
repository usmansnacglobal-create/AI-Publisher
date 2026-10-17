import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { cancelSubscription, getSubscription, planForPayPalPlan } from '@/lib/paypal';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlan } from '@/lib/plans';
import { logActivity, notify } from '@/lib/notify';

/** Called after the author approves a subscription in the PayPal window. Verified with PayPal before the plan changes. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireUser();
  const { subscriptionId } = z.object({ subscriptionId: z.string().min(5).max(64) }).parse(await req.json());
  const sub = await getSubscription(subscriptionId);
  if (sub.custom_id !== user.id) throw new HttpError(403, 'This subscription belongs to a different account.');
  if (!['ACTIVE', 'APPROVED'].includes(sub.status)) throw new HttpError(400, 'PayPal has not activated this subscription yet. Refresh in a minute.');
  const planId = planForPayPalPlan(sub.plan_id);
  if (!planId) throw new HttpError(400, 'Unknown plan.');

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('paypal_subscription_id').eq('id', user.id).single();
  if (profile?.paypal_subscription_id && profile.paypal_subscription_id !== sub.id) {
    // Switching plans: stop the old subscription so the author isn't charged twice.
    await cancelSubscription(profile.paypal_subscription_id, 'Switched plan').catch((e) => console.error(e));
  }
  const start = new Date();
  const end = sub.billing_info?.next_billing_time ? new Date(sub.billing_info.next_billing_time) : new Date(start.getTime() + 30 * 86400000);
  await admin
    .from('profiles')
    .update({
      plan: planId,
      plan_status: 'active',
      paypal_subscription_id: sub.id,
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      warned_80_at: null,
      warned_100_at: null,
    })
    .eq('id', user.id);
  await logActivity(user.id, 'billing.subscribed', { plan: planId });
  await notify(user.id, { pref: 'billing', category: 'billing', title: `You're on the ${getPlan(planId).name} plan`, body: `Your next payment is on ${end.toLocaleDateString('en-GB')}.`, link: '/dashboard/billing' });
  return json({ ok: true, plan: planId });
});
