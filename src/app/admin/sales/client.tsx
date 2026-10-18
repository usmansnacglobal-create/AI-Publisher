'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorText } from '@/lib/client';
import { PLATFORMS } from '@/lib/publishing';
import { Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

type BookOpt = { id: string; title: string; email: string };
type Sale = { id: string; title: string; period: string; store: string; format: string; units: number; pages_read: number; revenue: number; royalty: number };
type NewRow = { book_id: string; period: string; store: string; format: string; units: number; pages_read: number; revenue: number; royalty: number };

const thisMonth = () => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
const STORES = Object.entries(PLATFORMS).map(([k, v]) => [k, v.label] as const);

/** Turns pasted report lines into rows: book, month, store, format, copies, pages read, revenue, royalty. */
function parsePaste(text: string, books: BookOpt[]): { rows: NewRow[]; errors: string[] } {
  const rows: NewRow[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const c = line.split(/\t|,/).map((x) => x.trim().replace(/^"|"$/g, ''));
    if (i === 0 && /book/i.test(c[0]) && /month/i.test(c[1] ?? '')) return; // header row
    const [bookRef, period, storeRef, format = 'ebook', units = '0', pages = '0', revenue = '0', royalty = '0'] = c;
    const book = books.find((b) => b.id === bookRef || b.title.toLowerCase() === (bookRef ?? '').toLowerCase());
    const store = STORES.find(([k, l]) => k === storeRef || l.toLowerCase().startsWith((storeRef ?? '').toLowerCase()))?.[0] ?? storeRef;
    if (!book) return errors.push(`Line ${i + 1}: no book called “${bookRef}”.`);
    if (!/^\d{4}-\d{2}$/.test(period ?? '')) return errors.push(`Line ${i + 1}: month should look like 2026-09.`);
    rows.push({ book_id: book.id, period, store: store || 'other', format: format.toLowerCase(), units: Math.round(Number(units) || 0), pages_read: Math.round(Number(pages) || 0), revenue: Number(revenue) || 0, royalty: Number(royalty) || 0 });
  });
  return { rows, errors };
}

export function SalesAdmin({ books, recent }: { books: BookOpt[]; recent: Sale[] }) {
  const toast = useToast();
  const router = useRouter();
  const [row, setRow] = useState<NewRow>({ book_id: books[0]?.id ?? '', period: thisMonth(), store: 'amazon_kdp', format: 'ebook', units: 0, pages_read: 0, revenue: 0, royalty: 0 });
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState('');
  const set = <K extends keyof NewRow>(k: K, v: NewRow[K]) => setRow({ ...row, [k]: v });

  async function send(rows: NewRow[], kind: string) {
    setBusy(kind);
    try {
      const r = await api<{ added: number }>('/api/admin/sales', { body: { rows } });
      toast(`Added ${r.added} row${r.added === 1 ? '' : 's'}; the authors were notified`);
      if (kind === 'paste') setPaste('');
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }
  async function remove(id: string) {
    if (!confirm('Delete this row?')) return;
    await api(`/api/admin/sales?id=${id}`, { method: 'DELETE' }).catch((e) => toast(errorText(e), 'error'));
    router.refresh();
  }
  const parsed = paste.trim() ? parsePaste(paste, books) : { rows: [], errors: [] };

  return (
    <div className="space-y-8">
      <section className="panel space-y-4 p-5">
        <h2>Add one month’s figures</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2"><Field label="Book" htmlFor="s-book"><select id="s-book" className="field" value={row.book_id} onChange={(e) => set('book_id', e.target.value)}>{books.map((b) => <option key={b.id} value={b.id}>{b.title} ({b.email})</option>)}</select></Field></div>
          <Field label="Month" htmlFor="s-month"><input id="s-month" type="month" className="field" value={row.period} onChange={(e) => set('period', e.target.value)} /></Field>
          <Field label="Format" htmlFor="s-format"><select id="s-format" className="field" value={row.format} onChange={(e) => set('format', e.target.value)}>{['ebook', 'paperback', 'hardcover', 'audiobook'].map((f) => <option key={f}>{f}</option>)}</select></Field>
          <div className="sm:col-span-2"><Field label="Store" htmlFor="s-store"><select id="s-store" className="field" value={row.store} onChange={(e) => set('store', e.target.value)}>{STORES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}<option value="direct">Direct sales</option><option value="other">Other</option></select></Field></div>
          <Field label="Copies sold" htmlFor="s-units"><input id="s-units" type="number" min={0} className="field" value={row.units} onChange={(e) => set('units', Number(e.target.value))} /></Field>
          <Field label="Kindle pages read" htmlFor="s-pages"><input id="s-pages" type="number" min={0} className="field" value={row.pages_read} onChange={(e) => set('pages_read', Number(e.target.value))} /></Field>
          <Field label="Sales revenue ($)" htmlFor="s-rev"><input id="s-rev" type="number" min={0} step="0.01" className="field" value={row.revenue} onChange={(e) => set('revenue', Number(e.target.value))} /></Field>
          <Field label="Author royalty ($)" htmlFor="s-roy"><input id="s-roy" type="number" min={0} step="0.01" className="field" value={row.royalty} onChange={(e) => set('royalty', Number(e.target.value))} /></Field>
        </div>
        <Button onClick={() => send([row], 'one')} loading={busy === 'one'} disabled={!row.book_id}>Add figures</Button>
      </section>

      <section className="panel space-y-3 p-5">
        <h2>Paste a report</h2>
        <p className="text-[14px] text-ink-muted">One line per book, store and month, copied from a spreadsheet or CSV, in this order: <strong>book title, month (2026-09), store, format, copies, pages read, revenue, royalty</strong>.</p>
        <textarea aria-label="Pasted report" className="field min-h-[140px] font-mono text-[13px]" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'The Garden Book, 2026-09, Amazon Kindle, ebook, 42, 3100, 168.00, 117.60'} />
        {parsed.errors.length > 0 && <ul className="text-[13px] text-danger">{parsed.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        {parsed.rows.length > 0 && <p className="text-[14px]">{parsed.rows.length} row{parsed.rows.length === 1 ? '' : 's'} ready.</p>}
        <Button onClick={() => send(parsed.rows, 'paste')} loading={busy === 'paste'} disabled={!parsed.rows.length || parsed.errors.length > 0}>Add {parsed.rows.length || ''} rows</Button>
      </section>

      <section>
        <h2 className="mb-3">Recently added</h2>
        {recent.length ? (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[700px] text-[14px]">
              <thead><tr className="border-b border-line text-left text-[13px] text-ink-muted"><th className="px-3 py-2 font-medium">Book</th><th className="px-3 py-2 font-medium">Month</th><th className="px-3 py-2 font-medium">Store</th><th className="px-3 py-2 font-medium">Format</th><th className="px-3 py-2 text-right font-medium">Copies</th><th className="px-3 py-2 text-right font-medium">Royalty</th><th /></tr></thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{r.title}</td><td className="px-3 py-2">{r.period.slice(0, 7)}</td>
                    <td className="px-3 py-2">{(PLATFORMS as Record<string, { label: string }>)[r.store]?.label ?? r.store}</td><td className="px-3 py-2">{r.format}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.units}</td><td className="px-3 py-2 text-right tabular-nums">${Number(r.royalty).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right"><button className="text-[13px] text-danger underline" onClick={() => remove(r.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="panel p-4 text-ink-muted">No sales figures yet.</p>}
      </section>
    </div>
  );
}
