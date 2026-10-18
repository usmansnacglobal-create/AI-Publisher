// Print specifications for covers and interiors, following Amazon KDP's published
// rules (checked October 2026): trim sizes, page limits, paper thickness,
// hardcover case-laminate covers and printing costs. IngramSpark uses very similar figures.

export type Ink = 'bw' | 'standard' | 'premium';
export type Paper = 'white' | 'cream';
export type Binding = 'paperback' | 'hardcover';

interface Trim {
  w: number;
  h: number;
  label: string;
  note: string;
  /** Not one of Amazon's standard sizes, but allowed as a custom paperback size. */
  custom?: boolean;
  /** Amazon offers a hardcover in this size. */
  hardcover?: boolean;
  /** Paperback page limits that differ from the usual 24–828 (white) / 24–776 (cream) / 72–600 (standard colour). */
  limits?: Partial<Record<'white' | 'cream' | 'standard' | 'premium', number | null>>;
}

export const TRIM_SIZES: Record<string, Trim> = {
  '5x8': { w: 5, h: 8, label: '5″ × 8″', note: 'Compact trade paperback, common for fiction and memoir' },
  '5.06x7.81': { w: 5.06, h: 7.81, label: '5.06″ × 7.81″', note: 'Slim trade paperback, popular for novels' },
  '5.25x8': { w: 5.25, h: 8, label: '5.25″ × 8″', note: 'Compact trade paperback' },
  '5.5x8.5': { w: 5.5, h: 8.5, label: '5.5″ × 8.5″', note: 'Standard trade paperback for fiction and memoir', hardcover: true },
  '6x9': { w: 6, h: 9, label: '6″ × 9″', note: 'The most common size for non-fiction and business books', hardcover: true },
  '6.14x9.21': { w: 6.14, h: 9.21, label: '6.14″ × 9.21″', note: 'Royal size, common for hardcovers and academic books', hardcover: true },
  '6.69x9.61': { w: 6.69, h: 9.61, label: '6.69″ × 9.61″', note: 'Larger non-fiction and textbooks' },
  '7x10': { w: 7, h: 10, label: '7″ × 10″', note: 'Textbooks, guides and books with images', hardcover: true },
  '7.44x9.69': { w: 7.44, h: 9.69, label: '7.44″ × 9.69″', note: 'Crown quarto: illustrated non-fiction' },
  '7.5x9.25': { w: 7.5, h: 9.25, label: '7.5″ × 9.25″', note: 'Illustrated non-fiction and cookbooks' },
  '8x10': { w: 8, h: 10, label: '8″ × 10″', note: 'Photo books, cookbooks and children’s books' },
  '8.25x6': { w: 8.25, h: 6, label: '8.25″ × 6″ (landscape)', note: 'Landscape: photo and children’s books', limits: { white: 800, cream: 750, premium: 800 } },
  '8.25x8.25': { w: 8.25, h: 8.25, label: '8.25″ × 8.25″', note: 'Square: picture books and photo books', limits: { white: 800, cream: 750, premium: 800 } },
  '8.27x11.69': { w: 8.27, h: 11.69, label: '8.27″ × 11.69″ (A4)', note: 'A4: workbooks and manuals', limits: { white: 780, cream: 730, standard: null, premium: 590 } },
  '8.5x8.5': { w: 8.5, h: 8.5, label: '8.5″ × 8.5″', note: 'Square: picture books, cookbooks and children’s books', limits: { white: 590, cream: 550, premium: 590 } },
  '8.5x11': { w: 8.5, h: 11, label: '8.5″ × 11″', note: 'Letter size: workbooks, manuals and journals', limits: { white: 590, cream: 550, premium: 590 } },
  '8.25x11': { w: 8.25, h: 11, label: '8.25″ × 11″', note: 'Large hardcover size (a custom size for paperbacks)', hardcover: true, custom: true },
  '4.25x7': { w: 4.25, h: 7, label: '4.25″ × 7″ (pocket)', note: 'Mass-market pocket size (a custom size on Amazon)', custom: true },
};

/** Amazon counts a book as "large" (higher printing costs) above these. */
export const isLarge = (trim: string) => {
  const t = TRIM_SIZES[trim] ?? TRIM_SIZES['6x9'];
  return t.w > 6.12 || t.h > 9;
};

export const INKS: Record<Ink, { label: string; note: string }> = {
  bw: { label: 'Black and white', note: 'Text, line art and greyscale photos. The most affordable to print.' },
  standard: { label: 'Standard colour', note: 'Colour on lighter paper. Good for books with occasional colour images. 72 pages or more.' },
  premium: { label: 'Premium colour', note: 'Rich colour on heavier paper. Best for photo books, cookbooks and children’s books.' },
};

/** Inches of spine per page. */
export function paperThickness(paper: Paper, ink: Ink) {
  if (ink === 'premium') return 0.002347;
  if (ink === 'standard') return 0.002252;
  return paper === 'cream' ? 0.0025 : 0.002252;
}

export const BLEED = 0.125;
/** Hardcover (case laminate) cover parts, in inches. */
export const HARDCOVER = { wrap: 0.591, hinge: 0.394, boardW: 0.197, boardH: 0.236, spineBoard: 0.189 } as const;

/** Colour is printed on white paper only. */
export const effectivePaper = (paper: Paper, ink: Ink): Paper => (ink === 'bw' ? paper : 'white');

