import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { ORDER_STATUS } from '@/lib/print-orders';
import { notify } from '@/lib/notify';

/** The publishing team updates an order: status, tracking and a note for the author. */
export const PATCH = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) throw new HttpError(403, 'Admins only.');
  const body = z
    .object({ status: z.enum(['awaiting_payment', 'paid', 'in_production', 'shipped', 'delivered', 'cancelled']), tracking: z.string().max(300).optional().default(''), note: z.string().max(2000).optional().default('') })
    .safeParse(await req.json());
  if (!body.success) throw new HttpError(400, body.error.issues[0].message);
  const admin = createAdminClient();
  const { data: order } = await admin.from('print_orders').select('*').eq('id', params.id).single();
  if (!order) throw new HttpError(404, 'Order not found.');
  const { status, tracking, note } = body.data;
  const { data: updated } = await admin
    .from('print_orders')
    .update({ status, tracking, admin_note: note, history: [...(order.history ?? []), { status, at: new Date().toISOString(), ...(note ? { note } : {}) }] })
    .eq('id', order.id)
    .select('*')
    .single();
  if (status !== order.status || tracking !== order.tracking) {
    await notify(order.user_id, {
      pref: 'billing', category: 'billing',
      title: `Print order: ${ORDER_STATUS[status].label}`,
      body: `${order.quantity} × ${order.book_title}. ${ORDER_STATUS[status].note}${tracking ? ` Tracking: ${tracking}` : ''}${note ? ` ${note}` : ''}`,
      link: '/dashboard/print-orders',
    });
  }
  return json({ order: updated });
});
