import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPricing, printReadiness } from '@/lib/print-orders-server';
import { quote } from '@/lib/print-orders';
import { createPayPalOrder, paypalReady } from '@/lib/paypal';
import { logActivity, notify } from '@/lib/notify';

const Address = z.object({
  name: z.string().trim().min(2, 'Add the name to deliver to.').max(120),
  line1: z.string().trim().min(3, 'Add the street address.').max(200),
  line2: z.string().trim().max(200).optional().default(''),
  city: z.string().trim().min(2, 'Add the town or city.').max(100),
  region: z.string().trim().max(100).optional().default(''),
  postcode: z.string().trim().min(2, 'Add the postcode or ZIP code.').max(20),
  country: z.string().trim().min(2, 'Add the country.').max(80),
  phone: z.string().trim().max(40).optional().default(''),
});

const Body = z.object({
  bookId: z.string().uuid(),
  format: z.enum(['paperback', 'hardcover']),
  quantity: z.number().int().min(1).max(5000),
  region: z.string().min(1).max(20),
  shipTo: Address,
});

/** Lists the author's print orders. */
export const GET = handle(async () => {
  const { supabase } = await requireUser();
  const { data } = await supabase.from('print_orders').select('*').order('created_at', { ascending: false }).limit(200);
  return json({ orders: data ?? [] });
});

/** Places an order for printed copies. The price is worked out here, never trusted from the browser. */
export const POST = handle(async (req: Request) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
  const { bookId, format, quantity, region, shipTo } = parsed.data;
  const book = await requireBook(supabase, bookId);
  const [ready, pricing] = await Promise.all([printReadiness(book), getPricing()]);
  if (ready.missing[format].length) throw new HttpError(400, `Before ordering, finish these: ${ready.missing[format].join(' ')}`);
  const q = quote({ binding: format, ink: ready.ink, trim: ready.trim, paper: ready.paper, pages: ready.pages, quantity, region }, pricing);
  if (q.problems.length) throw new HttpError(400, q.problems[0]);

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: order, error } = await admin
    .from('print_orders')
    .insert({
      user_id: user.id, book_id: book.id, book_title: book.title, format, ink: ready.ink, trim_size: ready.trim, paper: ready.paper,
      pages: ready.pages, quantity, base_unit_cost: q.baseUnit, unit_price: q.unitPrice, shipping_region: region, shipping_cost: q.shipping,
      total: q.total, currency: pricing.currency, ship_to: shipTo, history: [{ status: 'awaiting_payment', at: now }],
    })
    .select('*')
    .single();
  if (error) throw error;

  let paypalOrderId: string | null = null;
  if (paypalReady()) {
    const pp = await createPayPalOrder({ total: q.total, currency: pricing.currency, customId: order.id, description: `${quantity} × ${format} of "${book.title}"` });
    paypalOrderId = pp.id;
    await admin.from('print_orders').update({ paypal_order_id: pp.id }).eq('id', order.id);
  } else {
    // No online payments yet: the team sends a payment request.
    const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
    for (const a of admins ?? []) {
      await notify(a.id, { pref: 'billing', category: 'billing', title: `Print order (awaiting payment): ${quantity} × ${book.title}`, body: `$${q.total.toFixed(2)} from ${user.email}. Online payments aren’t set up, so send a payment request.`, link: '/admin/print' });
    }
  }
  await logActivity(user.id, 'print.ordered', { orderId: order.id, title: book.title, quantity, total: q.total });
  return json({ order: { ...order, paypal_order_id: paypalOrderId }, paypalOrderId }, 201);
});
