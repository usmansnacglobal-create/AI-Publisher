import Link from 'next/link';
import { getViewer } from '@/lib/data';
import { getPricing } from '@/lib/print-orders-server';
import { ORDER_STATUS } from '@/lib/print-orders';
import { TRIM_SIZES } from '@/lib/spine';
import { Badge, Empty, PageHeader } from '@/components/ui';
import { StandaloneCalculator } from './calculator';

export const metadata = { title: 'Print orders' };
export const dynamic = 'force-dynamic';

type Order = { id: string; book_id: string | null; book_title: string; format: string; quantity: number; total: number; status: string; created_at: string; tracking: string; admin_note: string; trim_size: string; pages: number; ship_to: { city?: string; country?: string } };

export default async function PrintOrdersPage() {
  const { supabase, user } = await getViewer();
  const [pricing, { data: orders }, { data: books }] = await Promise.all([
    getPricing(),
    supabase.from('print_orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('books').select('id,title,trim_size,page_count').eq('user_id', user.id).order('updated_at', { ascending: false }),
  ]);
  const list = (orders ?? []) as Order[];
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Print orders">Order printed copies of your finished books, and follow each order from printing to your door.</PageHeader>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="mb-3 text-[1.15rem]">Your orders</h2>
          {list.length ? (
            <ul className="space-y-3">
              {list.map((o) => (
                <li key={o.id} className="panel p-4 text-[14px]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-ink">{o.quantity} × {o.format} of {o.book_title}</p>
                      <p className="text-ink-muted">
                        {TRIM_SIZES[o.trim_size]?.label ?? o.trim_size}, {o.pages} pages · ${Number(o.total).toFixed(2)} · ordered {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {o.ship_to?.city ? ` · to ${o.ship_to.city}, ${o.ship_to.country ?? ''}` : ''}
                      </p>
                    </div>
                    <Badge tone={o.status === 'delivered' || o.status === 'shipped' ? 'cloth' : o.status === 'cancelled' ? 'neutral' : 'gilt'}>{ORDER_STATUS[o.status]?.label ?? o.status}</Badge>
                  </div>
                  <p className="mt-2 text-ink-soft">{ORDER_STATUS[o.status]?.note}</p>
                  {o.tracking && <p className="mt-1">Tracking: <span className="font-medium">{o.tracking}</span></p>}
                  {o.admin_note && <p className="mt-1 rounded bg-ground px-2 py-1 text-[13px]">Note from our team: {o.admin_note}</p>}
                  {o.book_id && o.status === 'awaiting_payment' && <Link href={`/dashboard/books/${o.book_id}/print`} className="mt-2 inline-block text-cloth underline">Pay or cancel</Link>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No print orders yet">
              When a book’s layout is approved and its cover is exported, open the book’s <strong>Print copies</strong> tab to order printed copies.
            </Empty>
          )}
        </section>
        <StandaloneCalculator pricing={pricing} books={(books ?? []).map((b) => ({ id: b.id, title: b.title, trim: b.trim_size, pages: b.page_count ?? 0 }))} />
      </div>
    </div>
  );
}
