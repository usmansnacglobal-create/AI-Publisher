import { isLarge, type Binding, type Ink } from './spine';

export const PLATFORMS = {
  amazon_kdp: { label: 'Amazon Kindle', formats: ['ebook'] },
  apple_books: { label: 'Apple Books', formats: ['ebook'] },
  barnes_noble: { label: 'Barnes & Noble', formats: ['ebook'] },
  kobo: { label: 'Kobo', formats: ['ebook'] },
  google_play: { label: 'Google Play Books', formats: ['ebook'] },
  draft2digital: { label: 'Draft2Digital (many smaller stores and libraries)', formats: ['ebook'] },
  smashwords: { label: 'Smashwords', formats: ['ebook'] },
  amazon_kdp_print: { label: 'Amazon KDP Print', formats: ['paperback'] },
  amazon_kdp_hardcover: { label: 'Amazon KDP Hardcover', formats: ['hardcover'] },
  ingramspark: { label: 'IngramSpark (bookshops and libraries)', formats: ['paperback', 'hardcover'] },
  audible_acx: { label: 'Audible / ACX', formats: ['audiobook'] },
  spotify: { label: 'Spotify', formats: ['audiobook'] },
  apple_audio: { label: 'Apple Books audiobooks', formats: ['audiobook'] },
} as const;
export type PlatformId = keyof typeof PLATFORMS;
export const PLATFORM_IDS = Object.keys(PLATFORMS) as [PlatformId, ...PlatformId[]];

export const BISAC = [
  'Biography & Autobiography', 'Business & Economics', 'Cooking', 'Education', 'Fiction / General', 'Fiction / Fantasy', 'Fiction / Historical',
  'Fiction / Mystery & Detective', 'Fiction / Romance', 'Fiction / Science Fiction', 'Fiction / Thrillers', 'Health & Fitness', 'History',
  'Juvenile Fiction', 'Philosophy', 'Political Science', 'Psychology', 'Religion & Spirituality', 'Science', 'Self-Help', 'Sports & Recreation',
  'Technology & Engineering', 'Travel', 'Young Adult Fiction',
];

export const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch', 'Arabic', 'Urdu', 'Hindi', 'Chinese', 'Japanese'];
export const EDITIONS = ['First Edition', 'Second Edition', 'Revised Edition', 'Anniversary Edition'];

export interface PrintSpec {
  trim?: string;
  ink?: Ink;
  binding?: Binding;
}

/** Amazon KDP (US) printing cost per copy, from its published table (October 2026). */
export function printCost(pages: number, spec: PrintSpec = {}) {
  const { ink = 'bw', binding = 'paperback' } = spec;
  const large = isLarge(spec.trim ?? '6x9');
  const n = pages || 200;
  let cost: number;
  if (binding === 'hardcover') {
    if (ink === 'premium') cost = 5.65 + n * (large ? 0.08 : 0.065);
    else cost = n <= 108 ? (large ? 7.49 : 6.8) : 5.65 + n * (large ? 0.017 : 0.012);
  } else if (ink === 'premium') {
    cost = 1 + n * (large ? 0.08 : 0.065);
  } else if (ink === 'standard') {
    cost = 1 + n * (large ? 0.0402 : 0.0255);
  } else {
    cost = n <= 108 ? (large ? 2.84 : 2.3) : 1 + n * (large ? 0.017 : 0.012);
  }
  return +cost.toFixed(2);
}

/** Amazon.com print royalty: 60% at $9.99 and above, 50% below. */
export const printRoyaltyRate = (price: number) => (price >= 9.99 ? 0.6 : 0.5);

/**
 * A sensible starting price: the lowest "x.99" price that earns the author about $3 a copy
 * (never below Amazon's minimum). Authors can change it.
 */
export function suggestedPrintPrice(pages: number, spec: PrintSpec = {}, earn = 3) {
  const cost = printCost(pages, spec);
  for (let p = 4.99; p < 250; p += 1) {
    const price = +p.toFixed(2);
    if (price * printRoyaltyRate(price) - cost >= earn) return Math.max(price, minPrintPrice(pages, spec));
  }
  return 249.99;
}

/** Amazon's minimum list price: the price where the royalty covers printing. */
export function minPrintPrice(pages: number, spec: PrintSpec = {}) {
  const cost = printCost(pages, spec);
  const at50 = Math.ceil((cost / 0.5) * 100) / 100;
  if (at50 < 9.99) return at50;
  return Math.max(9.99, Math.ceil((cost / 0.6) * 100) / 100);
}
export function printRoyalty(price: number, pages: number, spec: PrintSpec = {}) {
  return +(price * printRoyaltyRate(price) - printCost(pages, spec)).toFixed(2);
}
/** Kindle royalty: 70% between $2.99 and $9.99, otherwise 35% (delivery fees ignored). */
export function ebookRoyalty(price: number) {
  return +(price * (price >= 2.99 && price <= 9.99 ? 0.7 : 0.35)).toFixed(2);
}
