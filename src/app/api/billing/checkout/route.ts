import { z } from 'zod';
import { handle, json, requireUser } from '@/lib/api';
import { startCheckout } from '@/lib/billing';
import { CATALOG, type CatalogItem } from '@/lib/pricing';

const Body = z.object({
  item: z.enum(CATALOG.map((c) => c.item) as [CatalogItem, ...CatalogItem[]]),
  currency: z.enum(['USD', 'GBP']),
  provider: z.enum(['stripe', 'paypal']),
});

/** Starts a Stripe or PayPal payment and returns the page to send the author to. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireUser();
  const b = Body.parse(await req.json());
  const { url } = await startCheckout({ userId: user.id, email: user.email, ...b });
  return json({ url });
});
