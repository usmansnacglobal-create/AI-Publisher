// Printed author copies: pricing and order rules. Shared by the calculator (browser)
// and the server, so the price an author sees is the price they're charged.
import { isLarge, pageLimits, TRIM_SIZES, type Binding, type Ink, type Paper } from './spine';

export interface Rate {
  /** Per-copy cost: cover and binding. */
  unit: number;
  /** Per-page cost of the interior. */
  page: number;
}

export interface ShippingZone {
  label: string;
  /** Charged once per order. */
  order: number;
  /** Charged for each copy. */
  perBook: number;
  /** Rough delivery estimate shown to authors. */
  days: string;
}

export interface PrintPricing {
  /** Our price = IngramSpark's printing cost × this. */
  multiplier: number;
  currency: 'USD';
  /** IngramSpark's printing costs (what we pay), per binding and ink. */
  rates: {
    paperback: Record<Ink, Rate>;
    hardcover: Record<Exclude<Ink, 'standard'>, Rate>;
  };
  /** Large trims (over 6.12″ wide or 9″ tall) cost more per page. */
  largeTrimPageFactor: number;
  /** Also double the shipping? Off by default: shipping is passed on at cost. */
  markupShipping: boolean;
  shipping: Record<string, ShippingZone>;
  maxQuantity: number;
  /** When the rates were last checked against IngramSpark's calculator. */
  checkedOn: string;
}

/**
 * Starting values. Paperback black-and-white uses IngramSpark's published February 2026 US rate
 * ($1.33 a copy plus $0.0146 a page). IngramSpark doesn't publish the others, so they are
 * estimates for the admin to replace with figures from IngramSpark's Print & Ship calculator.
 */
export const DEFAULT_PRINT_PRICING: PrintPricing = {
  multiplier: 2,
  currency: 'USD',
  rates: {
    paperback: { bw: { unit: 1.33, page: 0.0146 }, standard: { unit: 1.33, page: 0.04 }, premium: { unit: 1.33, page: 0.1 } },
    hardcover: { bw: { unit: 5.5, page: 0.0146 }, premium: { unit: 5.5, page: 0.1 } },
  },
  largeTrimPageFactor: 1.25,
  markupShipping: false,
  shipping: {
    us: { label: 'United States', order: 6, perBook: 1.25, days: '5–10 working days' },
    uk: { label: 'United Kingdom', order: 6, perBook: 1.25, days: '5–10 working days' },
    ca: { label: 'Canada', order: 12, perBook: 2.5, days: '7–14 working days' },
    eu: { label: 'Europe', order: 14, perBook: 3, days: '7–14 working days' },
    au: { label: 'Australia and New Zealand', order: 16, perBook: 3.5, days: '10–20 working days' },
    world: { label: 'Rest of the world', order: 20, perBook: 4.5, days: '10–25 working days' },
  },
  maxQuantity: 1000,
  checkedOn: '2026-10-18',
};

const num = (v: unknown, d: number, min = 0, max = 10_000) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : d;
};

/** Fills gaps and rejects nonsense in stored settings. */
export function normalisePricing(raw: unknown): PrintPricing {
  const r = (raw ?? {}) as Partial<PrintPricing>;
  const d = DEFAULT_PRINT_PRICING;
  const rate = (x: Partial<Rate> | undefined, def: Rate): Rate => ({ unit: num(x?.unit, def.unit, 0, 500), page: num(x?.page, def.page, 0, 5) });
  const zones: Record<string, ShippingZone> = {};
  const rawZones = r.shipping && typeof r.shipping === 'object' && Object.keys(r.shipping).length ? r.shipping : d.shipping;
  for (const [k, z] of Object.entries(rawZones)) {
    if (!/^[a-z0-9_-]{1,20}$/.test(k)) continue;
    zones[k] = { label: String(z?.label ?? k).slice(0, 60), order: num(z?.order, 0, 0, 1000), perBook: num(z?.perBook, 0, 0, 200), days: String(z?.days ?? '').slice(0, 60) };
  }
  return {
    multiplier: num(r.multiplier, d.multiplier, 1, 10),
    currency: 'USD',
    rates: {
      paperback: {
        bw: rate(r.rates?.paperback?.bw, d.rates.paperback.bw),
        standard: rate(r.rates?.paperback?.standard, d.rates.paperback.standard),
        premium: rate(r.rates?.paperback?.premium, d.rates.paperback.premium),
      },
      hardcover: {
        bw: rate(r.rates?.hardcover?.bw, d.rates.hardcover.bw),
        premium: rate(r.rates?.hardcover?.premium, d.rates.hardcover.premium),
      },
    },
    largeTrimPageFactor: num(r.largeTrimPageFactor, d.largeTrimPageFactor, 1, 3),
    markupShipping: !!r.markupShipping,
    shipping: Object.keys(zones).length ? zones : d.shipping,
    maxQuantity: Math.round(num(r.maxQuantity, d.maxQuantity, 1, 5000)),
    checkedOn: typeof r.checkedOn === 'string' ? r.checkedOn.slice(0, 20) : d.checkedOn,
  };
}

