import { describe, expect, it } from 'vitest';
import { applyReplacement, locate } from '@/lib/apply';
import { splitIntoChapters } from '@/lib/manuscript';
import { bookProgress, countWords, fleschScore } from '@/lib/text';
import { estimatePages, spineTextAllowed, spineWidth, wrapSize } from '@/lib/spine';
import { parseInline, tidyRuns, toBlocks } from '@/lib/export/manuscript';
import { getPlan } from '@/lib/plans';

describe('tracked-change application', () => {
  const text = 'He said, “Play.” And he did — every day.\n\nThe next paragraph.';
  it('replaces an exact match', () => {
    expect(applyReplacement(text, 'every day', 'each day')).toContain('each day.');
  });
  it('matches despite straight vs curly quotes and spacing', () => {
    expect(locate(text, 'He said, "Play."  And')).not.toBeNull();
    expect(applyReplacement(text, 'He said, "Play."', 'He shouted, “Play!”')).toMatch(/^He shouted, “Play!” And/);
  });
  it('returns null when the text no longer exists', () => {
    expect(applyReplacement(text, 'missing words', 'x')).toBeNull();
  });
});

describe('manuscript import', () => {
  it('splits on chapter headings and keeps titles', () => {
    const parts = splitIntoChapters('Prologue\nIt began.\n\nChapter 1: The Start\nOne.\n\nCHAPTER TWO\nTwo.');
    expect(parts.map((p) => p.title)).toEqual(['Prologue', 'The Start', 'CHAPTER TWO']);
    expect(parts[1].content).toBe('One.');
  });
  it('chunks text with no headings', () => {
    const para = Array(500).fill('word').join(' ');
    expect(splitIntoChapters(Array(20).fill(para).join('\n\n')).length).toBeGreaterThan(1);
  });
});

describe('progress is consistent', () => {
  it('counts written chapters and words the same way everywhere', () => {
    const p = bookProgress({ target_words: 1000, target_chapters: 4 }, [
      { word_count: 300, status: 'drafted' },
      { word_count: 0, status: 'planned' },
    ]);
    expect(p).toMatchObject({ words: 300, chaptersDone: 1, chaptersTotal: 4, chapterPercent: 25, wordPercent: 30 });
  });
  it('counts words', () => {
    expect(countWords('São Paulo’s *heat*, fifty-two times.')).toBe(5);
    expect(fleschScore('Short.')).toBeNull();
  });
});

describe('print geometry', () => {
  it('computes KDP spine widths', () => {
    expect(spineWidth(200, 'white')).toBeCloseTo(0.4504, 4);
    expect(spineWidth(200, 'cream')).toBeCloseTo(0.5, 4);
    expect(spineTextAllowed(78)).toBe(false);
    expect(spineTextAllowed(79)).toBe(true);
  });
  it('estimates a realistic page count (the old tool said 30 pages for 19,500 words)', () => {
    const pages = estimatePages(19533, '6x9', 7);
    expect(pages).toBeGreaterThan(60);
    expect(pages % 2).toBe(0);
  });
  it('sizes the full wrap with bleed', () => {
    const w = wrapSize('6x9', 200, 'white');
    expect(w.width).toBeCloseTo(6 * 2 + 0.4504 + 0.25, 3);
    expect(w.height).toBeCloseTo(9.25, 3);
  });
});

describe('export formatting', () => {
  it('parses emphasis', () => {
    expect(parseInline('a *b* **c** _d_')).toEqual([{ text: 'a ' }, { text: 'b', italic: true }, { text: ' ' }, { text: 'c', bold: true }, { text: ' ' }, { text: 'd', italic: true }]);
  });
  it('detects scene breaks and first paragraphs', () => {
    const b = toBlocks('One.\n\nTwo.\n\n* * *\n\nThree.');
    expect(b.map((x) => x.type)).toEqual(['para', 'para', 'break', 'para']);
    expect(b[0].type === 'para' && b[0].first).toBe(true);
    expect(b[3].type === 'para' && b[3].first).toBe(true);
  });
  it('moves spaces and punctuation onto the previous run for PDF', () => {
    expect(tidyRuns([{ text: 'and ' }, { text: 'he did', italic: true }, { text: ', with ' }]).map((r) => r.text)).toEqual(['and ', 'he did, ', 'with ']);
  });
});

describe('plans', () => {
  it('falls back to free for unknown plans', () => {
    expect(getPlan('nonsense').id).toBe('free');
    expect(getPlan('pro').bookLimit).toBe(10);
    expect(getPlan('agency').bookLimit).toBeNull();
  });
});
