/**
 * Everything authors can buy, in both currencies. Safe to use in the browser.
 *
 * Narration is sold as an add-on subscription on top of any main plan. It is
 * measured in narration credits: Turbo uses 1 credit per character and Standard
 * uses 2, because Standard costs twice as much at ElevenLabs. Prices are set at
 * 10× or more of the worst-case ElevenLabs cost after payment fees (see
 * tests/narration.test.ts, which fails if a price drops below that).
 */
export type Currency = 'USD' | 'GBP';
export const CURRENCIES: Record<Currency, { symbol: string; label: string }> = {
  GBP: { symbol: '£', label: 'British pounds (£)' },
  USD: { symbol: '$', label: 'US dollars ($)' },
};
export const isCurrency = (c: unknown): c is Currency => c === 'USD' || c === 'GBP';

export function money(amount: number, currency: Currency) {
  const whole = Number.isInteger(amount);
  return `${CURRENCIES[currency].symbol}${amount.toLocaleString('en-GB', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

// ───────────── Narration ─────────────

export type Quality = 'turbo' | 'standard';
export const QUALITIES: Record<Quality, { label: string; note: string; creditsPerChar: number }> = {
  turbo: { label: 'Turbo', note: 'Natural, expressive narration. Uses 1 credit per character.', creditsPerChar: 1 },
  standard: { label: 'Standard', note: 'Studio quality with the richest emotion. Uses 2 credits per character.', creditsPerChar: 2 },
};
export const isQuality = (q: unknown): q is Quality => q === 'turbo' || q === 'standard';

export type NarrationTier = 'starter' | 'author' | 'pro';
export interface NarrationTierInfo {
  id: NarrationTier;
  name: string;
  /** Credits included each month. Unused credits don't carry over. */
  credits: number;
  qualities: Quality[];
  prices: Record<Currency, number>;
  blurb: string;
}

export const NARRATION_TIERS: Record<NarrationTier, NarrationTierInfo> = {
  starter: { id: 'starter', name: 'Narration Starter', credits: 100_000, qualities: ['turbo'], prices: { GBP: 42, USD: 59 }, blurb: 'A novella or a few chapters each month' },
  author: { id: 'author', name: 'Narration Author', credits: 300_000, qualities: ['turbo'], prices: { GBP: 119, USD: 159 }, blurb: 'A full-length novel each month' },
  pro: { id: 'pro', name: 'Narration Pro', credits: 600_000, qualities: ['turbo', 'standard'], prices: { GBP: 239, USD: 319 }, blurb: 'Two novels a month, or one in Standard quality' },
};
export const NARRATION_TIER_ORDER: NarrationTier[] = ['starter', 'author', 'pro'];
export const isNarrationTier = (t: unknown): t is NarrationTier => typeof t === 'string' && t in NARRATION_TIERS;

/** A one-off pack of credits for authors who run out mid-month. Top-up credits never expire. */
export const TOPUP = { credits: 100_000, prices: { GBP: 42, USD: 59 } as Record<Currency, number> };

/** About 900 characters of text make a minute of narration (150 words). */
export const CHARS_PER_MINUTE = 900;

export function creditsFor(chars: number, quality: Quality) {
  return Math.ceil(chars * QUALITIES[quality].creditsPerChar);
}

/** Rough hours of audio a number of credits buys at a quality, e.g. "about 5½ hours". */
export function hoursFor(credits: number, quality: Quality = 'turbo') {
  const minutes = credits / QUALITIES[quality].creditsPerChar / CHARS_PER_MINUTE;
  const half = Math.round((minutes / 60) * 2) / 2;
  if (half < 1) return `about ${Math.max(1, Math.round(minutes / 5) * 5)} minutes`;
  const whole = Math.floor(half);
  return `about ${whole}${half % 1 ? '½' : ''} hour${half > 1 ? 's' : ''}`;
}

// ───────────── Everything sold, for Stripe and PayPal ─────────────

export type MainPaidPlan = 'pro' | 'agency';
/** Main plan prices per currency. USD matches the original plans; GBP is set to cover card fees. */
export const MAIN_PLAN_PRICES: Record<MainPaidPlan, Record<Currency, number>> = {
  pro: { USD: 29, GBP: 24 },
  agency: { USD: 79, GBP: 64 },
};

export type CatalogItem = `plan:${MainPaidPlan}` | `narration:${NarrationTier}` | 'topup';
export interface CatalogEntry {
  item: CatalogItem;
  name: string;
  recurring: boolean;
  prices: Record<Currency, number>;
}

export const CATALOG: CatalogEntry[] = [
  { item: 'plan:pro', name: 'Pro plan', recurring: true, prices: MAIN_PLAN_PRICES.pro },
  { item: 'plan:agency', name: 'Agency plan', recurring: true, prices: MAIN_PLAN_PRICES.agency },
  ...NARRATION_TIER_ORDER.map((t) => ({ item: `narration:${t}` as CatalogItem, name: NARRATION_TIERS[t].name, recurring: true, prices: NARRATION_TIERS[t].prices })),
  { item: 'topup', name: `Narration top-up (${TOPUP.credits.toLocaleString('en-GB')} credits)`, recurring: false, prices: TOPUP.prices },
];
export const catalogEntry = (item: string) => CATALOG.find((c) => c.item === item);
export const isCatalogItem = (item: unknown): item is CatalogItem => typeof item === 'string' && !!catalogEntry(item);

export function priceOf(item: CatalogItem, currency: Currency) {
  return catalogEntry(item)!.prices[currency];
}
