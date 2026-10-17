import { handle, json, requireUser, HttpError } from '@/lib/api';
import { cancelSubscription } from '@/lib/paypal';
import { createAdminClient } from '@/lib/supabase/admin';
import { logActivity, notify } from '@/lib/notify';

/** Cancels renewal. The author keeps their plan until the end of the period they paid for. */
export const POST = handle(async () => {
  const { user } = await requireUser();
  const admin = createAdminClient();
  const { data: p } = await admin.from('profiles').select('plan, paypal_subscription_id, current_period_end').eq('id', user.id).single();
  if (!p?.paypal_subscription_id || p.plan === 'free') throw new HttpError(400, "You don't have a paid plan to cancel.");
  await cancelSubscription(p.paypal_subscription_id, 'Cancelled by author');
  await admin.from('profiles').update({ plan_status: 'cancelled' }).eq('id', user.id);
  const until = new Date(p.current_period_end).toLocaleDateString('en-GB');
  await logActivity(user.id, 'billing.cancelled', {});
  await notify(user.id, { pref: 'billing', category: 'billing', title: 'Your plan is cancelled', body: `You keep your current plan until ${until}, then move to Free. Your books stay safe.`, link: '/dashboard/billing' });
  return json({ ok: true, until: p.current_period_end });
});
