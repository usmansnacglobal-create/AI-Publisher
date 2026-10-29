import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { setupCatalog } from '@/lib/billing';
import { refreshVoiceLibrary } from '@/lib/voice-library';
import { logActivity } from '@/lib/notify';

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) throw new HttpError(403, 'Admins only.');
  return user;
}

/** Admin actions: create every price in Stripe and PayPal, or refresh the ElevenLabs voice library now. */
export const POST = handle(async (req: Request) => {
  const user = await requireAdmin();
  const { action } = z.object({ action: z.enum(['setup', 'refresh-voices']) }).parse(await req.json());
  if (action === 'setup') {
    const r = await setupCatalog();
    await logActivity(user.id, 'admin.billing_setup', { created: r.done.length, errors: r.errors.length });
    return json(r);
  }
  const r = await refreshVoiceLibrary();
  return json(r);
});
