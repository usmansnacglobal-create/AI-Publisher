// Print geometry for covers and interiors (KDP / IngramSpark conventions).

export const TRIM_SIZES: Record<string, { w: number; h: number; label: string }> = {
  '5x8': { w: 5, h: 8, label: '5" × 8"' },
  '5.25x8': { w: 5.25, h: 8, label: '5.25" × 8"' },
  '5.5x8.5': { w: 5.5, h: 8.5, label: '5.5" × 8.5"' },
  '6x9': { w: 6, h: 9, label: '6" × 9"' },
  '4.25x7': { w: 4.25, h: 7, label: '4.25" × 7"' },
  '8.5x8.5': { w: 8.5, h: 8.5, label: '8.5" × 8.5"' },
  '8.5x11': { w: 8.5, h: 11, label: '8.5" × 11"' },
};

/** Inches of spine per page (KDP black-ink figures). */
export const PAPER_THICKNESS = { white: 0.002252, cream: 0.0025 } as const;
export const BLEED = 0.125;

/** Typical words per printed page for each trim at our interior settings. */
const WORDS_PER_PAGE: Record<string, number> = {
  '4.25x7': 190, '5x8': 250, '5.25x8': 265, '5.5x8.5': 290, '6x9': 330, '8.5x8.5': 470, '8.5x11': 600,
};

/** Estimated page count (used until a real interior PDF has been produced). */
export function estimatePages(words: number, trim: string, chapters: number) {
  const wpp = WORDS_PER_PAGE[trim] ?? 330;
  // body pages + roughly half a page lost per chapter opening + ~8 front/back matter pages
  const pages = Math.ceil(words / wpp + chapters * 0.6 + 8);
  return Math.max(24, pages + (pages % 2)); // even page count, KDP minimum 24
}

export function spineWidth(pages: number, paper: 'white' | 'cream') {
  return +(pages * PAPER_THICKNESS[paper]).toFixed(4);
}

/** Full-wrap cover size in inches, including bleed on all sides. */
export function wrapSize(trim: string, pages: number, paper: 'white' | 'cream') {
  const t = TRIM_SIZES[trim] ?? TRIM_SIZES['6x9'];
  const spine = spineWidth(pages, paper);
  return { width: t.w * 2 + spine + BLEED * 2, height: t.h + BLEED * 2, spine, trimW: t.w, trimH: t.h };
}

/** KDP needs at least 79 pages before text is allowed on the spine. */
export function spineTextAllowed(pages: number) {
  return pages >= 79;
}
