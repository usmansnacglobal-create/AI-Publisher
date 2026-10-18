import { describe, expect, it } from 'vitest';
import { coverGeometry, estimatePages, isLarge, pageCountIssues, pageLimits, spineWidth, TRIM_SIZES } from '@/lib/spine';
import { minPrintPrice, printCost, printRoyalty, printRoyaltyRate } from '@/lib/publishing';
import { restoreImages, forAI, countWords } from '@/lib/text';

describe('Amazon KDP print rules', () => {
  it('has every standard KDP paperback size', () => {
    for (const k of ['5x8', '5.06x7.81', '5.25x8', '5.5x8.5', '6x9', '6.14x9.21', '6.69x9.61', '7x10', '7.44x9.69', '7.5x9.25', '8x10', '8.25x6', '8.25x8.25', '8.5x8.5', '8.5x11', '8.27x11.69']) expect(TRIM_SIZES[k], k).toBeTruthy();
  });

  it('knows which sizes are "large"', () => {
    expect(isLarge('6x9')).toBe(false);
    expect(isLarge('6.14x9.21')).toBe(true);
    expect(isLarge('5.5x8.5')).toBe(false);
    expect(isLarge('8.5x11')).toBe(true);
  });

  it('matches Amazon’s published printing costs', () => {
    // Amazon's own examples (120 pages): standard regular $4.06, standard large $5.82, premium regular $8.80, premium large $10.60.
    expect(printCost(120, { trim: '6x9', ink: 'standard' })).toBe(4.06);
    expect(printCost(120, { trim: '7x10', ink: 'standard' })).toBe(5.82);
    expect(printCost(120, { trim: '6x9', ink: 'premium' })).toBe(8.8);
    expect(printCost(120, { trim: '7x10', ink: 'premium' })).toBe(10.6);
    expect(printCost(100, { trim: '6x9' })).toBe(2.3);
    expect(printCost(100, { trim: '7x10' })).toBe(2.84);
    expect(printCost(300, { trim: '6x9' })).toBe(4.6);
    expect(printCost(300, { trim: '7x10' })).toBe(6.1);
    expect(printCost(100, { trim: '6x9', binding: 'hardcover' })).toBe(6.8);
    expect(printCost(300, { trim: '6x9', binding: 'hardcover' })).toBe(9.25);
    expect(printCost(300, { trim: '7x10', binding: 'hardcover', ink: 'premium' })).toBe(29.65);
  });

  it('uses the 50% / 60% royalty bands and a minimum price that covers printing', () => {
    expect(printRoyaltyRate(9.98)).toBe(0.5);
    expect(printRoyaltyRate(9.99)).toBe(0.6);
    expect(printRoyalty(14.99, 300, { trim: '6x9' })).toBe(4.39);
    const min = minPrintPrice(300, { trim: '6x9' });
    expect(min * printRoyaltyRate(min)).toBeGreaterThanOrEqual(printCost(300, { trim: '6x9' }));
    const minColour = minPrintPrice(200, { trim: '8.5x8.5', ink: 'premium' });
    expect(minColour * printRoyaltyRate(minColour)).toBeGreaterThanOrEqual(printCost(200, { trim: '8.5x8.5', ink: 'premium' }));
  });

  it('applies Amazon’s page limits', () => {
    expect(pageLimits('6x9', 'bw', 'white')).toEqual({ min: 24, max: 828 });
    expect(pageLimits('6x9', 'bw', 'cream')).toEqual({ min: 24, max: 776 });
    expect(pageLimits('6x9', 'standard', 'white')).toEqual({ min: 72, max: 600 });
    expect(pageLimits('8.5x11', 'bw', 'white')).toEqual({ min: 24, max: 590 });
    expect(pageLimits('8.27x11.69', 'standard', 'white')).toBeNull();
    expect(pageLimits('6x9', 'bw', 'white', 'hardcover')).toEqual({ min: 75, max: 550 });
    expect(pageLimits('5x8', 'bw', 'white', 'hardcover')).toBeNull();
    expect(pageLimits('6x9', 'standard', 'white', 'hardcover')).toBeNull();
    expect(pageCountIssues(900, '6x9', 'bw', 'white')[0]).toMatch(/up to 828 pages/);
    expect(pageCountIssues(50, '6x9', 'standard', 'white')[0]).toMatch(/at least 72/);
    expect(pageCountIssues(300, '6x9', 'bw', 'white')).toEqual([]);
  });

  it('sizes spines and covers like Amazon', () => {
    expect(spineWidth(200, 'white')).toBe(0.4504);
    expect(spineWidth(200, 'cream')).toBe(0.5);
    expect(spineWidth(200, 'cream', 'premium')).toBe(0.4694); // colour prints on white paper
    const pb = coverGeometry('6x9', 200, 'white', 'bw', 'paperback');
    expect(pb.width).toBeCloseTo(12.7004, 3);
    expect(pb.height).toBeCloseTo(9.25, 3);
    const hc = coverGeometry('6x9', 200, 'white', 'bw', 'hardcover');
    expect(hc.width).toBeCloseTo(14.215, 2);
    expect(hc.height).toBeCloseTo(10.418, 2);
  });

  it('estimates more words per page on bigger pages', () => {
    expect(estimatePages(60000, '8.5x11', 20)).toBeLessThan(estimatePages(60000, '6x9', 20));
    expect(estimatePages(60000, '6x9', 20) % 2).toBe(0);
  });
});

describe('images in chapters', () => {
  const md = 'Intro paragraph.\n\n![A harbour at dawn](/api/books/00000000-0000-0000-0000-000000000000/images/abcdefgh-1234.png "medium")\n\nMore text.';
  it('hides images from the AI and puts them back afterwards', () => {
    expect(forAI(md)).toContain('[Image: A harbour at dawn]');
    expect(forAI(md)).not.toContain('/api/books');
    const rewritten = 'A new intro.\n\n[Image: A harbour at dawn]\n\nNew ending.';
    expect(restoreImages(md, rewritten)).toContain('![A harbour at dawn](/api/books/');
    // If the AI drops an image, it's kept at the end rather than lost.
    expect(restoreImages(md, 'Only text now.')).toMatch(/Only text now\.\n\n!\[A harbour/);
  });
  it('doesn’t count image addresses as words', () => {
    expect(countWords(md)).toBe(4);
  });
});

describe('suggested prices', () => {
  it('suggests an x.99 price that earns about $3', async () => {
    const { suggestedPrintPrice } = await import('@/lib/publishing');
    const p = suggestedPrintPrice(300, { trim: '6x9' });
    expect(String(p)).toMatch(/\.99$/);
    expect(printRoyalty(p, 300, { trim: '6x9' })).toBeGreaterThanOrEqual(3);
    expect(printRoyalty(p - 1, 300, { trim: '6x9' })).toBeLessThan(3);
    const hc = suggestedPrintPrice(180, { trim: '7x10', ink: 'premium', binding: 'hardcover' });
    expect(printRoyalty(hc, 180, { trim: '7x10', ink: 'premium', binding: 'hardcover' })).toBeGreaterThanOrEqual(3);
  });
});
