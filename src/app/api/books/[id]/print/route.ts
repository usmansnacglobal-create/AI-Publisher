import { handle, json, requireUser, requireBook } from '@/lib/api';
import { getPricing, printReadiness } from '@/lib/print-orders-server';
import { paypalReady } from '@/lib/paypal';

/** What the print-order calculator needs: the book's print spec, readiness, prices and payment set-up. */
export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const [readiness, pricing, { data: orders }, { data: profile }] = await Promise.all([
    printReadiness(book),
    getPricing(),
    supabase.from('print_orders').select('*').eq('book_id', book.id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('full_name, pen_name').eq('id', user.id).single(),
  ]);
  return json({
    book: { id: book.id, title: book.title },
    readiness,
    pricing,
    orders: orders ?? [],
    defaultName: profile?.full_name || profile?.pen_name || '',
    paypal: paypalReady() ? { clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? process.env.PAYPAL_CLIENT_ID ?? '' } : null,
  });
});
