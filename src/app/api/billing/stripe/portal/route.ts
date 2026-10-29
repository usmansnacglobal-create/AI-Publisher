import { handle, json, requireUser, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe, stripeReady } from '@/lib/stripe';

/** Opens Stripe's page where authors update their card and download invoices. */
export const POST = handle(async () => {
  const { user } = await requireUser();
  if (!stripeReady()) throw new HttpError(503, 'Card payments aren’t set up.');
  const { data: p } = await createAdminClient().from('profiles').select('stripe_customer_id').eq('id', user.id).single();
  if (!p?.stripe_customer_id) throw new HttpError(400, 'You haven’t paid by card yet.');
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const s = await stripe().billingPortal.sessions.create({ customer: p.stripe_customer_id, return_url: `${site}/dashboard/billing` });
  return json({ url: s.url });
});