export interface QuoteInput {
  binding: Binding;
  ink: Ink;
  trim: string;
  paper: Paper;
  pages: number;
  quantity: number;
  region: string;
}

export interface Quote {
  /** IngramSpark's printing cost for one copy (what we pay). */
  baseUnit: number;
  /** What the author pays per copy. */
  unitPrice: number;
  printTotal: number;
  shipping: number;
  total: number;
  /** Plain-English reasons the order can't be placed as it is. */
  problems: string[];
}

const money = (n: number) => Math.round(n * 100) / 100;

/** The price of an order. Pages are rounded up to an even number, as printers do. */
export function quote(input: QuoteInput, pricing: PrintPricing): Quote {
  const pages = Math.max(1, Math.ceil(input.pages / 2) * 2);
  const problems: string[] = [];
  const t = TRIM_SIZES[input.trim];
  if (!t) problems.push('Choose a trim size on the Layout tab first.');
  const lim = pageLimits(input.trim, input.ink, input.paper, input.binding);
  if (!lim) problems.push(input.binding === 'hardcover' ? 'This size or colour option isn’t available as a hardcover. Hardcovers come in 5.5″ × 8.5″, 6″ × 9″, 6.14″ × 9.21″, 7″ × 10″ and 8.25″ × 11″, in black and white or premium colour.' : 'This size and colour combination can’t be printed.');
  else if (pages < lim.min || pages > lim.max) problems.push(`Printed ${input.binding === 'hardcover' ? 'hardcovers' : 'paperbacks'} in this size need ${lim.min} to ${lim.max} pages; this book has ${pages}.`);
  const zone = pricing.shipping[input.region];
  if (!zone) problems.push('Choose where the books are going.');
  const quantity = Math.round(input.quantity);
  if (!(quantity >= 1)) problems.push('Order at least one copy.');
  if (quantity > pricing.maxQuantity) problems.push(`For more than ${pricing.maxQuantity} copies, contact us for a quote.`);

  const rates = input.binding === 'hardcover' ? pricing.rates.hardcover : pricing.rates.paperback;
  const rate = (rates as Record<string, Rate>)[input.binding === 'hardcover' && input.ink === 'standard' ? 'premium' : input.ink] ?? pricing.rates.paperback.bw;
  const perPage = rate.page * (t && isLarge(input.trim) ? pricing.largeTrimPageFactor : 1);
  const baseUnit = money(rate.unit + perPage * pages);
  const unitPrice = money(baseUnit * pricing.multiplier);
  const q = Math.max(0, Math.min(quantity || 0, pricing.maxQuantity));
  const printTotal = money(unitPrice * q);
  const shipBase = zone ? zone.order + zone.perBook * q : 0;
  const shipping = money(pricing.markupShipping ? shipBase * pricing.multiplier : shipBase);
  return { baseUnit, unitPrice, printTotal, shipping, total: money(printTotal + shipping), problems };
}

export const ORDER_STATUS: Record<string, { label: string; note: string }> = {
  awaiting_payment: { label: 'Awaiting payment', note: 'We’ll start printing once payment is received.' },
  paid: { label: 'Paid', note: 'Payment received. Your order is queued for printing.' },
  in_production: { label: 'Printing', note: 'Your books are being printed.' },
  shipped: { label: 'Shipped', note: 'On the way to you.' },
  delivered: { label: 'Delivered', note: 'Delivered. Enjoy your books!' },
  cancelled: { label: 'Cancelled', note: 'This order was cancelled.' },
};
