import { cookies, headers } from 'next/headers';
import { getViewer } from '@/lib/data';
import { getUsage } from '@/lib/tokens';
import { getNarrationStatus } from '@/lib/narration';
import { availability, currencyFromCountry, lockedCurrency } from '@/lib/billing';
import { PLANS } from '@/lib/plans';
import { isCurrency, money, type Currency } from '@/lib/pricing';
import { PageHeader } from '@/components/ui';
import { Billing } from './plans';

export const metadata = { title: 'Billing & Subscriptions' };
export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const { supabase, user, profile } = await getViewer();
  const [usage, narration, locked, gbp, usd] = await Promise.all([
    getUsage(user.id),
    getNarrationStatus(user.id),
    lockedCurrency(user.id),
    availability('GBP'),
    availability('USD'),
  ]);
  const chosen = cookies().get('currency')?.value;
  const currency: Currency = locked ?? (isCurrency(chosen) ? chosen : currencyFromCountry(headers().get('x-vercel-ip-country')));
  const { data: payments } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(50);
  const { count: books } = await supabase.from('books').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  const { warned80: _a, warned100: _b, ...narrationStatus } = narration;

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title="Billing & Subscriptions">Pay by card through Stripe or with PayPal, in pounds or dollars. Your plan and your narration add-on are separate subscriptions.</PageHeader>
      <Billing
        current={profile.plan}
        status={profile.plan_status}
        periodEnd={usage.periodEnd}
        mainProvider={profile.billing_provider ?? (profile.paypal_subscription_id ? 'paypal' : null)}
        hasCard={!!profile.stripe_customer_id}
        bookCount={books ?? 0}
        plans={Object.values(PLANS)}
        narration={narrationStatus}
        currency={currency}
        locked={locked}
        availability={{ GBP: gbp, USD: usd }}
      />
      <section className="mt-12">
        <h2 className="mb-3">Billing history</h2>
        {payments?.length ? (
          <div className="overflow-x-auto">
            <table className="panel w-full overflow-hidden text-[14px]">
              <thead className="bg-ground text-left text-ink-muted">
                <tr><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Description</th><th className="px-4 py-2 font-medium">Paid with</th><th className="px-4 py-2 text-right font-medium">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">{new Date(p.created_at).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-2">{p.description}</td>
                    <td className="px-4 py-2 text-ink-muted">{p.provider === 'stripe' ? 'Card' : 'PayPal'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{isCurrency(p.currency) ? money(Number(p.amount), p.currency) : `${p.currency} ${Number(p.amount).toFixed(2)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-ink-muted">No payments yet. Receipts also arrive by email from Stripe or PayPal.</p>
        )}
      </section>
    </div>
  );
}
