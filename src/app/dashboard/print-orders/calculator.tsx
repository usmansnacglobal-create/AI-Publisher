'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Calculator } from 'lucide-react';
import { INKS, TRIM_SIZES, type Binding, type Ink, type Paper } from '@/lib/spine';
import type { PrintPricing } from '@/lib/print-orders';
import { getQuote, PriceBreakdown, Problems, QuantityInput, RegionSelect } from '@/components/print-calculator';

type BookOpt = { id: string; title: string; trim: string; pages: number };

/** A price calculator for any size and page count, before a book is finished. */
export function StandaloneCalculator({ pricing, books }: { pricing: PrintPricing; books: BookOpt[] }) {
  const [bookId, setBookId] = useState('');
  const [binding, setBinding] = useState<Binding>('paperback');
  const [trim, setTrim] = useState('6x9');
  const [ink, setInk] = useState<Ink>('bw');
  const [paper, setPaper] = useState<Paper>('white');
  const [pages, setPages] = useState(300);
  const [quantity, setQuantity] = useState(10);
  const [region, setRegion] = useState(Object.keys(pricing.shipping)[0]);
  const q = getQuote({ binding, ink, trim, paper, pages, quantity, region }, pricing)!;

  function pickBook(id: string) {
    setBookId(id);
    const b = books.find((x) => x.id === id);
    if (b) {
      if (TRIM_SIZES[b.trim]) setTrim(b.trim);
      if (b.pages) setPages(b.pages);
    }
  }

  return (
    <aside className="panel h-fit space-y-4 p-5" aria-labelledby="calc">
      <h2 id="calc" className="flex items-center gap-2 text-[1.15rem]"><Calculator className="h-5 w-5 text-cloth" aria-hidden />Price calculator</h2>
      <p className="text-[13px] text-ink-muted">See what printed copies cost for any size and length.</p>
      {books.length > 0 && (
        <div>
          <label htmlFor="c-book" className="label">Start from one of your books (optional)</label>
          <select id="c-book" className="field" value={bookId} onChange={(e) => pickBook(e.target.value)}>
            <option value="">Choose a book…</option>
            {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="c-binding" className="label">Binding</label>
          <select id="c-binding" className="field" value={binding} onChange={(e) => setBinding(e.target.value as Binding)}>
            <option value="paperback">Paperback</option><option value="hardcover">Hardcover</option>
          </select>
        </div>
        <div>
          <label htmlFor="c-pages" className="label">Pages</label>
          <input id="c-pages" type="number" min={24} max={1000} className="field" value={pages} onChange={(e) => setPages(Math.max(1, Math.round(Number(e.target.value) || 1)))} />
        </div>
        <div className="col-span-2">
          <label htmlFor="c-trim" className="label">Trim size</label>
          <select id="c-trim" className="field" value={trim} onChange={(e) => setTrim(e.target.value)}>
            {Object.entries(TRIM_SIZES).map(([k, t]) => <option key={k} value={k}>{t.label}{t.hardcover ? ' (paperback or hardcover)' : ''}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="c-ink" className="label">Interior</label>
          <select id="c-ink" className="field" value={ink} onChange={(e) => setInk(e.target.value as Ink)}>
            {(Object.keys(INKS) as Ink[]).map((k) => <option key={k} value={k}>{INKS[k].label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="c-paper" className="label">Paper</label>
          <select id="c-paper" className="field" value={ink === 'bw' ? paper : 'white'} disabled={ink !== 'bw'} onChange={(e) => setPaper(e.target.value as Paper)}>
            <option value="white">White</option><option value="cream">Cream</option>
          </select>
        </div>
      </div>
      <QuantityInput value={quantity} onChange={setQuantity} max={pricing.maxQuantity} />
      <RegionSelect value={region} onChange={setRegion} pricing={pricing} />
      <PriceBreakdown q={q} quantity={quantity} pricing={pricing} region={region} />
      <Problems items={q.problems} />
      {bookId && <Link href={`/dashboard/books/${bookId}/print`} className="inline-block text-[14px] text-cloth underline">Order copies of this book</Link>}
    </aside>
  );
}
