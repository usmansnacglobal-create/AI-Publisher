'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Check, Download, RefreshCw } from 'lucide-react';
import type { Book } from '@/lib/api';
import { api, errorText } from '@/lib/client';
import { estimatePages, spineWidth, TRIM_SIZES } from '@/lib/spine';
import { formatNumber } from '@/lib/text';
import { BODY_FONTS, HEADING_STYLES, PAGE_NUMBERS, TRIM_NOTES, normaliseLayout, type LayoutSettings } from '@/lib/layout';
import { Badge, Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

const FORMATS = [
  { id: 'pdf', label: 'Print interior (PDF)', note: 'For paperbacks on Amazon KDP and IngramSpark.' },
  { id: 'epub', label: 'Ebook (EPUB)', note: 'For Kindle, Apple Books, Kobo and Google Play. Includes your cover once it’s finished.' },
  { id: 'docx', label: 'Word manuscript (DOCX)', note: 'For editors, agents or other tools.' },
  { id: 'md', label: 'Markdown', note: 'Plain text with headings and emphasis.' },
  { id: 'txt', label: 'Plain text', note: 'Text only.' },
] as const;

function Choice<T extends string>({ value, options, onChange, name }: { value: T; options: Record<T, { label: string; note?: string }>; onChange: (v: T) => void; name: string }) {
  return (
    <div className="grid gap-1.5" role="radiogroup" aria-label={name}>
      {(Object.keys(options) as T[]).map((k) => (
        <label key={k} className={clsx('flex cursor-pointer gap-2.5 rounded border px-3 py-2 text-[14px]', value === k ? 'border-cloth bg-cloth-light/60' : 'border-line bg-sheet hover:border-line-strong')}>
          <input type="radio" name={name} className="mt-1 accent-cloth" checked={value === k} onChange={() => onChange(k)} />
          <span>
            <span className="block font-medium">{options[k].label}</span>
            {options[k].note && <span className="text-[12px] text-ink-muted">{options[k].note}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="group border-b border-line py-4 last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between font-serif text-[1.05rem]">
        {title}
        <span className="text-[12px] text-ink-muted group-open:hidden">Show</span>
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

export function Format({ book, words, chapterCount, canPrint }: { book: Book; words: number; chapterCount: number; canPrint: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [L, setL] = useState<LayoutSettings>(normaliseLayout(book.layout));
  const [f, setF] = useState({ trim_size: book.trim_size, paper: book.paper, dedication: book.dedication, copyright_holder: book.copyright_holder, author_bio: book.author_bio });
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState('');
  const [pages, setPages] = useState<number | null>(book.page_count);
  const [approvedAt, setApprovedAt] = useState(book.layout_approved_at);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef({ L, f });
  latest.current = { L, f };

  const status: 'draft' | 'approved' | 'outdated' = !approvedAt ? 'draft' : new Date(book.content_updated_at) > new Date(approvedAt) ? 'outdated' : 'approved';
  const shownPages = pages ?? estimatePages(words, f.trim_size, chapterCount);

  const save = useCallback(async () => {
    const { L, f } = latest.current;
    await api(`/api/books/${book.id}`, { method: 'PATCH', body: { ...f, layout: L } });
    setSaved(true);
    setApprovedAt(null);
    setPages(null);
  }, [book.id]);

  const refreshPreview = useCallback(async () => {
    if (!canPrint || !words) return;
    setPreviewing(true);
    try {
      const res = await fetch(`/api/books/${book.id}/export?format=pdf&preview=1`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Preview failed.');
      const url = URL.createObjectURL(await res.blob());
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setPreviewing(false);
  }, [book.id, canPrint, words, toast]);

  useEffect(() => {
    refreshPreview();
    // first load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save and refresh the preview a moment after each change.
  function change(next: Partial<LayoutSettings>, nextF?: Partial<typeof f>) {
    setL((x) => ({ ...x, ...next }));
    if (nextF) setF((x) => ({ ...x, ...nextF }));
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await save();
        await refreshPreview();
      } catch (e) {
        toast(errorText(e), 'error');
      }
    }, 900);
  }

  async function approve() {
    setBusy('approve');
    try {
      if (!saved) await save();
      await api(`/api/books/${book.id}`, { method: 'PATCH', body: { approveLayout: true } });
      setApprovedAt(new Date().toISOString());
      toast('Layout approved');
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  async function download(format: string) {
    setBusy(format);
    try {
      if (!saved) await save();
      const res = await fetch(`/api/books/${book.id}/export?format=${format}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Export failed.');
      const blob = await res.blob();
      const pc = res.headers.get('X-Page-Count');
      if (pc) setPages(Number(pc));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = /filename="(.+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `book.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      if (pc) toast(`Print interior created: ${pc} pages. Your cover’s spine now uses this page count.`);
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[400px_1fr]">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[1.6rem]">Layout typographer</h1>
            <p className="text-[14px] text-ink-muted">Design your book’s interior. The preview updates as you go.</p>
          </div>
          <Badge tone={status === 'approved' ? 'cloth' : status === 'outdated' ? 'gilt' : 'neutral'}>
            {status === 'approved' ? 'Approved' : status === 'outdated' ? 'Outdated: text changed since approval' : 'Draft'}
          </Badge>
        </div>

        <div className="panel px-4">
          <Section title="Trim size and paper">
            <Field label="Trim size" htmlFor="trim" hint={TRIM_NOTES[f.trim_size]}>
              <select id="trim" className="field" value={f.trim_size} onChange={(e) => change({}, { trim_size: e.target.value })}>
                {Object.entries(TRIM_SIZES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
              </select>
            </Field>
            <div className="flex gap-2" role="radiogroup" aria-label="Paper">
              {(['white', 'cream'] as const).map((p) => (
                <button key={p} type="button" className="chip" aria-pressed={f.paper === p} onClick={() => change({}, { paper: p })}>{p === 'white' ? 'White paper' : 'Cream paper'}</button>
              ))}
            </div>
          </Section>

          <Section title="Chapter headings">
            <Choice name="Chapter heading style" value={L.heading} options={HEADING_STYLES} onChange={(v) => change({ heading: v })} />
          </Section>

          <Section title="Page numbers and running heads">
            <Choice name="Page numbering" value={L.pageNumbers} options={PAGE_NUMBERS} onChange={(v) => change({ pageNumbers: v })} />
            <label className="flex items-start gap-2.5 text-[14px]">
              <input type="checkbox" className="mt-1 accent-cloth" checked={L.runningHeads} onChange={(e) => change({ runningHeads: e.target.checked })} />
              <span><span className="font-medium">Running heads</span><span className="block text-[12px] text-ink-muted">Author name on left pages, chapter title on right pages</span></span>
            </label>
          </Section>

          <Section title="Typography">
            <Field label="Body font" htmlFor="font" hint={BODY_FONTS[L.font].note}>
              <select id="font" className="field" value={L.font} onChange={(e) => change({ font: e.target.value as LayoutSettings['font'] })}>
                {Object.entries(BODY_FONTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label={`Font size: ${L.fontSize} pt`} htmlFor="size">
              <input id="size" type="range" min={9} max={14} step={0.5} className="w-full accent-cloth" value={L.fontSize} onChange={(e) => change({ fontSize: Number(e.target.value) })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Paragraphs" htmlFor="para">
                <select id="para" className="field" value={L.paragraph} onChange={(e) => change({ paragraph: e.target.value as LayoutSettings['paragraph'] })}>
                  <option value="indented">Indented (fiction)</option>
                  <option value="block">Block, spaced (non-fiction)</option>
                </select>
              </Field>
              <Field label="Line spacing" htmlFor="sp">
                <select id="sp" className="field" value={L.spacing} onChange={(e) => change({ spacing: e.target.value as LayoutSettings['spacing'] })}>
                  <option value="tight">Tight</option>
                  <option value="standard">Standard</option>
                  <option value="relaxed">Relaxed</option>
                </select>
              </Field>
            </div>
            <label className="flex items-start gap-2.5 text-[14px]">
              <input type="checkbox" className="mt-1 accent-cloth" checked={L.dropCaps} onChange={(e) => change({ dropCaps: e.target.checked })} />
              <span><span className="font-medium">Drop caps</span><span className="block text-[12px] text-ink-muted">A large first letter on each chapter’s opening paragraph</span></span>
            </label>
          </Section>

          <Section title="Margins">
            <p className="text-[12px] text-ink-muted">The inside (gutter) margin is set automatically from your page count to meet printer minimums.</p>
            {(['outside', 'top', 'bottom'] as const).map((k) => (
              <Field key={k} label={`${k[0].toUpperCase() + k.slice(1)} margin: ${L.margins[k].toFixed(2)}″`} htmlFor={`m-${k}`}>
                <input id={`m-${k}`} type="range" min={0.25} max={1.25} step={0.05} className="w-full accent-cloth" value={L.margins[k]} onChange={(e) => change({ margins: { ...L.margins, [k]: Number(e.target.value) } })} />
              </Field>
            ))}
          </Section>

          <Section title="Front and back matter">
            <Field label="Dedication (optional)" htmlFor="ded"><input id="ded" className="field" value={f.dedication} onChange={(e) => change({}, { dedication: e.target.value })} /></Field>
            <Field label="Copyright holder" htmlFor="cr" hint="Defaults to the author name."><input id="cr" className="field" value={f.copyright_holder} onChange={(e) => change({}, { copyright_holder: e.target.value })} /></Field>
            <Field label="About the author" htmlFor="ab"><textarea id="ab" className="field min-h-[90px]" value={f.author_bio} onChange={(e) => change({}, { author_bio: e.target.value })} /></Field>
          </Section>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line text-[13px]">
          <div className="bg-sheet p-3"><dt className="text-ink-muted">Words</dt><dd className="font-serif text-[1.2rem]">{formatNumber(words)}</dd></div>
          <div className="bg-sheet p-3"><dt className="text-ink-muted">{pages ? 'Pages' : 'Pages (est.)'}</dt><dd className="font-serif text-[1.2rem]">{shownPages}</dd></div>
          <div className="bg-sheet p-3"><dt className="text-ink-muted">Spine</dt><dd className="font-serif text-[1.2rem]">{spineWidth(shownPages, f.paper).toFixed(3)}″</dd></div>
        </dl>
      </section>

      <section className="min-w-0 space-y-6">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2>Live preview</h2>
            <div className="flex items-center gap-2 text-[13px] text-ink-muted">
              <span aria-live="polite">{!saved ? 'Saving…' : previewing ? 'Updating preview…' : 'First two chapters'}</span>
              <Button size="sm" variant="ghost" onClick={refreshPreview} disabled={previewing || !canPrint}><RefreshCw className="h-4 w-4" />Refresh</Button>
            </div>
          </div>
          {!canPrint ? (
            <div className="panel p-6 text-[14px] text-ink-muted">The live print preview and print PDF are part of Pro. <a className="text-cloth underline" href="/dashboard/billing">See plans</a></div>
          ) : !words ? (
            <div className="panel p-6 text-[14px] text-ink-muted">Write your first chapter to see it previewed here.</div>
          ) : preview ? (
            <iframe src={`${preview}#view=FitH&toolbar=0`} title="Print preview" className={clsx('h-[78vh] w-full rounded-md border border-line bg-[#fff]', previewing && 'opacity-60')} />
          ) : (
            <div className="panel grid h-[50vh] place-items-center text-ink-muted">Preparing preview…</div>
          )}
        </div>

        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="text-[14px]">
            <p className="font-medium">{status === 'approved' ? 'Layout approved' : 'Happy with how it looks?'}</p>
            <p className="text-ink-muted">{status === 'outdated' ? 'Your chapters changed after you approved this layout. Check the preview and approve again.' : 'Approving marks the interior as ready for publishing.'}</p>
          </div>
          <Button onClick={approve} loading={busy === 'approve'} variant={status === 'approved' ? 'secondary' : 'primary'} disabled={!words}>
            <Check className="h-4 w-4" />{status === 'approved' ? 'Approved' : 'Approve layout'}
          </Button>
        </div>

        <div>
          <h2 className="mb-3">Download</h2>
          <ul className="panel divide-y divide-line">
            {FORMATS.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{x.label}</p>
                  <p className="text-[13px] text-ink-muted">{x.note}</p>
                </div>
                {x.id === 'pdf' && !canPrint ? (
                  <a href="/dashboard/billing" className="text-[14px] font-medium text-cloth underline">Included in Pro</a>
                ) : (
                  <Button size="sm" onClick={() => download(x.id)} loading={busy === x.id} disabled={!!busy || !words}><Download className="h-4 w-4" />Download</Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
