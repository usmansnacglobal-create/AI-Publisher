import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { lockedCurrency } from '@/lib/billing';
import { createAdminClient } from '@/lib/supabase/admin';

/** Chooses pounds or dollars. Fixed while the author has a paid subscription. */
export const PUT = handle(async (req: Request) => {
  const { user } = await requireUser();
  const { currency } = z.object({ currency: z.enum(['USD', 'GBP']) }).parse(await req.json());
  const locked = await lockedCurrency(user.id);
  if (locked && locked !== currency) {
    throw new HttpError(400, `Your subscriptions are billed in ${locked === 'GBP' ? 'pounds' : 'dollars'}. You can change currency once they've ended.`, 'CURRENCY_LOCKED');
  }
  await createAdminClient().from('profiles').update({ currency }).eq('id', user.id);
  return json({ ok: true, currency });
});
