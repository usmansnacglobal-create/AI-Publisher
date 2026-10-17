import { z } from 'zod';
import { handle, json, requireUser } from '@/lib/api';
import { logActivity } from '@/lib/notify';

/** Records security events done in the browser (2FA and password changes). */
export const POST = handle(async (req: Request) => {
  const { user } = await requireUser();
  const { action } = z.object({ action: z.enum(['security.2fa_on', 'security.2fa_off', 'security.password']) }).parse(await req.json());
  await logActivity(user.id, action);
  return json({ ok: true });
});
