'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import type { Book } from '@/lib/api';
import { api, errorText } from '@/lib/client';
import { estimatePages, spineWidth, TRIM_SIZES } from '@/lib/spine';
import { formatNumber } from '@/lib/text';
import { Button, Field, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';

const FORMATS = [
  { id: 'pdf', label: 'Print interior (PDF)', note: 'For paperback printing on Amazon KDP and IngramSpark. Fonts embedded, chapters on right-hand pages, page numbers and contents.' },
  { id: 'epub', label: 'Ebook (EPUB)', note: 'For Kindle, Apple Books, Kobo, Google Play and Barnes & Noble. Includes your cover once it’s finished.' },
  { id: 'docx', label: 'Word manuscript (DOCX)', note: 'Standard manuscript format for editors, agents or other tools.' },
  { id: 'md', label: 'Markdown', note: 'Plain text with headings and emphasis.' },
  { id: 'txt', label: 'Plain text', note: 'Text only.' },
] as const;

export function Format({ book, words, chapterCount, canPrint }: { book: Book; words: number; chapterCount: number; canPrint: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ trim_size: book.trim_size, paper: book.paper, dedication: book.dedication, copyright_holder: book.copyright_holder, author_bio: book.author_bio });
  const [busy, setBusy] = useState('');
  const [pages, setPages] = useState<number | null>(book.page_count);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const shownPages = pages ?? estimatePages(words, f.trim_size, chapterCount);
  const dirty = f.trim_size !== book.trim_size || f.paper !== book.paper || f.dedication !== book.dedication || f.copyright_holder !== book.copyright_holder || f.author_bio !== book.author_bio;

  async function save() {
    setBusy('save');
    try {
      await api(`/api/books/${book.id}`, { method: 'PATCH', body: f });
      if (f.trim_size !== book.trim_size) setPages(null);
      toast('Settings saved');
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  async function download(format: string, show = false) {
    if (dirty) await save();
    setBusy(format);
    try {
      const res = await fetch(`/api/books/${book.id}/export?format=${format}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Export failed.');
      const blob = await res.blob();
      const pc = res.headers.get('X-Page-Count');
      if (pc) setPages(Number(pc));
      const url = URL.createObjectURL(blob);
      if (show) setPreview(url);
      else {
        const a = document.createElement('a');
        a.href = url;
        a.download = /filename="(.+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `book.${format}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      if (pc) toast(`Print interior created: ${pc} pages. Your cover’s spine now uses this page count.`);
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
      <section>
        <PageHeader title="Format">Choose your print size, then download print-ready and ebook files.</PageHeader>
        <div className="panel space-y-4 p-4">
          <Field label="Trim size (paperback)" htmlFor="trim" hint="6″ × 9″ suits most non-fiction; 5″ × 8″ or 5.5″ × 8.5″ suit most novels.">
            <select id="trim" className="field" value={f.trim_size} onChange={(e) => setF({ ...f, trim_size: e.target.value })}>
              {Object.entries(TRIM_SIZES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
          </Field>
          <fieldset>
            <legend className="label">Paper</legend>
            <div className="flex gap-2">
              {(['white', 'cream'] as const).map((p) => (
                <button key={p} type="button" className="chip" aria-pressed={f.paper === p} onClick={() => setF({ ...f, paper: p })}>{p === 'white' ? 'White' : 'Cream'}</button>
              ))}
            </div>
            <p className="hint">Cream is usual for fiction, white for non-fiction with images.</p>
          </fieldset>
          <Field label="Dedication (optional)" htmlFor="ded"><input id="ded" className="field" value={f.dedication} onChange={(e) => setF({ ...f, dedication: e.target.value })} /></Field>
          <Field label="Copyright holder" htmlFor="cr" hint="Defaults to your author name."><input id="cr" className="field" value={f.copyright_holder} onChange={(e) => setF({ ...f, copyright_holder: e.target.value })} /></Field>
          <Field label="About the author (back of the book)" htmlFor="ab"><textarea id="ab" className="field min-h-[100px]" value={f.author_bio} onChange={(e) => setF({ ...f, author_bio: e.target.value })} /></Field>
          <Button size="sm" onClick={save} disabled={!dirty} loading={busy === 'save'}>Save settings</Button>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line text-[13px]">
          <div className="bg-sheet p-3"><dt className="text-ink-muted">Words</dt><dd className="font-serif text-[1.2rem]">{formatNumber(words)}</dd></div>
          <div className="bg-sheet p-3"><dt className="text-ink-muted">{pages ? 'Pages' : 'Pages (est.)'}</dt><dd className="font-serif text-[1.2rem]">{shownPages}</dd></div>
          <div className="bg-sheet p-3"><dt className="text-ink-muted">Spine</dt><dd className="font-serif text-[1.2rem]">{spineWidth(shownPages, f.paper).toFixed(3)}″</dd></div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3">Download</h2>
        <ul className="panel divide-y divide-line">
          {FORMATS.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-4 px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{x.label}</p>
                <p className="text-[13px] text-ink-muted">{x.note}</p>
              </div>
              {x.id === 'pdf' && !canPrint ? (
                <a href="/dashboard/billing" className="text-[14px] font-medium text-cloth underline">Included in Pro</a>
              ) : (
              <div className="flex gap-2">
                {x.id === 'pdf' && <Button size="sm" variant="secondary" onClick={() => download('pdf', true)} loading={busy === 'pdf-preview'} disabled={!!busy || !words}>Preview</Button>}
                <Button size="sm" onClick={() => download(x.id)} loading={busy === x.id} disabled={!!busy || !words}><Download className="h-4 w-4" />Download</Button>
              </div>
              )}
            </li>
          ))}
        </ul>
        {preview && (
          <div className="mt-6">
            <div className="mb-2 flex justify-between"><h3>Print preview</h3><Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Close preview</Button></div>
            <iframe src={preview} title="Print interior preview" className="h-[80vh] w-full rounded-md border border-line bg-white" />
          </div>
        )}
      </section>
    </div>
  );
}
