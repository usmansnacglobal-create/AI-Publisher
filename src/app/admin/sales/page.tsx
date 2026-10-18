import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getViewer } from '@/lib/data';
import { createAdminClient } from '@/lib/supabase/admin';
import { SalesAdmin } from './client';

export const metadata = { title: 'Sales data' };
export const dynamic = 'force-dynamic';

export default async function AdminSales() {
  const { profile } = await getViewer();
  if (profile.role !== 'admin') notFound();
  const admin = createAdminClient();
  const [{ data: books }, { data: recent }] = await Promise.all([
    admin.from('books').select('id,title,user_id').order('title').limit(2000),
    admin.from('sales').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  const owners = [...new Set((books ?? []).map((b) => b.user_id))];
  const { data: people } = owners.length ? await admin.from('profiles').select('id,email').in('id', owners) : { data: [] };
  const list = (books ?? []).map((b) => ({ id: b.id, title: b.title, email: people?.find((p) => p.id === b.user_id)?.email ?? '' }));
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8">
      <div className="flex flex-wrap gap-4 text-[13px] text-ink-muted"><Link href="/admin">Publishing queue</Link><Link href="/admin/print">Print orders</Link><Link href="/admin/support">Support inbox</Link></div>
      <h1 className="mb-1 mt-1">Sales data</h1>
      <p className="mb-6 text-ink-muted">Add each month’s sales from the stores’ reports (KDP, IngramSpark, Draft2Digital, ACX…). Authors see them in Performance Analytics and get a notification.</p>
      <SalesAdmin books={list} recent={(recent ?? []).map((r) => ({ ...r, title: list.find((b) => b.id === r.book_id)?.title ?? 'Deleted book' }))} />
    </main>
  );
}
