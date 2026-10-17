import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelSubscription } from '@/lib/paypal';

/** Permanently deletes the account, every book and every file. */
export const POST = handle(async (req: Request) => {
  const { supabase, user } = await requireUser();
  const { confirm } = z.object({ confirm: z.string() }).parse(await req.json());
  if (confirm !== 'DELETE') throw new HttpError(400, 'Type DELETE to confirm.');
  const admin = createAdminClient();
  const { data: p } = await admin.from('profiles').select('paypal_subscription_id, plan_status').eq('id', user.id).single();
  if (p?.paypal_subscription_id && p.plan_status !== 'cancelled') {
    await cancelSubscription(p.paypal_subscription_id, 'Account deleted').catch((e) => console.error(e));
  }
  for (const bucket of ['covers', 'manuscripts', 'exports', 'avatars']) {
    const { data: folders } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
    for (const f of folders ?? []) {
      const prefix = `${user.id}/${f.name}`;
      const { data: files } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      if (files?.length) await admin.storage.from(bucket).remove(files.map((x) => `${prefix}/${x.name}`));
      await admin.storage.from(bucket).remove([prefix]);
    }
  }
  await supabase.auth.signOut();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;
  return json({ ok: true });
});
