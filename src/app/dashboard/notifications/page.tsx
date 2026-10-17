'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { api } from '@/lib/client';
import { timeAgo } from '@/lib/activity';
import { Button, PageHeader } from '@/components/ui';

type N = { id: string; category: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string };
const TABS = [['all', 'All'], ['unread', 'Unread'], ['books', 'Books'], ['ai', 'AI'], ['billing', 'Billing'], ['system', 'System']] as const;

export default function NotificationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<string>('all');
  const [items, setItems] = useState<N[] | null>(null);
  const load = useCallback(() => api<{ notifications: N[] }>(`/api/notifications?category=${tab}`).then((r) => setItems(r.notifications)), [tab]);
  useEffect(() => { load(); }, [load]);

  async function readAll() {
    await api('/api/notifications', { method: 'PATCH', body: {} });
    load();
    router.refresh();
  }
  async function open(n: N) {
    if (!n.read_at) await api('/api/notifications', { method: 'PATCH', body: { ids: [n.id] } });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title="Notifications" actions={<Button variant="secondary" size="sm" onClick={readAll}>Mark all as read</Button>} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map(([k, l]) => <button key={k} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {items === null ? (
        <p className="text-ink-muted">Loading…</p>
      ) : !items.length ? (
        <p className="text-ink-muted">{tab === 'unread' ? 'You’re all caught up.' : 'No notifications here yet.'}</p>
      ) : (
        <ul className="panel divide-y divide-line">
          {items.map((n) => {
            const inner = (
              <>
                <span className={clsx('mt-2 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-cloth')} aria-label={n.read_at ? undefined : 'Unread'} />
                <span className="min-w-0 flex-1">
                  <span className={clsx('block', !n.read_at && 'font-medium')}>{n.title}</span>
                  {n.body && <span className="block text-[14px] text-ink-muted">{n.body}</span>}
                </span>
                <span className="shrink-0 text-[12px] text-ink-muted">{timeAgo(n.created_at)}</span>
              </>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} onClick={() => open(n)} className="flex gap-3 px-4 py-3 hover:bg-ground/60">{inner}</Link>
                ) : (
                  <button onClick={() => open(n).then(load)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-ground/60">{inner}</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
