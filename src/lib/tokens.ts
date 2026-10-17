import 'server-only';
import { createAdminClient } from './supabase/admin';
import { getPlan, IMAGE_TOKEN_WEIGHT, planAllows, FEATURE_NAMES, type Feature } from './plans';
import { HttpError } from './api';
import { notify } from './notify';

export interface Usage {
  plan: string;
  planName: string;
  tokensUsed: number;
  tokenLimit: number;
  tokensRemaining: number;
  usagePercent: number;
  periodStart: string;
  periodEnd: string;
}

function addMonths(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

/**
 * One billing cycle drives both the token reset date and the renewal date,
 * so they can never disagree. If a cycle has ended (and no payment webhook
 * moved it yet) we roll it forward month by month.
 */
async function currentPeriod(userId: string) {
  const admin = createAdminClient();
  const { data: p, error } = await admin
    .from('profiles')
    .select('plan, plan_status, current_period_start, current_period_end, warned_80_at, warned_100_at')
    .eq('id', userId)
    .single();
  if (error || !p) throw new HttpError(404, 'Profile not found.');

  let start = new Date(p.current_period_start);
  let end = new Date(p.current_period_end);
  const now = new Date();
  if (end <= now) {
    // A cancelled plan (or one unpaid for over a week) ends with its paid period.
    const lapsed =
      p.plan !== 'free' &&
      (p.plan_status === 'cancelled' || (p.plan_status === 'past_due' && end.getTime() + 7 * 86400000 <= now.getTime()));
    if (lapsed) {
      await admin.from('profiles').update({ plan: 'free', plan_status: 'active', paypal_subscription_id: null }).eq('id', userId);
      p.plan = 'free';
    }
    while (end <= now) {
      start = end;
      end = addMonths(end, 1);
    }
    await admin
      .from('profiles')
      .update({
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
        warned_80_at: null,
        warned_100_at: null,
      })
      .eq('id', userId);
    p.warned_80_at = null;
    p.warned_100_at = null;
  }
  return { plan: p.plan as string, start, end, warned80: p.warned_80_at, warned100: p.warned_100_at };
}

export async function getUsage(userId: string): Promise<Usage & { warned80: boolean; warned100: boolean }> {
  const admin = createAdminClient();
  const period = await currentPeriod(userId);
  const plan = getPlan(period.plan);
  const { data } = await admin
    .from('token_usage')
    .select('total_tokens')
    .eq('user_id', userId)
    .gte('created_at', period.start.toISOString());
  const used = (data ?? []).reduce((s, r) => s + (r.total_tokens || 0), 0);
  return {
    plan: plan.id,
    planName: plan.name,
    tokensUsed: used,
    tokenLimit: plan.monthlyTokens,
    tokensRemaining: Math.max(0, plan.monthlyTokens - used),
    usagePercent: +((used / plan.monthlyTokens) * 100).toFixed(2),
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    warned80: !!period.warned80,
    warned100: !!period.warned100,
  };
}

/** Throws a clear error if the author doesn't have enough tokens left this cycle. */
export async function assertQuota(userId: string, minimum = 500) {
  const u = await getUsage(userId);
  if (u.tokensRemaining < minimum && u.tokensRemaining > 2000) {
    throw new HttpError(
      402,
      `This needs about ${minimum.toLocaleString('en-GB')} AI tokens and you have ${u.tokensRemaining.toLocaleString('en-GB')} left this month. Try a smaller request, or upgrade your plan.`,
      'TOKENS_LOW',
    );
  }
  if (u.tokensRemaining < minimum) {
    throw new HttpError(
      402,
      `You've used your ${u.tokenLimit.toLocaleString('en-GB')} AI tokens for this month. They reset on ${new Date(
        u.periodEnd,
      ).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, or you can upgrade your plan now.`,
      'TOKENS_EXHAUSTED',
    );
  }
  return u;
}

export async function recordUsage(args: {
  userId: string;
  bookId?: string | null;
  feature: string;
  provider: 'anthropic' | 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const admin = createAdminClient();
  const raw = args.inputTokens + args.outputTokens;
  const total = args.provider === 'openai' ? Math.round(raw * IMAGE_TOKEN_WEIGHT) : raw;
  await admin.from('token_usage').insert({
    user_id: args.userId,
    book_id: args.bookId ?? null,
    feature: args.feature,
    provider: args.provider,
    model: args.model,
    input_tokens: args.inputTokens,
    output_tokens: args.outputTokens,
    total_tokens: total,
  });

  const u = await getUsage(args.userId);
  if (u.usagePercent >= 100 && !u.warned100) {
    await admin.from('profiles').update({ warned_100_at: new Date().toISOString(), warned_80_at: new Date().toISOString() }).eq('id', args.userId);
    await notify(args.userId, {
      pref: 'token_warnings',
      category: 'billing',
      title: "You've used all your AI tokens for this month",
      body: 'Upgrade your plan to keep using AI features before your allowance resets.',
      link: '/dashboard/billing',
    });
  } else if (u.usagePercent >= 80 && !u.warned80) {
    await admin.from('profiles').update({ warned_80_at: new Date().toISOString() }).eq('id', args.userId);
    await notify(args.userId, {
      pref: 'token_warnings',
      category: 'billing',
      title: "You've used 80% of this month's AI tokens",
      body: `${u.tokensRemaining.toLocaleString('en-GB')} tokens left until ${new Date(u.periodEnd).toLocaleDateString('en-GB')}.`,
      link: '/dashboard/usage',
    });
  }
  return total;
}

/** Blocks paid tools for plans that don't include them. */
export async function requireFeature(userId: string, feature: Feature) {
  const { data } = await createAdminClient().from('profiles').select('plan').eq('id', userId).single();
  if (!planAllows(data?.plan, feature)) {
    throw new HttpError(403, `${FEATURE_NAMES[feature]} ${feature === 'proofread' || feature === 'automations' ? 'are' : 'is'} part of the Pro plan. Upgrade to use ${feature === 'proofread' || feature === 'automations' ? 'them' : 'it'}.`, 'PLAN_REQUIRED');
  }
}
