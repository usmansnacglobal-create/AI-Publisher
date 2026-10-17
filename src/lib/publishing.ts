export const PLATFORMS = {
  amazon_kdp: { label: 'Amazon Kindle', formats: ['ebook'] },
  apple_books: { label: 'Apple Books', formats: ['ebook'] },
  barnes_noble: { label: 'Barnes & Noble', formats: ['ebook'] },
  kobo: { label: 'Kobo', formats: ['ebook'] },
  google_play: { label: 'Google Play Books', formats: ['ebook'] },
  draft2digital: { label: 'Draft2Digital (many smaller stores and libraries)', formats: ['ebook'] },
  smashwords: { label: 'Smashwords', formats: ['ebook'] },
  amazon_kdp_print: { label: 'Amazon KDP Print', formats: ['paperback'] },
  ingramspark: { label: 'IngramSpark (bookshops and libraries)', formats: ['paperback'] },
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

/** Estimated Amazon KDP (US) black-and-white paperback printing cost. */
export function printCost(pages: number) {
  if (pages <= 108) return 2.3;
  return +(1 + 0.012 * pages).toFixed(2);
}
/** The lowest paperback price where the author still earns something on Amazon (60% royalty minus printing). */
export function minPrintPrice(pages: number) {
  return Math.max(4.99, Math.ceil(((printCost(pages || 200) + 0.5) / 0.6) * 100) / 100);
}
export function printRoyalty(price: number, pages: number) {
  return +(price * 0.6 - printCost(pages || 200)).toFixed(2);
}
/** Kindle royalty: 70% between $2.99 and $9.99, otherwise 35% (delivery fees ignored). */
export function ebookRoyalty(price: number) {
  return +(price * (price >= 2.99 && price <= 9.99 ? 0.7 : 0.35)).toFixed(2);
}
