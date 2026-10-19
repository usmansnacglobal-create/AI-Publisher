import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { getViewer } from '@/lib/data';
import { runSystemCheck } from '@/lib/system-check';

export const metadata = { title: 'System check' };
export const dynamic = 'force-dynamic';

export default async function SystemCheck() {
  const { profile } = await getViewer();
  if (profile.role !== 'admin') notFound();
  const results = await runSystemCheck();
  const groups = [...new Set(results.map((r) => r.group))];
  const required = results.filter((r) => r.level === 'required' && !r.ok).length;
  const optional = results.filter((r) => r.level === 'optional' && !r.ok).length;
  return (
    <main className="mx-auto max-w-[900px] px-4 py-8">
      <div className="flex flex-wrap gap-4 text-[13px] text-ink-muted"><Link href="/admin">Publishing queue</Link><Link href="/admin/print">Print orders</Link><Link href="/admin/sales">Sales data</Link><Link href="/admin/support">Support inbox</Link></div>
      <h1 className="mb-1 mt-1">System check</h1>
      <p className="mb-4 text-ink-muted">Checks the database changes, file storage and settings the site needs. Refresh this page after making a change.</p>
      <p className={`mb-8 rounded-md px-4 py-3 text-[15px] ${required ? 'bg-danger-light text-danger' : 'bg-cloth-light text-cloth-dark'}`} role="status">
        {required ? `${required} required item${required === 1 ? '' : 's'} need attention.` : 'Everything required is in place.'}
        {optional ? ` ${optional} optional item${optional === 1 ? ' is' : 's are'} not set up yet.` : ''}
      </p>
      {groups.map((g) => (
        <section key={g} className="mb-6">
          <h2 className="mb-2 text-[1.1rem]">{g}</h2>
          <ul className="panel divide-y divide-line">
            {results.filter((r) => r.group === g).map((r) => (
              <li key={r.label} className="flex gap-3 px-4 py-3 text-[14px]">
                {r.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cloth" aria-label="OK" /> : r.level === 'required' ? <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-label="Needs attention" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gilt" aria-label="Optional, not set up" />}
                <div>
                  <p className="font-medium text-ink">{r.label}</p>
                  <p className="text-ink-soft">{r.detail}</p>
                  {r.fix && <p className="mt-1 text-ink-muted">{r.fix}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
