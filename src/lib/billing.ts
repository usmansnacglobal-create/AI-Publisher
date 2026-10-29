import 'server-only';
import { createAdminClient } from './supabase/admin';
import { HttpError } from './api';
import { logActivity, notify } from './notify';
import { getPlan, type PlanId } from './plans';
import { stripe, stripeReady, subscriptionPeriod, type Stripe } from './stripe';
import {
  cancelSubscription as cancelPayPal, capturePayPalOrder, createPayPalOrder, createPayPalPlan, createPayPalProduct, createSubscription,
  getPayPalOrder, getSubscription, orderApprovalUrl, paypalReady,
} from './paypal';
import { activateNarration, grantTopup } from './narration';
import {
  CATALOG, NARRATION_TIERS, TOPUP, catalogEntry, isCatalogItem, isCurrency, money, priceOf,
  type CatalogItem, type Currency, type NarrationTier,
} from './pricing';

export type Provider = 'paypal' | 'stripe';
export const PROVIDER_NAMES: Record<Provider, string> = { stripe: 'Card (Stripe)', paypal: 'PayPal' };

export const providersReady = (): Record<Provider, boolean> => ({ stripe: stripeReady(), paypal: paypalReady() });

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

// ───────────── Catalogue: the prices set up in Stripe and PayPal ─────────────

interface CatalogRow { provider: Provider; item: string; currency: Currency; amount: number; external_id: string }

async function catalogRows(): Promise<CatalogRow[]> {
  const { data } = await createAdminClient().from('billing_catalog').select('provider,item,currency,amount,external_id');
  return (data ?? []) as CatalogRow[];
}

/** PayPal plans made by hand before Billing setup existed (USD only). */
function legacyPayPalPlans(): { item: CatalogItem; currency: Currency; amount: number; external_id: string }[] {
  const out: { item: CatalogItem; currency: Currency; amount: number; external_id: string }[] = [];
  if (process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO) out.push({ item: 'plan:pro', currency: 'USD', amount: 29, external_id: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO });
  if (process.env.NEXT_PUBLIC_PAYPAL_PLAN_AGENCY) out.push({ item: 'plan:agency', currency: 'USD', amount: 79, external_id: process.env.NEXT_PUBLIC_PAYPAL_PLAN_AGENCY });
  return out;
}

/** The Stripe price or PayPal plan to charge for an item, at today's price. */
async function catalogId(provider: Provider, item: CatalogItem, currency: Currency, rows?: CatalogRow[]) {
  const price = priceOf(item, currency);
  const row = (rows ?? (await catalogRows())).find((r) => r.provider === provider && r.item === item && r.currency === currency && Number(r.amount) === price);
  if (row) return row.external_id;
  if (provider === 'paypal') return legacyPayPalPlans().find((l) => l.item === item && l.currency === currency && l.amount === price)?.external_id ?? null;
  return null;
}

/** What a Stripe price or PayPal plan id sells (older prices included, so renewals keep working). */
export async function itemForExternal(provider: Provider, externalId: string): Promise<{ item: CatalogItem; currency: Currency } | null> {
  const { data } = await createAdminClient().from('billing_catalog').select('item,currency').eq('provider', provider).eq('external_id', externalId).maybeSingle();
  if (data && isCatalogItem(data.item) && isCurrency(data.currency)) return { item: data.item, currency: data.currency };
  if (provider === 'paypal') {
    const l = legacyPayPalPlans().find((x) => x.external_id === externalId);
    if (l) return { item: l.item, currency: l.currency };
  }
  return null;
}

/** Which payment services can sell each item right now, in a currency. */
export async function availability(currency: Currency): Promise<Record<CatalogItem, Provider[]>> {
  const rows = await catalogRows();
  const ready = providersReady();
  const out = {} as Record<CatalogItem, Provider[]>;
  for (const c of CATALOG) {
    const list: Provider[] = [];
    if (ready.stripe && (await catalogId('stripe', c.item, currency, rows))) list.push('stripe');
    // PayPal one-off payments (top-ups) need no plan.
    if (ready.paypal && (!c.recurring || (await catalogId('paypal', c.item, currency, rows)))) list.push('paypal');
    out[c.item] = list;
  }
  return out;
}

