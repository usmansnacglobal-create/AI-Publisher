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
  const { data: audio } = await admin.from('audiobooks').select('book_id, tracks').in('book_id', (subs ?? []).map((s) => s.book_id));
  const audioPaths = (audio ?? []).flatMap((a) => Object.values((a.tracks ?? {}) as Record<string, { path: string }>).map((t) => t.path));
  const audioSigned = audioPaths.length ? (await admin.storage.from('audio').createSignedUrls(audioPaths, 3600)).data ?? [] : [];
  const rows = (subs ?? []).map((s) => {
    const c = covers?.find((x) => x.book_id === s.book_id);
    const a = audio?.find((x) => x.book_id === s.book_id);
    const tracks = Object.values((a?.tracks ?? {}) as Record<string, { path: string }>).map((t) => audioSigned.find((x) => x.path === t.path)?.signedUrl).filter(Boolean) as string[];
    return { ...s, profiles: people?.find((p) => p.id === s.user_id) ?? null, frontUrl: url(c?.front_path), wrapUrl: url(c?.wrap_path), audioUrls: tracks };
  });
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8">
      <Link href="/dashboard" className="text-[13px] text-ink-muted">Back to dashboard</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center justify-between gap-3"><h1>Publishing queue</h1><Link href="/admin/support" className="rounded border border-line-strong px-3 py-1.5 text-[14px] hover:border-ink-faint">Support inbox</Link></div>
      <Queue rows={rows} />
    </main>
  );
}
