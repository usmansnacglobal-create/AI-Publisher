import 'server-only';
import { createAdminClient } from './supabase/admin';
import { NARRATION_TIER_ORDER, type NarrationTier, type Quality } from './pricing';

/** Pounds are counted at this many dollars for margins. Set low on purpose, so margins aren't flattered. */
export const GBP_USD_RATE = Number(process.env.GBP_USD_RATE ?? 1.3);

export interface MarginReport {
  revenue: { USD: number; GBP: number };
  revenueUsd: number;
  costUsd: number;
  multiple: number | null;
  jobs: number;
  chars: number;
  byQuality: Record<Quality, { jobs: number; chars: number; costUsd: number }>;
  subscribers: Record<NarrationTier, number>;
  topupCreditsOutstanding: number;
}

/** What narration earned against what ElevenLabs charged, over the last `days` days (or all time). */
export async function narrationMargins(days?: number): Promise<MarginReport> {
  const admin = createAdminClient();
  const since = days ? new Date(Date.now() - days * 86400000).toISOString() : '1970-01-01';
  const [{ data: pays }, { data: usage }, { data: accounts }] = await Promise.all([
    admin.from('payments').select('amount, currency').in('kind', ['narration', 'topup']).gte('created_at', since).limit(100000),
    admin.from('narration_usage').select('quality, chars, cost_usd').eq('status', 'charged').gte('created_at', since).limit(100000),
    admin.from('narration_accounts').select('tier, topup_credits').limit(100000),
  ]);
  const revenue = { USD: 0, GBP: 0 };
  for (const p of pays ?? []) if (p.currency === 'USD' || p.currency === 'GBP') revenue[p.currency as 'USD' | 'GBP'] += Number(p.amount);
  const byQuality: MarginReport['byQuality'] = { turbo: { jobs: 0, chars: 0, costUsd: 0 }, standard: { jobs: 0, chars: 0, costUsd: 0 } };
  for (const u of usage ?? []) {
    const q = byQuality[u.quality as Quality];
    if (!q) continue;
    q.jobs += 1;
    q.chars += u.chars;
    q.costUsd += Number(u.cost_usd);
  }
  const costUsd = byQuality.turbo.costUsd + byQuality.standard.costUsd;
  const revenueUsd = revenue.USD + revenue.GBP * GBP_USD_RATE;
  const subscribers = Object.fromEntries(NARRATION_TIER_ORDER.map((t) => [t, 0])) as Record<NarrationTier, number>;
  let topupCreditsOutstanding = 0;
  for (const a of accounts ?? []) {
    if (a.tier && a.tier in subscribers) subscribers[a.tier as NarrationTier] += 1;
    topupCreditsOutstanding += a.topup_credits ?? 0;
  }
  return {
    revenue,
    revenueUsd,
    costUsd,
    multiple: costUsd > 0 ? revenueUsd / costUsd : null,
    jobs: byQuality.turbo.jobs + byQuality.standard.jobs,
    chars: byQuality.turbo.chars + byQuality.standard.chars,
    byQuality,
    subscribers,
    topupCreditsOutstanding,
  };
}
