import { getViewer } from '@/lib/data';
import { describeActivity } from '@/lib/activity';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'System Activity Logs' };

export default async function ActivityPage() {
  const { supabase } = await getViewer();
  const { data } = await supabase.from('activity_logs').select('*').not('action', 'like', 'help.%').order('created_at', { ascending: false }).limit(300);
  const groups = new Map<string, NonNullable<typeof data>>();
  for (const a of data ?? []) {
    const k = new Date(a.created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title="System Activity Logs">A record of everything on your account: books, AI work, exports, publishing, billing and security.</PageHeader>
      {!data?.length && <p className="text-ink-muted">Nothing yet.</p>}
      <div className="space-y-8">
        {[...groups.entries()].map(([day, items]) => (
          <section key={day}>
            <h2 className="mb-2 text-[1.05rem] text-ink-soft">{day}</h2>
            <ul className="panel divide-y divide-line">
              {items.map((a) => (
                <li key={a.id} className="flex justify-between gap-4 px-4 py-2.5 text-[14px]">
                  <span>{describeActivity(a.action, a.details)}</span>
                  <time className="shrink-0 text-ink-muted" dateTime={a.created_at}>{new Date(a.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
