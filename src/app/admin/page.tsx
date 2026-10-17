import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getViewer } from '@/lib/data';
import { createAdminClient } from '@/lib/supabase/admin';
import { Queue } from './queue';

export const metadata = { title: 'Publishing queue' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { profile } = await getViewer();
  if (profile.role !== 'admin') notFound();
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from('submissions')
    .select('*, books(id,title,genre,trim_size,page_count)')
    .order('created_at', { ascending: false })
    .limit(200);
  const { data: people } = await admin.from('profiles').select('id,email,full_name,pen_name').in('id', [...new Set((subs ?? []).map((s) => s.user_id))]);
  const { data: covers } = await admin.from('covers').select('book_id,front_path,wrap_path').in('book_id', (subs ?? []).map((s) => s.book_id));
  const paths = (covers ?? []).flatMap((c) => [c.front_path, c.wrap_path]).filter(Boolean) as string[];
  const signed = paths.length ? (await admin.storage.from('covers').createSignedUrls(paths, 3600)).data ?? [] : [];
  const url = (p?: string | null) => (p ? signed.find((s) => s.path === p)?.signedUrl : undefined);
  const rows = (subs ?? []).map((s) => {
    const c = covers?.find((x) => x.book_id === s.book_id);
    return { ...s, profiles: people?.find((p) => p.id === s.user_id) ?? null, frontUrl: url(c?.front_path), wrapUrl: url(c?.wrap_path) };
  });
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8">
      <Link href="/dashboard" className="text-[13px] text-ink-muted">Back to dashboard</Link>
      <h1 className="mb-6 mt-1">Publishing queue</h1>
      <Queue rows={rows} />
    </main>
  );
}
