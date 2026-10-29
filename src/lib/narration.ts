import 'server-only';
import { createAdminClient } from './supabase/admin';
import { HttpError } from './api';
import { notify } from './notify';
import { NARRATION_TIERS, isNarrationTier, type NarrationTier, type Quality } from './pricing';

/**
 * Narration credits. Each author's add-on gives a monthly allowance (which
 * resets and doesn't carry over); top-ups are added on top and never expire.
 * Credits are reserved before narrating and given back if narration fails.
 */
export interface NarrationStatus {
  tier: NarrationTier | null;
  tierName: string | null;
  status: 'none' | 'active' | 'cancelled' | 'past_due';
  provider: 'paypal' | 'stripe' | null;
  currency: 'USD' | 'GBP' | null;
  allowance: number;
  usedThisPeriod: number;
  allowanceRemaining: number;
  topupCredits: number;
  available: number;
  periodStart: string | null;
  periodEnd: string | null;
  qualities: Quality[];
  /** Has an add-on (or top-up credits) to narrate with premium voices. */
  canNarrate: boolean;
}

interface Account {
  user_id: string;
  tier: string | null;
  status: NarrationStatus['status'];
  provider: 'paypal' | 'stripe' | null;
  provider_subscription_id: string | null;
  currency: 'USD' | 'GBP' | null;
  period_start: string | null;
  period_end: string | null;
  topup_credits: number;
  warned_80_at: string | null;
  warned_100_at: string | null;
}

