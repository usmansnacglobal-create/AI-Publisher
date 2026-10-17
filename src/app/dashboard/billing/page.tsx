import { getViewer } from '@/lib/data';
import { getUsage } from '@/lib/tokens';
import { PLANS } from '@/lib/plans';
import { PageHeader } from '@/components/ui';
import { Plans } from './plans';

export const metadata = { title: 'Plan and billing' };

export default async function BillingPage() {
  const { supabase, user, profile } = await getViewer();
  const usage = await getUsage(user.id);
  const { data: payments } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(50);
  const { count: books } = await supabase.from('books').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title="Plan and billing">Payments are handled securely by PayPal. You can pay with a PayPal account or a card.</PageHeader>
      <Plans
        userId={user.id}
        current={profile.plan}
        status={profile.plan_status}
        periodEnd={usage.periodEnd}
        bookCount={books ?? 0}
        plans={Object.values(PLANS)}
        paypal={{
          clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '',
          planIds: { pro: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO ?? '', agency: process.env.NEXT_PUBLIC_PAYPAL_PLAN_AGENCY ?? '' },
        }}
      />
      <section className="mt-10">
        <h2 className="mb-3">Billing history</h2>
        {payments?.length ? (
          <table className="panel w-full overflow-hidden text-[14px]">
            <thead className="bg-ground text-left text-ink-muted">
              <tr><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Description</th><th className="px-4 py-2 text-right font-medium">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">{new Date(p.created_at).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-2 capitalize">{p.description}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{p.currency} {Number(p.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-ink-muted">No payments yet. Receipts also arrive by email from PayPal.</p>
        )}
      </section>
    </div>
  );
}
