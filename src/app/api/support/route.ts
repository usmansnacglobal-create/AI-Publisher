import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { logActivity, notify } from '@/lib/notify';

const Body = z.object({
  topic: z.string().trim().min(1).max(80),
  message: z.string().trim().min(10, 'Please write a little more so we can help.').max(4000),
  page: z.string().max(300).optional().default(''),
});

/** A message from an author to the support team. Admins get it as a notification and in the support inbox. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
  const admin = createAdminClient();

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('action', 'support.message').gte('created_at', since);
  if ((count ?? 0) >= 5) throw new HttpError(429, 'You’ve sent several messages in the last hour. Our team will reply to those first.');

  const { topic, message, page } = parsed.data;
  await logActivity(user.id, 'support.message', { topic, message, page, email: user.email });
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  for (const a of admins ?? []) {
    await notify(a.id, { pref: 'review_ready', category: 'system', title: `Support: ${topic} (${user.email})`, body: message.slice(0, 600), link: '/admin/support' });
  }
  await notify(user.id, { pref: 'review_ready', category: 'system', title: 'We got your message', body: 'Our support team will reply by email or here in your notifications.' });
  return json({ ok: true }, 201);
});
