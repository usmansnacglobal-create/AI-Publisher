// Interior design settings (Layout Typographer). Shared by the editor UI and the PDF/EPUB builders.
import { TRIM_SIZES, type Ink } from './spine';

export const BODY_FONTS = {
  garamond: { label: 'Garamond', file: 'EBGaramond', css: '"EB Garamond", Garamond, Georgia, serif', note: 'Classic and elegant; the most common novel face' },
  baskerville: { label: 'Baskerville', file: 'LibreBaskerville', css: '"Libre Baskerville", Baskerville, Georgia, serif', note: 'Crisp and authoritative; good for non-fiction' },
  crimson: { label: 'Minion-style serif', file: 'CrimsonText', css: '"Crimson Text", "Minion Pro", Georgia, serif', note: 'Warm and highly readable at small sizes' },
  gelasio: { label: 'Georgia-style', file: 'Gelasio', css: 'Gelasio, Georgia, serif', note: 'Sturdy and friendly; reads well on screen too' },
  lora: { label: 'Palatino-style', file: 'Lora', css: 'Lora, Palatino, "Book Antiqua", serif', note: 'Calligraphic roots, contemporary feel' },
} as const;
export type BodyFont = keyof typeof BODY_FONTS;

export const HEADING_STYLES = {
  classic: { label: 'Classic', note: '“CHAPTER ONE” in small capitals above an italic title' },
  modern: { label: 'Modern / Minimalist', note: 'A large chapter number and a plain title, left aligned' },
  decorative: { label: 'Decorative', note: 'Classic layout with a graphic ornament above the title' },
} as const;

export const PAGE_NUMBERS = {
  bottom_center: { label: 'Bottom centre', note: 'Page number centred at the bottom of every page' },
  top_outer: { label: 'Top outer corner', note: 'Page number in the top outer corner of each page' },
  bottom_outer: { label: 'Alternating margins', note: 'Bottom outer corner: left on even pages, right on odd pages' },
  hidden_openers: { label: 'Hidden on chapter openers', note: 'Bottom centre, but not on the first page of each chapter' },
} as const;

export interface LayoutSettings {
  font: BodyFont;
  fontSize: number; // points
  paragraph: 'indented' | 'block';
  spacing: 'tight' | 'standard' | 'relaxed';
  margins: { outside: number; top: number; bottom: number }; // inches; the inside gutter is set automatically from page count
  heading: keyof typeof HEADING_STYLES;
  pageNumbers: keyof typeof PAGE_NUMBERS;
  dropCaps: boolean;
  runningHeads: boolean;
  /** Interior printing: black and white, standard colour or premium colour. */
  ink: Ink;
}

export const DEFAULT_LAYOUT: LayoutSettings = {
  font: 'garamond',
  fontSize: 11.5,
  paragraph: 'indented',
  spacing: 'standard',
  margins: { outside: 0.6, top: 0.7, bottom: 0.75 },
  heading: 'classic',
  pageNumbers: 'hidden_openers',
  dropCaps: false,
  runningHeads: true,
  ink: 'bw',
};

export const SPACING = { tight: 1.25, standard: 1.4, relaxed: 1.6 } as const;

export const TRIM_NOTES: Record<string, string> = Object.fromEntries(Object.entries(TRIM_SIZES).map(([k, t]) => [k, t.note]));

export function normaliseLayout(raw: unknown): LayoutSettings {
  const r = (raw ?? {}) as Partial<LayoutSettings>;
  const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && v >= lo && v <= hi ? v : d);
  return {
    font: r.font && r.font in BODY_FONTS ? r.font : DEFAULT_LAYOUT.font,
    fontSize: clamp(r.fontSize, 9, 14, DEFAULT_LAYOUT.fontSize),
    paragraph: r.paragraph === 'block' ? 'block' : 'indented',
    spacing: r.spacing && r.spacing in SPACING ? r.spacing : 'standard',
    margins: {
      outside: clamp(r.margins?.outside, 0.25, 1.5, DEFAULT_LAYOUT.margins.outside),
      top: clamp(r.margins?.top, 0.25, 1.5, DEFAULT_LAYOUT.margins.top),
      bottom: clamp(r.margins?.bottom, 0.25, 1.5, DEFAULT_LAYOUT.margins.bottom),
    },
    heading: r.heading && r.heading in HEADING_STYLES ? r.heading : 'classic',
    pageNumbers: r.pageNumbers && r.pageNumbers in PAGE_NUMBERS ? r.pageNumbers : 'hidden_openers',
    dropCaps: !!r.dropCaps,
    runningHeads: r.runningHeads !== false,
    ink: r.ink === 'standard' || r.ink === 'premium' ? r.ink : 'bw',
  };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
export function numberWords(n: number): string {
  if (n < 20) return ONES[n] || String(n);
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  return String(n);
}
