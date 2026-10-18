'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/client';

type Item = { src: string; caption: string; chapter: string; size: string; dpi: number | null; status: 'ok' | 'warn' | 'fail'; note: string };

/** Lists the book's images and how sharp each will print. Reloads when `version` changes. */
export function ImageCheck({ bookId, version }: { bookId: string; version: unknown }) {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    let live = true;
    // Layout changes save after a short pause, so check once they've been saved.
    const t = setTimeout(() => {
      api<{ images: Item[] }>(`/api/books/${bookId}/images`).then((r) => live && setItems(r.images)).catch(() => live && setItems([]));
    }, 1500);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [bookId, version]);
  if (!items?.length) return null;
  const problems = items.filter((i) => i.status !== 'ok').length;
  return (
    <section className="mt-4 rounded-md border border-line bg-sheet p-3 text-[13px]" aria-labelledby="img-check">
      <h3 id="img-check" className="mb-1 font-sans text-[14px] font-semibold">Images: print quality</h3>
      <p className="mb-2 text-ink-muted">{problems ? `${problems} of ${items.length} image${items.length === 1 ? '' : 's'} may not print well.` : `All ${items.length} image${items.length === 1 ? '' : 's'} will print sharply.`}</p>
      <ul className="space-y-1.5">
        {items.map((i, n) => (
          <li key={`${i.src}-${n}`} className="flex gap-2">
            {i.status === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cloth" aria-label="Good" /> : i.status === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gilt" aria-label="Warning" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Problem" />}
            <span><span className="font-medium text-ink">{i.caption || 'Untitled image'}</span> <span className="text-ink-muted">({i.chapter})</span>: {i.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
