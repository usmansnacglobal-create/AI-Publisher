import { describe, expect, it } from 'vitest';
import { DEFAULT_PRINT_PRICING as P, normalisePricing, quote } from '@/lib/print-orders';

const base = { binding: 'paperback' as const, ink: 'bw' as const, trim: '6x9', paper: 'white' as const, pages: 500, quantity: 1, region: 'us' };

describe('print order pricing', () => {
  it('charges twice IngramSpark’s printing cost', () => {
    const q = quote(base, P);
    expect(q.baseUnit).toBe(8.63); // $1.33 + 500 × $0.0146
    expect(q.unitPrice).toBe(17.26);
    expect(q.problems).toEqual([]);
  });
  it('multiplies by quantity and adds shipping at cost', () => {
    const q = quote({ ...base, quantity: 10 }, P);
    expect(q.printTotal).toBe(172.6);
    expect(q.shipping).toBe(6 + 1.25 * 10);
    expect(q.total).toBe(191.1);
  });
  it('can apply the markup to shipping too', () => {
    const q = quote({ ...base, quantity: 10 }, { ...P, markupShipping: true });
    expect(q.shipping).toBe(37);
  });
  it('follows the admin’s multiplier and rates', () => {
    const custom = normalisePricing({ ...P, multiplier: 2.5, rates: { ...P.rates, paperback: { ...P.rates.paperback, bw: { unit: 2, page: 0.02 } } } });
    expect(quote(base, custom).unitPrice).toBe(30);
  });
  it('charges more per page for large trims', () => {
    expect(quote({ ...base, trim: '7x10' }, P).baseUnit).toBeGreaterThan(quote(base, P).baseUnit);
  });
  it('rounds odd page counts up to even', () => {
    expect(quote({ ...base, pages: 299 }, P).baseUnit).toBe(quote({ ...base, pages: 300 }, P).baseUnit);
  });
  it('refuses orders the printer can’t make', () => {
    expect(quote({ ...base, binding: 'hardcover', trim: '5x8' }, P).problems[0]).toMatch(/hardcover/i);
    expect(quote({ ...base, ink: 'standard', pages: 40 }, P).problems[0]).toMatch(/72 to 600/);
    expect(quote({ ...base, quantity: 5000 }, P).problems[0]).toMatch(/contact us/);
    expect(quote({ ...base, region: 'mars' }, P).problems[0]).toMatch(/where/i);
  });
  it('repairs bad stored settings', () => {
    const n = normalisePricing({ multiplier: -3, rates: { paperback: { bw: { unit: 'x', page: 9 } } }, shipping: {} });
    expect(n.multiplier).toBe(2);
    expect(n.rates.paperback.bw).toEqual(P.rates.paperback.bw);
    expect(Object.keys(n.shipping).length).toBeGreaterThan(0);
  });
});
