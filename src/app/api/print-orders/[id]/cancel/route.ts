import { handle, json, requireUser, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

/** Authors can cancel an order they haven't paid for yet. */
export const POST = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const { supabase } = await requireUser();
  const { data: order } = await supabase.from('print_orders').select('id,status,history').eq('id', params.id).single();
  if (!order) throw new HttpError(404, 'Order not found.');
  if (order.status !== 'awaiting_payment') throw new HttpError(400, 'Paid orders can’t be cancelled here. Contact support and we’ll help.');
  const { data } = await createAdminClient()
    .from('print_orders')
    .update({ status: 'cancelled', history: [...(order.history ?? []), { status: 'cancelled', at: new Date().toISOString(), note: 'Cancelled by the author' }] })
    .eq('id', order.id)
    .select('*')
    .single();
  return json({ order: data });
});