/** The page range Amazon accepts for this size, ink, paper and binding. null = not available. */
export function pageLimits(trim: string, ink: Ink, paper: Paper, binding: Binding = 'paperback'): { min: number; max: number } | null {
  const t = TRIM_SIZES[trim] ?? TRIM_SIZES['6x9'];
  const p = effectivePaper(paper, ink);
  if (binding === 'hardcover') {
    if (!t.hardcover || ink === 'standard') return null;
    return { min: 75, max: 550 };
  }
  const key = ink === 'bw' ? p : ink;
  const base = { white: 828, cream: 776, standard: 600, premium: 828 }[key];
  const max = t.limits && key in t.limits ? t.limits[key] : base;
  if (max === null || max === undefined) return null;
  return { min: ink === 'standard' ? 72 : 24, max };
}

/** Plain-English problems with the page count, if any. */
export function pageCountIssues(pages: number, trim: string, ink: Ink, paper: Paper, binding: Binding = 'paperback'): string[] {
  const t = TRIM_SIZES[trim] ?? TRIM_SIZES['6x9'];
  const lim = pageLimits(trim, ink, paper, binding);
  const what = binding === 'hardcover' ? 'hardcovers' : 'paperbacks';
  if (!lim) {
    if (binding === 'hardcover' && !t.hardcover) return [`Amazon doesn’t print hardcovers in ${t.label}. Hardcover sizes: 5.5″ × 8.5″, 6″ × 9″, 6.14″ × 9.21″, 7″ × 10″ and 8.25″ × 11″.`];
    if (binding === 'hardcover' && ink === 'standard') return ['Standard colour isn’t available for hardcovers. Choose black and white or premium colour.'];
    return [`${INKS[ink].label} isn’t available in ${t.label}.`];
  }
  if (pages < lim.min) return [`Amazon needs at least ${lim.min} pages for ${INKS[ink].label.toLowerCase()} ${what}; this book has about ${pages}.`];
  if (pages > lim.max) return [`Amazon prints up to ${lim.max} pages for ${INKS[ink].label.toLowerCase()} ${what} in ${t.label}${ink === 'bw' ? ` on ${effectivePaper(paper, ink)} paper` : ''}; this book has about ${pages}. Use a larger trim size, a smaller font, or split it into two volumes.`];
  return [];
}

/** Typical words per printed page for each trim at our interior settings. */
function wordsPerPage(trim: string) {
  const t = TRIM_SIZES[trim] ?? TRIM_SIZES['6x9'];
  // Text area scales with the page area (minus margins); calibrated so 6″ × 9″ ≈ 330 words.
  const area = (t.w - 1.3) * (t.h - 1.45);
  return Math.round((area / ((6 - 1.3) * (9 - 1.45))) * 330);
}

/** Estimated page count (used until a real interior PDF has been produced). */
export function estimatePages(words: number, trim: string, chapters: number) {
  // body pages + roughly half a page lost per chapter opening + ~8 front/back matter pages
  const pages = Math.ceil(words / wordsPerPage(trim) + chapters * 0.6 + 8);
  return Math.max(24, pages + (pages % 2)); // even page count, KDP minimum 24
}

export function spineWidth(pages: number, paper: Paper, ink: Ink = 'bw') {
  return +(pages * paperThickness(effectivePaper(paper, ink), ink)).toFixed(4);
}

export interface CoverGeometry {
  /** Each cover panel (front or back) excluding bleed/wrap, in inches. */
  trimW: number;
  trimH: number;
  spine: number;
  /** Bleed (paperback) or wrap (hardcover) on every outside edge. */
  bleed: number;
  /** Keep text this far inside the panel edges. */
  safe: number;
  width: number;
  height: number;
}

/** Full-wrap cover size (back, spine, front) for a paperback or hardcover. */
export function coverGeometry(trim: string, pages: number, paper: Paper, ink: Ink, binding: Binding): CoverGeometry {
  const t = TRIM_SIZES[trim] ?? TRIM_SIZES['6x9'];
  const paperSpine = spineWidth(pages, paper, ink);
  if (binding === 'hardcover') {
    const trimW = t.w + HARDCOVER.boardW;
    const trimH = t.h + HARDCOVER.boardH;
    const spine = +(paperSpine + HARDCOVER.spineBoard).toFixed(4);
    // Keep lettering clear of the hinge beside the spine and of the board edges.
    return { trimW, trimH, spine, bleed: HARDCOVER.wrap, safe: HARDCOVER.hinge + 0.125, width: +(trimW * 2 + spine + HARDCOVER.wrap * 2).toFixed(4), height: +(trimH + HARDCOVER.wrap * 2).toFixed(4) };
  }
  return { trimW: t.w, trimH: t.h, spine: paperSpine, bleed: BLEED, safe: 0.25, width: +(t.w * 2 + paperSpine + BLEED * 2).toFixed(4), height: +(t.h + BLEED * 2).toFixed(4) };
}

/** Kept for older callers: the paperback wrap. */
export function wrapSize(trim: string, pages: number, paper: Paper, ink: Ink = 'bw') {
  const g = coverGeometry(trim, pages, paper, ink, 'paperback');
  return { width: g.width, height: g.height, spine: g.spine, trimW: g.trimW, trimH: g.trimH };
}

/** KDP needs at least 79 pages before text is allowed on the spine. */
export function spineTextAllowed(pages: number) {
  return pages >= 79;
}
