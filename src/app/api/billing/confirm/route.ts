import { z } from 'zod';
import { handle, json, requireUser } from '@/lib/api';
import { capturePayPalTopup, confirmPayPalSubscription, confirmStripeSession } from '@/lib/billing';

const Body = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('stripe'), sessionId: z.string().min(5).max(255) }),
  z.object({ provider: z.literal('paypal'), subscriptionId: z.string().min(5).max(64) }),
  z.object({ provider: z.literal('paypal-topup'), orderId: z.string().min(5).max(64) }),
]);

/**
 * Called when the author comes back from Stripe or PayPal, so their plan or
 * credits update straight away. Webhooks do the same in the background; both are safe to repeat.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireUser();
  const b = Body.parse(await req.json());
  const r =
    b.provider === 'stripe'
      ? await confirmStripeSession(b.sessionId, user.id)
      : b.provider === 'paypal'
        ? await confirmPayPalSubscription(b.subscriptionId, user.id)
        : await capturePayPalTopup(b.orderId, user.id);
  return json({ ok: true, item: r.item });
});