/**
 * Creates every plan, add-on and top-up price in Stripe and PayPal, in both
 * currencies. Safe to run again: anything that already exists at today's price is skipped,
 * and a changed price gets a new one (current subscribers keep their old price).
 */
export async function setupCatalog() {
  const admin = createAdminClient();
  const rows = await catalogRows();
  const ready = providersReady();
  const done: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  const save = async (r: CatalogRow) => {
    const { error } = await admin.from('billing_catalog').upsert({ ...r, created_at: new Date().toISOString() }, { onConflict: 'provider,item,currency' });
    if (error) throw error;
  };
  const setting = async (key: string) => (await admin.from('app_settings').select('value').eq('key', key).maybeSingle()).data?.value as Record<string, string> | undefined;
  const putSetting = (key: string, value: Record<string, string>) => admin.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  if (ready.stripe) {
    const products = { ...((await setting('stripe_products')) ?? {}) };
    for (const c of CATALOG) {
      for (const currency of ['GBP', 'USD'] as Currency[]) {
        const label = `Stripe · ${c.name} · ${money(c.prices[currency], currency)}`;
        try {
          if (await catalogId('stripe', c.item, currency, rows)) { skipped.push(label); continue; }
          const amount = Math.round(c.prices[currency] * 100);
          const lookup = `aip_${c.item.replace(':', '_')}_${currency}_${amount}`.toLowerCase();
          const existing = (await stripe().prices.list({ lookup_keys: [lookup], limit: 1 })).data[0];
          let priceId = existing?.id;
          if (!priceId) {
            if (!products[c.item]) {
              products[c.item] = (await stripe().products.create({ name: c.name, metadata: { item: c.item } })).id;
              await putSetting('stripe_products', products);
            }
            priceId = (
              await stripe().prices.create({
                product: products[c.item],
                currency: currency.toLowerCase(),
                unit_amount: amount,
                lookup_key: lookup,
                ...(c.recurring ? { recurring: { interval: 'month' as const } } : {}),
                metadata: { item: c.item },
              })
            ).id;
          }
          await save({ provider: 'stripe', item: c.item, currency, amount: c.prices[currency], external_id: priceId });
          done.push(label);
        } catch (e) {
          errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }

  if (ready.paypal) {
    const s = (await setting('paypal_product')) ?? {};
    let productId = s.id;
    for (const c of CATALOG.filter((x) => x.recurring)) {
      for (const currency of ['GBP', 'USD'] as Currency[]) {
        const label = `PayPal · ${c.name} · ${money(c.prices[currency], currency)}`;
        try {
          if (await catalogId('paypal', c.item, currency, rows)) { skipped.push(label); continue; }
          if (!productId) {
            productId = (await createPayPalProduct('AI Publisher subscriptions')).id;
            await putSetting('paypal_product', { id: productId });
          }
          const plan = await createPayPalPlan({ productId, name: `${c.name} (${currency})`, amount: c.prices[currency], currency });
          await save({ provider: 'paypal', item: c.item, currency, amount: c.prices[currency], external_id: plan.id });
          done.push(label);
        } catch (e) {
          errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }
  return { done, skipped, errors, ready };
}

// ───────────── Currency ─────────────

/** The currency an author is tied to while they have a paid subscription (Stripe allows one per customer). */
export async function lockedCurrency(userId: string): Promise<Currency | null> {
  const admin = createAdminClient();
  const [{ data: p }, { data: n }] = await Promise.all([
    admin.from('profiles').select('plan, currency').eq('id', userId).single(),
    admin.from('narration_accounts').select('tier, currency').eq('user_id', userId).maybeSingle(),
  ]);
  if (n?.tier && isCurrency(n.currency)) return n.currency;
  if (p && p.plan !== 'free' && isCurrency(p.currency)) return p.currency;
  return null;
}

/** A sensible starting currency from where the visitor is. */
export function currencyFromCountry(country: string | null | undefined): Currency {
  return ['GB', 'GG', 'JE', 'IM'].includes((country ?? '').toUpperCase()) ? 'GBP' : 'USD';
}

// ───────────── Checkout ─────────────

/**
 * The author's Stripe customer. Stripe ties a customer to the currency they were first billed in,
 * so an author switching currency (after their old subscriptions ended) gets a fresh customer.
 */
async function ensureStripeCustomer(userId: string, email: string | undefined, currency: Currency) {
  const admin = createAdminClient();
  const { data: p } = await admin.from('profiles').select('stripe_customer_id, full_name').eq('id', userId).single();
  if (p?.stripe_customer_id) {
    const existing = await stripe().customers.retrieve(p.stripe_customer_id);
    const billedIn = 'deleted' in existing && existing.deleted ? 'deleted' : (existing as Stripe.Customer).currency;
    if (billedIn !== 'deleted' && (!billedIn || billedIn.toUpperCase() === currency)) return p.stripe_customer_id as string;
  }
  const c = await stripe().customers.create({ email, name: p?.full_name || undefined, metadata: { user_id: userId } });
  await admin.from('profiles').update({ stripe_customer_id: c.id }).eq('id', userId);
  return c.id;
}

/** Starts a payment and returns the Stripe or PayPal page to send the author to. */
export async function startCheckout(o: { userId: string; email?: string; item: CatalogItem; currency: Currency; provider: Provider }) {
  const entry = catalogEntry(o.item)!;
  const locked = await lockedCurrency(o.userId);
  if (locked && locked !== o.currency) {
    throw new HttpError(400, `Your subscriptions are billed in ${locked === 'GBP' ? 'pounds' : 'dollars'}, so new purchases must be too. Switch the currency back to ${locked}.`, 'CURRENCY_LOCKED');
  }
  const back = `${siteUrl()}/dashboard/billing`;

  if (o.provider === 'stripe') {
    const priceId = await catalogId('stripe', o.item, o.currency);
    if (!priceId) throw new HttpError(503, 'Card payments aren’t set up for this yet. The site owner needs to run Billing setup.', 'BILLING_NOT_READY');
    const customer = await ensureStripeCustomer(o.userId, o.email, o.currency);
    const meta = { user_id: o.userId, item: o.item, currency: o.currency };
    const session = await stripe().checkout.sessions.create({
      mode: entry.recurring ? 'subscription' : 'payment',
      customer,
      client_reference_id: o.userId,
      line_items: [{ price: priceId, quantity: 1 }],
      currency: o.currency.toLowerCase(),
      // Charge exactly our price in this currency: no automatic conversion to other currencies.
      adaptive_pricing: { enabled: false },
      metadata: meta,
      ...(entry.recurring ? { subscription_data: { metadata: meta } } : { payment_intent_data: { metadata: meta } }),
      success_url: `${back}?checkout=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${back}?checkout=cancelled`,
    });
    if (!session.url) throw new Error('Stripe did not return a checkout page.');
    return { url: session.url };
  }

  if (!paypalReady()) throw new HttpError(503, 'PayPal isn’t set up yet.', 'BILLING_NOT_READY');
  if (entry.recurring) {
    const planId = await catalogId('paypal', o.item, o.currency);
    if (!planId) throw new HttpError(503, 'PayPal isn’t set up for this yet. The site owner needs to run Billing setup.', 'BILLING_NOT_READY');
    const sub = await createSubscription({
      planId,
      customId: `${o.userId}:${o.item}`,
      returnUrl: `${back}?checkout=paypal`,
      cancelUrl: `${back}?checkout=cancelled`,
    });
    return { url: sub.url };
  }

  // Top-up: a one-off PayPal payment.
  const amount = priceOf(o.item, o.currency);
  const order = await createPayPalOrder({
    total: amount,
    currency: o.currency,
    customId: `${o.userId}:${o.item}`,
    description: entry.name,
    requestId: `topup-${o.userId}-${Date.now()}`,
    returnUrl: `${back}?checkout=paypal-topup`,
    cancelUrl: `${back}?checkout=cancelled`,
  });
  const url = orderApprovalUrl(order);
  if (!url) throw new Error('PayPal did not return a payment page.');
  await logActivity(o.userId, 'billing.topup_started', { provider: 'paypal', order: order.id });
  return { url };
}

// ───────────── Applying payments (shared by return pages and webhooks) ─────────────

async function recordPayment(r: { userId: string; provider: Provider; externalId: string; amount: number; currency: string; description: string; kind: 'plan' | 'narration' | 'topup' }) {
  await createAdminClient().from('payments').upsert(
    {
      user_id: r.userId, provider: r.provider, external_id: r.externalId, amount: r.amount, currency: r.currency.toUpperCase(),
      description: r.description, kind: r.kind, status: 'completed',
      ...(r.provider === 'paypal' ? { paypal_id: r.externalId } : {}),
    },
    { onConflict: 'provider,external_id', ignoreDuplicates: true },
  );
}
export { recordPayment };

/** Stops a subscription now (used when an author switches to a different one). */
async function cancelNow(provider: Provider, id: string, reason: string) {
  try {
    if (provider === 'stripe') await stripe().subscriptions.cancel(id);
    else await cancelPayPal(id, reason);
  } catch (e) {
    console.error('Could not cancel old subscription', provider, id, e);
  }
}

/** Puts an author on a main plan once its subscription is active. */
export async function applyMainPlan(o: { userId: string; plan: Exclude<PlanId, 'free'>; provider: Provider; subscriptionId: string; currency: Currency; start: Date; end: Date }) {
  const admin = createAdminClient();
  const { data: p } = await admin.from('profiles').select('plan, billing_provider, paypal_subscription_id, stripe_subscription_id').eq('id', o.userId).single();
  const already = (o.provider === 'stripe' ? p?.stripe_subscription_id : p?.paypal_subscription_id) === o.subscriptionId;
  if (already) return false;
  // Switching plans: stop the old subscription so the author isn't charged twice.
  if (p?.stripe_subscription_id) await cancelNow('stripe', p.stripe_subscription_id, 'Switched plan');
  if (p?.paypal_subscription_id) await cancelNow('paypal', p.paypal_subscription_id, 'Switched plan');
  await admin
    .from('profiles')
    .update({
      plan: o.plan,
      plan_status: 'active',
      billing_provider: o.provider,
      currency: o.currency,
      stripe_subscription_id: o.provider === 'stripe' ? o.subscriptionId : null,
      paypal_subscription_id: o.provider === 'paypal' ? o.subscriptionId : null,
      current_period_start: o.start.toISOString(),
      current_period_end: o.end.toISOString(),
      warned_80_at: null,
      warned_100_at: null,
    })
    .eq('id', o.userId);
  await logActivity(o.userId, 'billing.subscribed', { plan: o.plan, provider: o.provider });
  await notify(o.userId, { pref: 'billing', category: 'billing', title: `You're on the ${getPlan(o.plan).name} plan`, body: `Your next payment is on ${o.end.toLocaleDateString('en-GB')}.`, link: '/dashboard/billing' });
  return true;
}

/** Starts (or switches) an author's narration add-on once its subscription is active. */
export async function applyNarrationSub(o: { userId: string; tier: NarrationTier; provider: Provider; subscriptionId: string; currency: Currency; start: Date; end: Date }) {
  const admin = createAdminClient();
  const { data: a } = await admin.from('narration_accounts').select('provider, provider_subscription_id').eq('user_id', o.userId).maybeSingle();
  if (a?.provider_subscription_id === o.subscriptionId) return false;
  if (a?.provider_subscription_id && a.provider) await cancelNow(a.provider as Provider, a.provider_subscription_id, 'Switched narration add-on');
  await activateNarration({ userId: o.userId, tier: o.tier, provider: o.provider, subscriptionId: o.subscriptionId, currency: o.currency, periodStart: o.start, periodEnd: o.end });
  await admin.from('profiles').update({ currency: o.currency }).eq('id', o.userId);
  const t = NARRATION_TIERS[o.tier];
  await logActivity(o.userId, 'billing.narration', { tier: o.tier, provider: o.provider });
  await notify(o.userId, {
    pref: 'billing', category: 'billing', title: `${t.name} is active`,
    body: `You have ${t.credits.toLocaleString('en-GB')} narration credits until ${o.end.toLocaleDateString('en-GB')}.`, link: '/dashboard/billing',
  });
  return true;
}

async function applyTopup(o: { userId: string; provider: Provider; externalId: string; amount: number; currency: string }) {
  const added = await grantTopup({ ...o, credits: TOPUP.credits });
  if (added) {
    await recordPayment({ ...o, description: catalogEntry('topup')!.name, kind: 'topup' });
    await logActivity(o.userId, 'billing.topup', { credits: TOPUP.credits, provider: o.provider });
    await notify(o.userId, { pref: 'billing', category: 'billing', title: 'Narration credits added', body: `${TOPUP.credits.toLocaleString('en-GB')} top-up credits are ready to use. They don't expire.`, link: '/dashboard/billing' });
  }
  return added;
}

/** Applies a subscription for whichever item it sells. */
async function applySubscription(o: { userId: string; item: CatalogItem; provider: Provider; subscriptionId: string; currency: Currency; start: Date; end: Date }) {
  if (o.item.startsWith('plan:')) return applyMainPlan({ ...o, plan: o.item.slice(5) as Exclude<PlanId, 'free'> });
  if (o.item.startsWith('narration:')) return applyNarrationSub({ ...o, tier: o.item.slice(10) as NarrationTier });
  return false;
}

/** After Stripe Checkout: checks the session really was paid for this author, then applies it. Safe to call twice. */
export async function confirmStripeSession(sessionId: string, expectUserId?: string) {
  const s = await stripe().checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
  const userId = s.metadata?.user_id;
  const item = s.metadata?.item;
  const currency = (s.currency ?? '').toUpperCase();
  if (!userId || !isCatalogItem(item) || !isCurrency(currency)) throw new HttpError(400, 'This checkout isn’t one of ours.');
  if (expectUserId && userId !== expectUserId) throw new HttpError(403, 'This payment belongs to a different account.');

  if (s.mode === 'payment') {
    if (s.payment_status !== 'paid') throw new HttpError(402, 'Stripe hasn’t confirmed this payment yet. Refresh in a minute.');
    if ((s.amount_total ?? 0) !== Math.round(priceOf(item, currency) * 100)) throw new HttpError(400, 'The payment doesn’t match the price. Please contact support.');
    await applyTopup({ userId, provider: 'stripe', externalId: s.id, amount: (s.amount_total ?? 0) / 100, currency });
    return { item };
  }
  const sub = s.subscription as Stripe.Subscription | null;
  if (s.status !== 'complete' || !sub) throw new HttpError(402, 'Stripe hasn’t finished setting up this subscription yet. Refresh in a minute.');
  const { start, end } = subscriptionPeriod(sub);
  await applySubscription({ userId, item, provider: 'stripe', subscriptionId: sub.id, currency, start, end });
  if (s.invoice) {
    const invId = typeof s.invoice === 'string' ? s.invoice : s.invoice.id;
    await recordPayment({ userId, provider: 'stripe', externalId: invId, amount: (s.amount_total ?? 0) / 100, currency, description: catalogEntry(item)!.name, kind: item.startsWith('plan:') ? 'plan' : 'narration' });
  }
  return { item };
}

/** After the author approves a PayPal subscription: verified with PayPal before anything changes. */
export async function confirmPayPalSubscription(subscriptionId: string, userId: string) {
  const sub = await getSubscription(subscriptionId);
  const owner = (sub.custom_id ?? '').split(':')[0];
  if (owner !== userId) throw new HttpError(403, 'This subscription belongs to a different account.');
  if (!['ACTIVE', 'APPROVED'].includes(sub.status)) throw new HttpError(400, 'PayPal has not activated this subscription yet. Refresh in a minute.');
  // What the plan actually charges decides what the author gets.
  const what = await itemForExternal('paypal', sub.plan_id);
  if (!what) throw new HttpError(400, 'Unknown plan.');
  const start = new Date();
  const end = sub.billing_info?.next_billing_time ? new Date(sub.billing_info.next_billing_time) : new Date(start.getTime() + 30 * 86400000);
  await applySubscription({ userId, item: what.item, provider: 'paypal', subscriptionId: sub.id, currency: what.currency, start, end });
  return { item: what.item };
}

/** After the author approves a PayPal top-up: takes the payment and adds the credits once. */
export async function capturePayPalTopup(orderId: string, userId: string) {
  let order = await getPayPalOrder(orderId);
  const unit = order.purchase_units?.[0];
  const [owner, item] = (unit?.custom_id ?? '').split(':');
  if (owner !== userId || item !== 'topup') throw new HttpError(403, 'This payment belongs to a different account.');
  if (order.status === 'APPROVED') order = await capturePayPalOrder(orderId);
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (order.status !== 'COMPLETED' || capture?.status !== 'COMPLETED') throw new HttpError(402, 'PayPal didn’t complete the payment. Nothing was charged; please try again.');
  const currency = capture.amount.currency_code;
  if (!isCurrency(currency) || Number(capture.amount.value) !== priceOf('topup', currency)) throw new HttpError(400, 'The payment doesn’t match the price. Please contact support.');
  await applyTopup({ userId, provider: 'paypal', externalId: capture.id, amount: Number(capture.amount.value), currency });
  return { item: 'topup' as const };
}

// ───────────── Cancelling ─────────────

/** Cancels renewal; the author keeps what they paid for until the end of the period. */
export async function cancelRenewal(userId: string, what: 'plan' | 'narration') {
  const admin = createAdminClient();
  if (what === 'plan') {
    const { data: p } = await admin.from('profiles').select('plan, billing_provider, paypal_subscription_id, stripe_subscription_id, current_period_end').eq('id', userId).single();
    if (!p || p.plan === 'free') throw new HttpError(400, "You don't have a paid plan to cancel.");
    if (p.stripe_subscription_id) await stripe().subscriptions.update(p.stripe_subscription_id, { cancel_at_period_end: true });
    else if (p.paypal_subscription_id) await cancelPayPal(p.paypal_subscription_id, 'Cancelled by author');
    else throw new HttpError(400, "You don't have a paid plan to cancel.");
    await admin.from('profiles').update({ plan_status: 'cancelled' }).eq('id', userId);
    const until = new Date(p.current_period_end).toLocaleDateString('en-GB');
    await logActivity(userId, 'billing.cancelled', {});
    await notify(userId, { pref: 'billing', category: 'billing', title: 'Your plan is cancelled', body: `You keep your current plan until ${until}, then move to Free. Your books stay safe.`, link: '/dashboard/billing' });
    return { until: p.current_period_end as string };
  }
  const { data: a } = await admin.from('narration_accounts').select('tier, provider, provider_subscription_id, period_end').eq('user_id', userId).maybeSingle();
  if (!a?.tier || !a.provider_subscription_id) throw new HttpError(400, "You don't have a narration add-on to cancel.");
  if (a.provider === 'stripe') await stripe().subscriptions.update(a.provider_subscription_id, { cancel_at_period_end: true });
  else await cancelPayPal(a.provider_subscription_id, 'Cancelled by author');
  await admin.from('narration_accounts').update({ status: 'cancelled' }).eq('user_id', userId);
  const until = a.period_end ? new Date(a.period_end).toLocaleDateString('en-GB') : 'the end of this month';
  await logActivity(userId, 'billing.narration_cancelled', {});
  await notify(userId, { pref: 'billing', category: 'billing', title: 'Your narration add-on is cancelled', body: `You can keep narrating with this month's credits until ${until}. Top-up credits stay with you.`, link: '/dashboard/billing' });
  return { until: a.period_end as string };
}

/** Takes back a Stripe "cancel at period end" before it happens. */
export async function resumeRenewal(userId: string, what: 'plan' | 'narration') {
  const admin = createAdminClient();
  if (what === 'plan') {
    const { data: p } = await admin.from('profiles').select('stripe_subscription_id, plan_status').eq('id', userId).single();
    if (!p?.stripe_subscription_id || p.plan_status !== 'cancelled') throw new HttpError(400, 'Only card subscriptions can be resumed. For PayPal, subscribe again.');
    await stripe().subscriptions.update(p.stripe_subscription_id, { cancel_at_period_end: false });
    await admin.from('profiles').update({ plan_status: 'active' }).eq('id', userId);
    return;
  }
  const { data: a } = await admin.from('narration_accounts').select('provider, provider_subscription_id, status').eq('user_id', userId).maybeSingle();
  if (a?.provider !== 'stripe' || !a.provider_subscription_id || a.status !== 'cancelled') throw new HttpError(400, 'Only card subscriptions can be resumed. For PayPal, subscribe again.');
  await stripe().subscriptions.update(a.provider_subscription_id, { cancel_at_period_end: false });
  await admin.from('narration_accounts').update({ status: 'active' }).eq('user_id', userId);
}
