import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getViewer } from '@/lib/data';
import { createAdminClient } from '@/lib/supabase/admin';
import { getArticle } from '@/lib/help';
import { timeAgo } from '@/lib/activity';
import { Badge } from '@/components/ui';
import { getBrand } from '@/lib/brand-server';

export const metadata = { title: 'Support inbox' };
export const dynamic = 'force-dynamic';

type Row = { id: string; user_id: string; action: string; details: Record<string, unknown>; created_at: string };

export default async function SupportInbox() {
  const { profile } = await getViewer();
  if (profile.role !== 'admin') notFound();
  const admin = createAdminClient();
  const brand = await getBrand();
  const since = new Date(Date.now() - 60 * 86400_000).toISOString();
  const [{ data: messages }, { data: feedback }] = await Promise.all([
    admin.from('activity_logs').select('*').eq('action', 'support.message').order('created_at', { ascending: false }).limit(100),
    admin.from('activity_logs').select('*').eq('action', 'help.feedback').gte('created_at', since).order('created_at', { ascending: false }).limit(1000),
  ]);
  const msgs = (messages ?? []) as Row[];
  const fb = (feedback ?? []) as Row[];
  const ids = [...new Set(msgs.map((m) => m.user_id))];
  const { data: people } = ids.length ? await admin.from('profiles').select('id,email,full_name,pen_name,plan').in('id', ids) : { data: [] };
  const person = (id: string) => people?.find((p) => p.id === id);

  const unanswered = fb.filter((f) => f.details.kind === 'unanswered');
  const notHelpful = fb.filter((f) => f.details.kind !== 'unanswered' && f.details.helpful === false);
  const votes = new Map<string, { up: number; down: number }>();
  for (const f of fb) {
    if (f.details.kind === 'unanswered' || typeof f.details.helpful !== 'boolean') continue;
    const s = String(f.details.slug);
    const v = votes.get(s) ?? { up: 0, down: 0 };
    if (f.details.helpful) v.up++; else v.down++;
    votes.set(s, v);
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1].down - a[1].down || b[1].up - a[1].up);

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8">
      <Link href="/admin" className="text-[13px] text-ink-muted">Publishing queue</Link>
      <h1 className="mb-1 mt-1">Support inbox</h1>
      <p className="mb-8 text-ink-muted">Messages from authors, and what the help assistant couldn’t answer, so you can improve the guides.</p>

      <section className="mb-10">
        <h2 className="mb-3">Messages <span className="text-ink-muted">({msgs.length})</span></h2>
        {msgs.length ? (
          <ul className="space-y-3">
            {msgs.map((m) => {
              const p = person(m.user_id);
              const email = String(m.details.email ?? p?.email ?? '');
              return (
                <li key={m.id} className="panel p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                    <span className="flex items-center gap-2">
                      <Badge tone="cloth">{String(m.details.topic)}</Badge>
                      <span className="font-medium text-ink">{p?.pen_name || p?.full_name || email}</span>
                      <span className="text-ink-muted">{email} · {p?.plan ?? 'free'} plan</span>
                    </span>
                    <span className="text-ink-muted" title={new Date(m.created_at).toLocaleString('en-GB')}>{timeAgo(m.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-[14px] text-ink">{String(m.details.message)}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                    <span className="text-ink-muted">Sent from {String(m.details.page || 'unknown page')}</span>
                    <a href={`mailto:${email}?subject=${encodeURIComponent(`Re: ${String(m.details.topic)} (${brand.name} support)`)}`} className="rounded border border-line-strong px-3 py-1 hover:border-ink-faint">Reply by email</a>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="panel p-4 text-ink-muted">No messages yet.</p>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-1">Questions the assistant couldn’t answer</h2>
          <p className="mb-3 text-[14px] text-ink-muted">Last 60 days. Add these phrasings to a guide, or write a new one.</p>
          {unanswered.length ? (
            <ul className="panel divide-y divide-line text-[14px]">
              {unanswered.slice(0, 100).map((f) => (
                <li key={f.id} className="flex justify-between gap-3 px-4 py-2"><span>“{String(f.details.question)}”</span><span className="shrink-0 text-ink-muted">{timeAgo(f.created_at)}</span></li>
              ))}
            </ul>
          ) : (
            <p className="panel p-4 text-ink-muted">Nothing yet.</p>
          )}
          {notHelpful.length > 0 && (
            <>
              <h3 className="mb-2 mt-6">Answers marked “not helpful”</h3>
              <ul className="panel divide-y divide-line text-[14px]">
                {notHelpful.slice(0, 50).map((f) => (
                  <li key={f.id} className="px-4 py-2">
                    {f.details.question ? <>“{String(f.details.question)}” → </> : null}
                    <span className="text-ink-muted">{getArticle(String(f.details.slug))?.title ?? String(f.details.slug)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section>
          <h2 className="mb-1">Guide ratings</h2>
          <p className="mb-3 text-[14px] text-ink-muted">Thumbs up and down from the Help Centre and the assistant, last 60 days.</p>
          {ranked.length ? (
            <table className="panel w-full text-[14px]">
              <thead><tr className="border-b border-line text-left text-ink-muted"><th className="px-4 py-2 font-medium">Guide</th><th className="px-2 py-2 font-medium">Helpful</th><th className="px-4 py-2 font-medium">Not helpful</th></tr></thead>
              <tbody>
                {ranked.map(([slug, v]) => (
                  <tr key={slug} className="border-b border-line last:border-0">
                    <td className="px-4 py-2"><Link href={`/dashboard/help/${slug}`} className="underline">{getArticle(slug)?.title ?? slug}</Link></td>
                    <td className="px-2 py-2">{v.up}</td>
                    <td className="px-4 py-2">{v.down}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="panel p-4 text-ink-muted">No ratings yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
