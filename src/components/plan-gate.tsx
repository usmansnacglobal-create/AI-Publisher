import { FEATURE_NAMES, planAllows, type Feature } from '@/lib/plans';
import { ButtonLink } from './ui';

/** Shows the tool on plans that include it, and an upgrade message otherwise. */
export function PlanGate({ plan, feature, children, what }: { plan: string; feature: Feature; children: React.ReactNode; what: string }) {
  if (planAllows(plan, feature)) return <>{children}</>;
  const plural = feature === 'proofread' || feature === 'automations';
  return (
    <div className="panel max-w-[640px] p-6">
      <h2>{FEATURE_NAMES[feature]} {plural ? 'are' : 'is'} part of Pro</h2>
      <p className="mt-2 text-ink-muted">{what}</p>
      <ButtonLink href="/dashboard/billing" className="mt-4">See plans</ButtonLink>
    </div>
  );
}
