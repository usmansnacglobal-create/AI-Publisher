import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getViewer } from '@/lib/data';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPricing } from '@/lib/print-orders-server';
import { paypalReady } from '@/lib/paypal';
import { OrdersAdmin, PricingEditor } from './client';

export const metadata = { title: 'Print orders' };
export const dynamic = 'force-dynamic';

export default async function AdminPrint() {
  const { profile } = await getViewer();
  if (profile.role !== 'admin') notFound();
  const admin = createAdminClient();
  const [{ data: orders }, pricing] = await Promise.all([admin.from('print_orders').select('*').order('created_at', { ascending: false }).limit(300), getPricing()]);
  const ids = [...new Set((orders ?? []).map((o) => o.user_id))];
  const { data: people } = ids.length ? await admin.from('profiles').select('id,email,full_name').in('id', ids) : { data: [] };
  const bookIds = [...new Set((orders ?? []).map((o) => o.book_id).filter(Boolean))] as string[];
  const { data: covers } = bookIds.length ? await admin.from('covers').select('book_id,wrap_path').in('book_id', bookIds) : { data: [] };
  const rows = (orders ?? []).map((o) => ({ ...o, email: people?.find((p) => p.id === o.user_id)?.email ?? '', name: people?.find((p) => p.id === o.user_id)?.full_name ?? '', hasCover: !!covers?.find((c) => c.book_id === o.book_id)?.wrap_path }));
  const paid = rows.filter((o) => !['awaiting_payment', 'cancelled'].includes(o.status));
  const revenue = paid.reduce((s, o) => s + Number(o.unit_price) * o.quantity, 0);
  const cost = paid.reduce((s, o) => s + Number(o.base_unit_cost) * o.quantity, 0);
  return (
    <main className="mx-auto max-w-[1180px] px-4 py-8">
      <div className="flex flex-wrap gap-4 text-[13px] text-ink-muted"><Link href="/admin">Publishing queue</Link><Link href="/admin/support">Support inbox</Link><Link href="/admin/sales">Sales data</Link></div>
      <h1 className="mb-1 mt-1">Print orders</h1>
      <p className="mb-6 text-ink-muted">Orders for printed author copies. Place each paid order with IngramSpark (Print &amp; Ship) using the book’s print PDF and cover, then update the status here; the author is notified at each step.</p>
      {!paypalReady() && <p className="mb-6 rounded-md border border-gilt/40 bg-gilt-light px-4 py-3 text-[14px] text-gilt-ink">Online payment isn’t set up (PayPal keys missing in Vercel), so new orders arrive as “Awaiting payment”. Send the author a PayPal payment request, then mark the order paid.</p>}
      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        {[['Orders', String(rows.length)], ['Paid orders', String(paid.length)], ['Printing sales (paid)', `$${revenue.toFixed(2)}`], ['Printing margin (paid)', `$${(revenue - cost).toFixed(2)}`]].map(([l, v]) => (
          <div key={l} className="panel p-3"><p className="text-[13px] text-ink-muted">{l}</p><p className="font-serif text-[1.4rem]">{v}</p></div>
        ))}
      </div>
      <OrdersAdmin rows={rows} />
      <PricingEditor initial={pricing} />
    </main>
  );
}
