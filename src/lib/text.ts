export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const m = text.replace(/[#*_>`~]+/g, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}

export interface BookProgress {
  words: number;
  targetWords: number;
  wordPercent: number;
  chaptersDone: number;
  chaptersTotal: number;
  chapterPercent: number;
}

/**
 * The single source of truth for book progress, used on every screen so the
 * numbers always match.
 */
export function bookProgress(
  book: { target_words: number; target_chapters: number },
  chapters: { word_count: number; status: string }[],
): BookProgress {
  const words = chapters.reduce((s, c) => s + (c.word_count || 0), 0);
  const chaptersDone = chapters.filter((c) => c.status === 'drafted' && c.word_count > 0).length;
  const chaptersTotal = Math.max(chapters.length, book.target_chapters || 0);
  return {
    words,
    targetWords: book.target_words,
    wordPercent: book.target_words ? Math.min(100, Math.round((words / book.target_words) * 100)) : 0,
    chaptersDone,
    chaptersTotal,
    chapterPercent: chaptersTotal ? Math.round((chaptersDone / chaptersTotal) * 100) : 0,
  };
}

export function readingMinutes(words: number) {
  return Math.max(1, Math.round(words / 238));
}

/** Flesch reading ease (higher = easier). Returns null for very short text. */
export function fleschScore(text: string): number | null {
  const words = text.match(/[A-Za-z’']+/g) || [];
  if (words.length < 30) return null;
  const sentences = Math.max(1, (text.match(/[.!?]+(\s|$)/g) || []).length);
  const syllables = words.reduce((s, w) => s + syllableCount(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
  return Math.round(Math.max(0, Math.min(100, score)));
}

function syllableCount(word: string) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('en-GB').format(n);
}

export function compact(n: number) {
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
