import { handle, json, requireUser, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalisePricing } from '@/lib/print-orders';

/** Saves the print pricing (IngramSpark rates, markup and shipping). Admins only. */
export const PUT = handle(async (req: Request) => {
  const { supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) throw new HttpError(403, 'Admins only.');
  const pricing = normalisePricing(((await req.json()) as { pricing?: unknown }).pricing);
  const { error } = await createAdminClient().from('app_settings').upsert({ key: 'print_pricing', value: pricing, updated_at: new Date().toISOString() });
  if (error) throw error;
  return json({ pricing });
});
