import { z } from 'zod';
import { handle, json, requireUser } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  const { supabase } = await requireUser();
  const category = new URL(req.url).searchParams.get('category');
  let q = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
  if (category === 'unread') q = q.is('read_at', null);
  else if (category && category !== 'all') q = q.eq('category', category);
  const { data } = await q;
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  return json({ notifications: data ?? [], unread: count ?? 0 });
});

/** Mark some (ids) or all notifications as read. */
export const PATCH = handle(async (req: Request) => {
  const { supabase, user } = await requireUser();
  const { ids } = z.object({ ids: z.array(z.string().uuid()).optional() }).parse(await req.json().catch(() => ({})));
  let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
  if (ids?.length) q = q.in('id', ids);
  await q;
  return json({ ok: true });
});

export const DELETE = handle(async () => {
  const { supabase, user } = await requireUser();
  await supabase.from('notifications').delete().eq('user_id', user.id).not('read_at', 'is', null);
  return json({ ok: true });
});
