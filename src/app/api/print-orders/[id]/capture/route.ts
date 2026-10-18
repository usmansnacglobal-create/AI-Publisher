import { handle, json, requireUser, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { capturePayPalOrder, getPayPalOrder } from '@/lib/paypal';
import { logActivity, notify } from '@/lib/notify';

/** Takes the payment once the author approves it in PayPal, then marks the order paid. */
export const POST = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const { data: order } = await supabase.from('print_orders').select('*').eq('id', params.id).single();
  if (!order) throw new HttpError(404, 'Order not found.');
  if (order.status !== 'awaiting_payment') return json({ order });
  if (!order.paypal_order_id) throw new HttpError(400, 'This order is waiting for a payment request from our team.');

  let pp = await getPayPalOrder(order.paypal_order_id);
  if (pp.status === 'APPROVED') pp = await capturePayPalOrder(order.paypal_order_id);
  const unit = pp.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (pp.status !== 'COMPLETED' || capture?.status !== 'COMPLETED') throw new HttpError(402, 'PayPal didn’t complete the payment. Nothing was charged; please try again.');
  if (unit?.custom_id !== order.id || Number(capture.amount.value) !== Number(order.total) || capture.amount.currency_code !== order.currency) {
    throw new HttpError(400, 'The payment doesn’t match this order. Please contact support.');
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data: updated } = await admin
    .from('print_orders')
    .update({ status: 'paid', history: [...(order.history ?? []), { status: 'paid', at: now, note: `PayPal capture ${capture.id}` }] })
    .eq('id', order.id)
    .select('*')
    .single();
  await logActivity(user.id, 'print.paid', { orderId: order.id, total: order.total });
  await notify(user.id, { pref: 'billing', category: 'billing', title: `Print order paid: ${order.quantity} × ${order.book_title}`, body: 'We’ll let you know when your books are printed and shipped.', link: '/dashboard/print-orders' });
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  for (const a of admins ?? []) {
    await notify(a.id, { pref: 'billing', category: 'billing', title: `New paid print order: ${order.quantity} × ${order.book_title}`, body: `$${Number(order.total).toFixed(2)} paid by ${user.email}.`, link: '/admin/print' });
  }
  return json({ order: updated });
});
