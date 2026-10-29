import 'server-only';
import Stripe from 'stripe';

/** Stripe (card payments). The secret key stays on the server. */
export const stripeReady = () => !!process.env.STRIPE_SECRET_KEY?.trim();

let client: Stripe | null = null;
export function stripe() {
  if (!stripeReady()) throw new Error('Stripe is not configured.');
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { appInfo: { name: 'AI Publisher' } });
  return client;
}

/** The current billing period of a subscription (Stripe keeps it on the subscription's item). */
export function subscriptionPeriod(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const start = item?.current_period_start ?? Math.floor(Date.now() / 1000);
  const end = item?.current_period_end ?? start + 30 * 86400;
  return { start: new Date(start * 1000), end: new Date(end * 1000) };
}

/** Which subscription an invoice belongs to. */
export function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const s = inv.parent?.subscription_details?.subscription;
  if (!s) return null;
  return typeof s === 'string' ? s : s.id;
}

export type { Stripe };