function addMonths(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

/** Loads the account, ending lapsed add-ons and rolling the month forward if no payment event has yet. */
async function loadAccount(userId: string): Promise<Account> {
  const admin = createAdminClient();
  const { data } = await admin.from('narration_accounts').select('*').eq('user_id', userId).maybeSingle();
  const a: Account = (data as Account | null) ?? {
    user_id: userId, tier: null, status: 'none', provider: null, provider_subscription_id: null, currency: null,
    period_start: null, period_end: null, topup_credits: 0, warned_80_at: null, warned_100_at: null,
  };
  if (!a.tier || !a.period_end) return a;
  const now = new Date();
  let end = new Date(a.period_end);
  if (end > now) return a;

  // Cancelled add-ons end with the period paid for; unpaid ones get a week's grace.
  const lapsed = a.status === 'cancelled' || (a.status === 'past_due' && end.getTime() + 7 * 86400000 <= now.getTime());
  if (lapsed) {
    await admin
      .from('narration_accounts')
      .update({ tier: null, status: 'none', provider_subscription_id: null, period_start: null, period_end: null, warned_80_at: null, warned_100_at: null })
      .eq('user_id', userId);
    return { ...a, tier: null, status: 'none', provider_subscription_id: null, period_start: null, period_end: null };
  }
  let start = new Date(a.period_start ?? a.period_end);
  while (end <= now) {
    start = end;
    end = addMonths(end, 1);
  }
  await admin
    .from('narration_accounts')
    .update({ period_start: start.toISOString(), period_end: end.toISOString(), warned_80_at: null, warned_100_at: null })
    .eq('user_id', userId);
  return { ...a, period_start: start.toISOString(), period_end: end.toISOString(), warned_80_at: null, warned_100_at: null };
}

export async function getNarrationStatus(userId: string): Promise<NarrationStatus & { warned80: boolean; warned100: boolean }> {
  const a = await loadAccount(userId);
  const tier = isNarrationTier(a.tier) ? a.tier : null;
  const info = tier ? NARRATION_TIERS[tier] : null;
  let used = 0;
  if (tier && a.period_start) {
    const { data } = await createAdminClient()
      .from('narration_usage')
      .select('from_allowance')
      .eq('user_id', userId)
      .in('status', ['reserved', 'charged'])
      .gte('created_at', a.period_start);
    used = (data ?? []).reduce((s, r) => s + (r.from_allowance ?? 0), 0);
  }
  const allowance = info?.credits ?? 0;
  const allowanceRemaining = Math.max(0, allowance - used);
  const available = allowanceRemaining + a.topup_credits;
  return {
    tier,
    tierName: info?.name ?? null,
    status: tier ? a.status : 'none',
    provider: a.provider,
    currency: a.currency,
    allowance,
    usedThisPeriod: used,
    allowanceRemaining,
    topupCredits: a.topup_credits,
    available,
    periodStart: tier ? a.period_start : null,
    periodEnd: tier ? a.period_end : null,
    // Standard quality is for the top add-on only. Top-up credits on their own narrate in Turbo.
    qualities: info?.qualities ?? (a.topup_credits > 0 ? ['turbo'] : []),
    canNarrate: !!tier || a.topup_credits > 0,
    warned80: !!a.warned_80_at,
    warned100: !!a.warned_100_at,
  };
}

const fmt = (n: number) => n.toLocaleString('en-GB');

/** Reserves credits for one narration, or explains clearly why it can't run. Returns the reservation id. */
export async function reserveCredits(o: {
  userId: string; credits: number; quality: Quality; model: string; chars: number; costUsd: number; bookId?: string; chapterId?: string;
}) {
  const s = await getNarrationStatus(o.userId);
  if (!s.canNarrate) throw new HttpError(402, 'Premium narration needs a narration add-on. Choose one on the Billing page.', 'NARRATION_REQUIRED');
  if (!s.qualities.includes(o.quality)) {
    throw new HttpError(403, 'Standard quality is part of Narration Pro. Switch to Turbo, or upgrade your narration add-on.', 'QUALITY_LOCKED');
  }
  const { data, error } = await createAdminClient().rpc('narration_reserve', {
    p_user: o.userId,
    p_credits: o.credits,
    p_allowance: s.allowance,
    p_period_start: s.periodStart ?? new Date().toISOString(),
    p_book: o.bookId ?? null,
    p_chapter: o.chapterId ?? null,
    p_model: o.model,
    p_quality: o.quality,
    p_chars: o.chars,
    p_cost: o.costUsd,
  });
  if (error) {
    const m = /NARRATION_CREDITS:(\d+)/.exec(error.message);
    if (m) {
      const have = Number(m[1]);
      const reset = s.periodEnd ? ` Your monthly credits reset on ${new Date(s.periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.` : '';
      throw new HttpError(402, `This chapter needs ${fmt(o.credits)} narration credits and you have ${fmt(have)} left.${reset} You can buy a top-up on the Billing page.`, 'NARRATION_CREDITS');
    }
    throw error;
  }
  return data as string;
}

/** Confirms the charge once audio is saved, or refunds it if narration failed. Then sends usage warnings. */
export async function settleCredits(reservationId: string, ok: boolean, userId: string) {
  await createAdminClient().rpc('narration_settle', { p_id: reservationId, p_ok: ok });
  if (ok) await warnIfLow(userId).catch((e) => console.error(e));
}

async function warnIfLow(userId: string) {
  const s = await getNarrationStatus(userId);
  if (!s.tier || !s.allowance) return;
  const pct = (s.usedThisPeriod / s.allowance) * 100;
  const admin = createAdminClient();
  const now = new Date().toISOString();
  if (pct >= 100 && !s.warned100) {
    await admin.from('narration_accounts').update({ warned_100_at: now, warned_80_at: now }).eq('user_id', userId);
    await notify(userId, {
      pref: 'token_warnings', category: 'billing',
      title: "You've used this month's narration credits",
      body: s.topupCredits > 0 ? `You still have ${fmt(s.topupCredits)} top-up credits.` : 'Buy a top-up or upgrade your narration add-on to keep narrating.',
      link: '/dashboard/billing',
    });
  } else if (pct >= 80 && !s.warned80) {
    await admin.from('narration_accounts').update({ warned_80_at: now }).eq('user_id', userId);
    await notify(userId, {
      pref: 'token_warnings', category: 'billing',
      title: "You've used 80% of this month's narration credits",
      body: `${fmt(s.allowanceRemaining)} monthly credits left${s.periodEnd ? ` until ${new Date(s.periodEnd).toLocaleDateString('en-GB')}` : ''}.`,
      link: '/dashboard/billing',
    });
  }
}

// ───────────── Changes made by billing ─────────────

export async function activateNarration(o: {
  userId: string; tier: NarrationTier; provider: 'paypal' | 'stripe'; subscriptionId: string; currency: 'USD' | 'GBP'; periodStart: Date; periodEnd: Date;
}) {
  const admin = createAdminClient();
  const { data: prev } = await admin.from('narration_accounts').select('tier, period_start').eq('user_id', o.userId).maybeSingle();
  // A new subscription starts a fresh month of credits; renewals of the same one keep their history.
  await admin.from('narration_accounts').upsert(
    {
      user_id: o.userId,
      tier: o.tier,
      status: 'active',
      provider: o.provider,
      provider_subscription_id: o.subscriptionId,
      currency: o.currency,
      period_start: o.periodStart.toISOString(),
      period_end: o.periodEnd.toISOString(),
      warned_80_at: null,
      warned_100_at: null,
    },
    { onConflict: 'user_id' },
  );
  return { previousTier: (prev?.tier as NarrationTier | null) ?? null };
}

export async function narrationRenewed(subscriptionId: string, periodStart: Date, periodEnd: Date) {
  await createAdminClient()
    .from('narration_accounts')
    .update({ status: 'active', period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(), warned_80_at: null, warned_100_at: null })
    .eq('provider_subscription_id', subscriptionId);
}

export async function grantTopup(o: { userId: string; provider: 'paypal' | 'stripe'; externalId: string; amount: number; currency: string; credits: number }) {
  const { data, error } = await createAdminClient().rpc('narration_grant_topup', {
    p_user: o.userId, p_credits: o.credits, p_provider: o.provider, p_external_id: o.externalId, p_amount: o.amount, p_currency: o.currency,
  });
  if (error) throw error;
  return data as boolean;
}

/**
 * Tells admins the narration service needs attention (out of balance, key rejected),
 * at most once an hour so a busy evening doesn't flood their inbox.
 */
export async function alertAdminsAboutNarration(detail: string) {
  const admin = createAdminClient();
  const key = 'narration_alert';
  const { data } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle();
  const last = (data?.value as { at?: string } | null)?.at;
  if (last && Date.now() - new Date(last).getTime() < 3600_000) return;
  const now = new Date().toISOString();
  await admin.from('app_settings').upsert({ key, value: { at: now, detail }, updated_at: now }, { onConflict: 'key' });
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  for (const a of admins ?? []) {
    await notify(a.id, {
      pref: 'billing', category: 'system',
      title: 'Premium narration needs attention',
      body: `ElevenLabs refused a narration: ${detail}. Check the ElevenLabs balance (or Auto Top Up) and the API key. Authors weren’t charged.`,
      link: '/admin/billing',
    });
  }
}
