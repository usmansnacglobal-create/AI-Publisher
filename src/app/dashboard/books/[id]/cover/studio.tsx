'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, Check, CheckCircle2, Copy, Download, FolderOpen, Pencil, Sparkles, Star, Trash2, Upload } from 'lucide-react';
import { api, errorText } from '@/lib/client';
import { createClient } from '@/lib/supabase/client';
import { COVER_STYLES, MOODS, PALETTES, TEMPLATES, TITLE_FONTS, type CoverBrief, type CoverDesign } from '@/lib/cover';
import { drawFront, drawSocial, drawTemplate, drawWrap, loadFont, loadImage, type WrapAssets } from '@/lib/canvas';
import { BLEED } from '@/lib/spine';
import { Badge, Button, Field, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';

type Concept = { path: string; prompt: string; created_at: string; kind?: string };
type Version = { id: string; name: string; status: 'draft' | 'final'; selected_path: string | null; pages: number | null; trim_size: string | null; paper: string | null; created_at: string; updated_at: string };

interface Data {
  book: { id: string; title: string; subtitle: string; genre: string; summary: string; blurb: string; author_bio: string; trim_size: string; paper: 'white' | 'cream' };
  author: string;
  cover: {
    brief: CoverBrief; design: CoverDesign; concepts: Concept[]; selected_path: string | null; front_path: string | null; wrap_path: string | null;
    social_path: string | null; generations: number; runLimit: number;
  };
  versions: Version[];
  urls: Record<string, string>;
  geometry: { pages: number; pagesSource: 'yours' | 'measured' | 'estimated'; words: number; width: number; height: number; spine: number; trimW: number; trimH: number; spineText: boolean };
  trims: Record<string, { w: number; h: number; label: string }>;
}

const STEPS = ['Brief', 'Create', 'Design', 'Finalize and export'] as const;

async function uploadToCovers(bookId: string, file: Blob, name: string, type: string) {
  const sb = createClient();
  const { data: u } = await sb.auth.getUser();
  const path = `${u.user!.id}/${bookId}/${name}`;
  const { error } = await sb.storage.from('covers').upload(path, file, { contentType: type, upsert: true });
  if (error) throw error;
  return path;
}

export function CoverStudio({ bookId }: { bookId: string }) {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<CoverBrief | null>(null);
  const [design, setDesign] = useState<CoverDesign | null>(null);
  const [book, setBook] = useState({ subtitle: '', blurb: '', author_bio: '', trim_size: '6x9', paper: 'white' as 'white' | 'cream' });
  const [busy, setBusy] = useState('');

  const reload = useCallback(async () => {
    const d = await api<Data>(`/api/books/${bookId}/cover`);
    setData(d);
    setBrief(d.cover.brief);
    setDesign(d.cover.design);
    setBook({ subtitle: d.book.subtitle, blurb: d.book.blurb, author_bio: d.book.author_bio, trim_size: d.book.trim_size, paper: d.book.paper });
    return d;
  }, [bookId]);

  useEffect(() => {
    reload()
      .then((d) => setStep(d.cover.front_path ? 3 : d.cover.concepts.length ? 2 : 0))
      .catch((e) => toast(errorText(e), 'error'));
  }, [reload, toast]);

  async function saveAll(next?: number) {
    setBusy('save');
    try {
      await api(`/api/books/${bookId}/cover`, { method: 'PUT', body: { brief, design, ...book } });
      await reload();
      if (next !== undefined) setStep(next);
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  if (!data || !brief || !design) return <p className="text-ink-muted">Loading the cover studio…</p>;
  const selectedUrl = data.cover.selected_path ? data.urls[data.cover.selected_path] : undefined;

  return (
    <div>
      <PageHeader title="Cover designer">
        Claude turns your brief into art direction and ChatGPT paints the artwork. Or start from a template or your own image. You set the lettering with real fonts, so the title is always sharp and spelled right.
      </PageHeader>
      <ol className="mb-8 flex flex-wrap gap-2 text-[14px]">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              onClick={() => (i <= 1 || data.cover.concepts.length ? saveAll(i) : null)}
              aria-current={step === i ? 'step' : undefined}
              disabled={i > 1 && !data.cover.concepts.length}
              className={clsx('flex items-center gap-2 rounded-full border px-3 py-1.5 disabled:opacity-50', step === i ? 'border-cloth bg-cloth text-white' : 'border-line bg-sheet text-ink-soft')}
            >
              <span className="text-[12px]">{i + 1}</span> {s}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && <BriefStep data={data} brief={brief} setBrief={setBrief} book={book} setBook={setBook} busy={busy} onNext={() => saveAll(1)} bookId={bookId} />}
      {step === 1 && (
        <CreateStep
          data={data}
          bookId={bookId}
          busy={busy}
          onGenerate={async (count, tweak) => {
            await saveAll();
            setBusy('gen');
            try {
              await api(`/api/books/${bookId}/cover/generate`, { body: { count, tweak } });
              await reload();
              toast('New concepts are ready');
            } catch (e) {
              toast(errorText(e), 'error');
            }
            setBusy('');
          }}
          onChanged={reload}
          onSelect={async (path) => {
            await api(`/api/books/${bookId}/cover`, { method: 'PUT', body: { selected_path: path } });
            await reload();
          }}
          onNext={() => saveAll(2)}
        />
      )}
      {step === 2 && <DesignStep data={data} bookId={bookId} design={design} setDesign={setDesign} brief={brief} book={book} imageUrl={selectedUrl} busy={busy} onNext={() => saveAll(3)} />}
      {step === 3 && <ExportStep data={data} design={design} brief={brief} book={book} imageUrl={selectedUrl} bookId={bookId} onDone={reload} onOpenDesign={() => setStep(2)} />}
    </div>
  );
}

function BriefStep({ data, brief, setBrief, book, setBook, busy, onNext, bookId }: {
  data: Data; brief: CoverBrief; setBrief: (b: CoverBrief) => void;
  book: { subtitle: string; blurb: string; author_bio: string; trim_size: string; paper: 'white' | 'cream' };
  setBook: (b: typeof book) => void; busy: string; onNext: () => void; bookId: string;
}) {
  const toast = useToast();
  const [gen, setGen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof CoverBrief>(k: K, v: CoverBrief[K]) => setBrief({ ...brief, [k]: v });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const sb = createClient();
      const { data: u } = await sb.auth.getUser();
      const paths = [...brief.referencePaths];
      for (const f of [...files].slice(0, 3 - paths.length)) {
        if (!/image\/(png|jpeg|webp)/.test(f.type)) throw new Error('Use JPG, PNG or WebP images.');
        const dims = await new Promise<{ w: number; h: number }>((r) => { const i = new Image(); i.onload = () => r({ w: i.width, h: i.height }); i.src = URL.createObjectURL(f); });
        if (Math.min(dims.w, dims.h) < 512) throw new Error(`${f.name} is too small. Use images at least 512 pixels on each side.`);
        const path = `${u.user!.id}/${bookId}/ref-${crypto.randomUUID()}.${f.type.split('/')[1]}`;
        const { error } = await sb.storage.from('covers').upload(path, f, { contentType: f.type });
        if (error) throw error;
        paths.push(path);
      }
      set('referencePaths', paths);
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setUploading(false);
  }

  async function genBlurb() {
    setGen(true);
    try {
      const r = await api<{ blurb: string; tagline: string }>(`/api/books/${bookId}/publishing-kit`, { body: { fields: ['blurb', 'tagline'] } });
      setBook({ ...book, blurb: r.blurb });
      if (!brief.tagline) set('tagline', r.tagline);
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setGen(false);
  }

  const geo = data.geometry;
  return (
    <div className="grid max-w-[980px] gap-8 lg:grid-cols-2">
      <section className="space-y-5">
        <div className="panel p-4 text-[14px]">
          <p className="font-medium">{data.book.title}</p>
          <p className="text-ink-muted">{data.author} · {data.book.genre}</p>
          <p className="mt-2 line-clamp-4 text-ink-muted">{data.book.summary}</p>
        </div>
        <Field label="Subtitle (optional)" htmlFor="sub"><input id="sub" className="field" value={book.subtitle} onChange={(e) => setBook({ ...book, subtitle: e.target.value })} /></Field>
        <fieldset>
          <legend className="label">Mood (pick up to 3)</legend>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={brief.moods.includes(m)}
                onClick={() => set('moods', brief.moods.includes(m) ? brief.moods.filter((x) => x !== m) : brief.moods.length < 3 ? [...brief.moods, m] : brief.moods)}>{m}</button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Format</legend>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="chip" aria-pressed={brief.format === 'ebook'} onClick={() => set('format', 'ebook')}>Ebook only</button>
            <button type="button" className="chip" aria-pressed={brief.format === 'paperback'} onClick={() => set('format', 'paperback')}>Paperback and ebook</button>
          </div>
        </fieldset>
        {brief.format === 'paperback' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trim size" htmlFor="trim">
              <select id="trim" className="field" value={book.trim_size} onChange={(e) => setBook({ ...book, trim_size: e.target.value })}>
                {Object.entries(data.trims).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Paper" htmlFor="paper">
              <select id="paper" className="field" value={book.paper} onChange={(e) => setBook({ ...book, paper: e.target.value as 'white' | 'cream' })}>
                <option value="white">White</option><option value="cream">Cream</option>
              </select>
            </Field>
            <div className="col-span-2 rounded-md bg-ground px-3 py-2 text-[13px] text-ink-soft">
              {geo.pages} pages ({geo.pagesSource === 'measured' ? 'measured from your print interior' : geo.pagesSource === 'yours' ? 'your number' : `estimated from ${geo.words.toLocaleString('en-GB')} words; create the print PDF on the Layout tab for the exact count`}) · spine {geo.spine.toFixed(3)}″
              {!geo.spineText && ' · under 79 pages, so no text on the spine'}
            </div>
            <Field label="Page count override (optional)" htmlFor="pc">
              <input id="pc" type="number" min={24} className="field" value={brief.pageCountOverride ?? ''} onChange={(e) => set('pageCountOverride', e.target.value ? Number(e.target.value) : null)} />
            </Field>
          </div>
        )}
        <fieldset>
          <legend className="label">Cover style</legend>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(COVER_STYLES).map(([k, s]) => (
              <button key={k} type="button" aria-pressed={brief.style === k} onClick={() => set('style', k as CoverBrief['style'])} className="rounded border border-line bg-sheet p-3 text-left text-[14px] aria-pressed:border-cloth aria-pressed:bg-cloth-light">
                <span className="block font-medium">{s.label}</span><span className="text-[12px] text-ink-muted">{s.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="space-y-5">
        <Field label="Imagery and themes (optional)" htmlFor="img" hint="Objects, settings or symbols you’d like on the cover.">
          <textarea id="img" className="field min-h-[80px]" value={brief.imagery} onChange={(e) => set('imagery', e.target.value)} />
        </Field>
        <Field label="Colour palette" htmlFor="pal">
          <select id="pal" className="field" value={brief.palette} onChange={(e) => set('palette', e.target.value as CoverBrief['palette'])}>
            {PALETTES.map((p) => <option key={p} value={p}>{p === 'auto' ? 'Let AI decide' : p[0].toUpperCase() + p.slice(1)}</option>)}
          </select>
        </Field>
        {brief.palette === 'custom' && <Field label="Your colours" htmlFor="cc"><input id="cc" className="field" placeholder="e.g. deep navy, gold, ivory" value={brief.customColours} onChange={(e) => set('customColours', e.target.value)} /></Field>}
        <Field label="Inspiration (optional)" htmlFor="insp" hint="Up to 3 book titles, one per line. Used for mood only, never copied.">
          <textarea id="insp" className="field min-h-[70px]" value={brief.inspiration.join('\n')} onChange={(e) => set('inspiration', e.target.value.split('\n').slice(0, 3))} />
        </Field>
        <Field label="Things to avoid (optional)" htmlFor="avoid"><input id="avoid" className="field" placeholder="e.g. no faces, no weapons" value={brief.avoid} onChange={(e) => set('avoid', e.target.value)} /></Field>
        <Field label="Special instructions (optional)" htmlFor="si"><textarea id="si" className="field min-h-[70px]" value={brief.instructions} onChange={(e) => set('instructions', e.target.value)} /></Field>

        <div>
          <p className="label">Your own images (optional)</p>
          <p className="hint mb-2">Up to 3 JPG, PNG or WebP images, at least 512 px. ChatGPT works from them.</p>
          <div className="flex flex-wrap gap-2">
            {brief.referencePaths.map((p) => (
              <div key={p} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {data.urls[p] ? <img src={data.urls[p]} alt="" className="h-20 w-20 rounded object-cover" /> : <div className="grid h-20 w-20 place-items-center rounded bg-ground text-[11px] text-ink-muted">Uploaded</div>}
                <button className="absolute -right-2 -top-2 rounded-full bg-sheet p-1 shadow" aria-label="Remove image" onClick={() => set('referencePaths', brief.referencePaths.filter((x) => x !== p))}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {brief.referencePaths.length < 3 && (
              <label className="grid h-20 w-20 cursor-pointer place-items-center rounded border border-dashed border-line-strong text-ink-muted hover:border-ink-faint">
                <Upload className="h-5 w-5" /><span className="sr-only">Upload image</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files)} />
              </label>
            )}
          </div>
          {brief.referencePaths.length > 0 && (
            <label className="mt-2 flex items-center gap-2 text-[14px]">
              <input type="checkbox" className="accent-cloth" checked={brief.rightsConfirmed} onChange={(e) => set('rightsConfirmed', e.target.checked)} />
              I own these images or have the rights to use them.
            </label>
          )}
        </div>

        {brief.format === 'paperback' && (
          <div className="space-y-4 border-t border-line pt-5">
            <h3>Back cover</h3>
            <Field label="Tagline (optional)" htmlFor="tag"><input id="tag" className="field" value={brief.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <Field label="Series (optional)" htmlFor="ser"><input id="ser" className="field" value={brief.series} onChange={(e) => set('series', e.target.value)} /></Field>
              <Field label="Book #" htmlFor="sn"><input id="sn" className="field" value={brief.seriesNumber} onChange={(e) => set('seriesNumber', e.target.value)} /></Field>
            </div>
            <Field label="Back-cover description" htmlFor="blurb" hint="Saved to your book, so the publishing step reuses it.">
              <textarea id="blurb" className="field min-h-[140px]" value={book.blurb} onChange={(e) => setBook({ ...book, blurb: e.target.value })} />
            </Field>
            <Button size="sm" variant="secondary" onClick={genBlurb} loading={gen}><Sparkles className="h-4 w-4" />Write it with AI</Button>
            <Field label="Author bio (optional)" htmlFor="bio"><textarea id="bio" className="field min-h-[80px]" value={book.author_bio} onChange={(e) => setBook({ ...book, author_bio: e.target.value })} /></Field>
            <div>
              <p className="label">Review quotes (optional, up to 3, real reviews only)</p>
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="grid grid-cols-[1fr_140px] gap-2">
                    <input aria-label={`Quote ${i + 1}`} className="field" placeholder="Quote" value={brief.reviewQuotes[i] ?? ''} onChange={(e) => { const q = [...brief.reviewQuotes]; q[i] = e.target.value; set('reviewQuotes', q); }} />
                    <input aria-label={`Quote ${i + 1} source`} className="field" placeholder="Source" value={brief.quoteSources?.[i] ?? ''} onChange={(e) => { const q = [...(brief.quoteSources ?? [])]; q[i] = e.target.value; set('quoteSources', q); }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Publisher or imprint" htmlFor="imp"><input id="imp" className="field" value={brief.imprint} onChange={(e) => set('imprint', e.target.value)} /></Field>
              <Field label="Website or social" htmlFor="web"><input id="web" className="field" value={brief.website} onChange={(e) => set('website', e.target.value)} /></Field>
            </div>
          </div>
        )}
        <Button onClick={onNext} loading={busy === 'save'}>Save and continue</Button>
      </section>
    </div>
  );
}


function CreateStep({ data, bookId, busy, onGenerate, onSelect, onChanged, onNext }: {
  data: Data; bookId: string; busy: string; onGenerate: (count: number, tweak: string) => Promise<void>; onSelect: (p: string) => Promise<void>; onChanged: () => Promise<unknown>; onNext: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<'ai' | 'templates' | 'upload'>('ai');
  const [imagery, setImagery] = useState('');
  const [avoid, setAvoid] = useState('');
  const [tweak, setTweak] = useState('');
  const [count, setCount] = useState(3);
  const [working, setWorking] = useState('');
  const concepts = data.cover.concepts;
  const left = Math.max(0, data.cover.runLimit - data.cover.generations);

  async function addConcept(blob: Blob, kind: 'upload' | 'template' | 'import', label: string, ext = 'png', type = 'image/png') {
    const path = await uploadToCovers(bookId, blob, `${kind}-${crypto.randomUUID()}.${ext}`, type);
    await api(`/api/books/${bookId}/cover/concepts`, { body: { path, kind, label } });
    await onChanged();
  }

  async function applyTemplate(t: (typeof TEMPLATES)[number]) {
    setWorking(t.id);
    try {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 1536;
      drawTemplate(c.getContext('2d')!, t.kind, t.colors);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
      await addConcept(blob, 'template', t.name);
      toast(`“${t.name}” added. Add your lettering in the Design step.`);
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setWorking('');
  }

  async function upload(file: File | undefined, kind: 'upload' | 'import') {
    if (!file) return;
    if (!/image\/(png|jpeg|webp)/.test(file.type)) return toast('Use a JPG, PNG or WebP image.', 'error');
    if (file.size > 15 * 1024 * 1024) return toast('That image is over 15 MB.', 'error');
    setWorking(kind);
    try {
      const dims = await new Promise<{ w: number; h: number }>((r) => { const i = new Image(); i.onload = () => r({ w: i.width, h: i.height }); i.src = URL.createObjectURL(file); });
      if (Math.min(dims.w, dims.h) < 800) toast('That image is small and may look blurry in print. 1,600 × 2,400 pixels or more is best.', 'error');
      await addConcept(file, kind, file.name, file.type.split('/')[1].replace('jpeg', 'jpg'), file.type);
      if (kind === 'import') {
        // An imported finished cover keeps its own lettering.
        const d = { ...data.cover.design, finishedFront: true };
        await api(`/api/books/${bookId}/cover`, { method: 'PUT', body: { design: d } });
        await onChanged();
      }
      toast(kind === 'import' ? 'Cover imported. It’s used as-is, without added lettering.' : 'Artwork added');
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setWorking('');
  }

  async function remove(path: string) {
    if (!confirm('Delete this artwork?')) return;
    try {
      await api(`/api/books/${bookId}/cover/concepts`, { method: 'DELETE', body: { path } });
      await onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  const runTweak = [tweak, imagery && `Imagery for this run: ${imagery}`, avoid && `Avoid in this run: ${avoid}`].filter(Boolean).join('. ');

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 flex rounded-md border border-line bg-sheet p-1 text-[14px] sm:w-fit" role="tablist">
        {([['ai', 'AI generate'], ['templates', 'Templates'], ['upload', 'Upload']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={clsx('flex-1 rounded px-4 py-1.5', tab === k ? 'bg-ink text-white' : 'text-ink-soft')}>{l}</button>
        ))}
      </div>

      {tab === 'ai' && (
        <div className="panel mb-6 space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px]">AI covers for this book: <strong>{data.cover.generations} of {data.cover.runLimit}</strong> runs used</p>
            {left === 0 && <a href="/dashboard/billing" className="text-[14px] text-cloth underline">Upgrade for more runs</a>}
          </div>
          <p className="text-[13px] text-ink-muted">Adjust this generation (optional). Your brief stays as it is.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Imagery for this run" htmlFor="ir"><input id="ir" className="field" placeholder="e.g. A stadium at dusk" value={imagery} onChange={(e) => setImagery(e.target.value)} /></Field>
            <Field label="Avoid in this run" htmlFor="ar"><input id="ar" className="field" placeholder="e.g. No crowds" value={avoid} onChange={(e) => setAvoid(e.target.value)} /></Field>
            <Field label={concepts.length ? 'What should change?' : 'Anything to add?'} htmlFor="tw"><input id="tw" className="field" placeholder="e.g. Warmer light" value={tweak} onChange={(e) => setTweak(e.target.value)} /></Field>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="How many images" htmlFor="cnt">
              <select id="cnt" className="field w-auto" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}
              </select>
            </Field>
            <Button onClick={() => onGenerate(count, runTweak)} loading={busy === 'gen'} disabled={left === 0}>
              <Sparkles className="h-4 w-4" />{busy === 'gen' ? 'Painting… about a minute' : concepts.some((c) => c.kind === 'ai' || !c.kind) ? 'Generate more' : 'Generate with AI'}
            </Button>
          </div>
          {busy === 'gen' && <p className="text-[13px] text-ink-muted">A cover for this book is generating. It will appear in the gallery below.</p>}
        </div>
      )}

      {tab === 'templates' && (
        <div className="panel mb-6 p-4">
          <p className="mb-3 text-[14px] text-ink-muted">Clean typographic backgrounds. Pick one, then add your title and name in the Design step. Templates don’t use AI cover runs.</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => applyTemplate(t)} disabled={!!working} className="group text-left">
                <TemplateThumb t={t} />
                <span className="mt-1 block text-[13px] group-hover:underline">{working === t.id ? 'Adding…' : t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'upload' && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <label className="panel flex cursor-pointer flex-col items-start gap-2 p-5 hover:border-cloth">
            <Upload className="h-5 w-5 text-cloth" />
            <span className="font-medium">Upload your own artwork</span>
            <span className="text-[13px] text-ink-muted">A photo or illustration without lettering. You add the title and your name in the Design step.</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={!!working} onChange={(e) => upload(e.target.files?.[0], 'upload')} />
            {working === 'upload' && <span className="text-[13px] text-ink-muted">Uploading…</span>}
          </label>
          <label className="panel flex cursor-pointer flex-col items-start gap-2 p-5 hover:border-cloth">
            <FolderOpen className="h-5 w-5 text-cloth" />
            <span className="font-medium">Import your existing cover</span>
            <span className="text-[13px] text-ink-muted">A finished front cover, lettering included. It’s used as-is; you can still design the spine and back.</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={!!working} onChange={(e) => upload(e.target.files?.[0], 'import')} />
            {working === 'import' && <span className="text-[13px] text-ink-muted">Uploading…</span>}
          </label>
        </div>
      )}

      {concepts.length ? (
        <>
          <h3 className="mb-2">Your artwork</h3>
          <p className="mb-3 text-[14px] text-ink-muted">Choose the one to use. The title and your name are added in the next step.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {concepts.map((c) => {
              const sel = c.path === data.cover.selected_path;
              return (
                <div key={c.path} className="group relative">
                  <button onClick={() => onSelect(c.path)} aria-pressed={sel} className={clsx('relative block w-full overflow-hidden rounded-md border-2', sel ? 'border-cloth' : 'border-transparent hover:border-line-strong')}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={data.urls[c.path]} alt="Cover artwork" className="aspect-[2/3] w-full object-cover" />
                    {sel && <span className="absolute right-2 top-2 rounded-full bg-cloth p-1 text-white"><Check className="h-4 w-4" /></span>}
                    <span className="absolute bottom-2 left-2"><Badge>{c.kind === 'template' ? 'Template' : c.kind === 'upload' ? 'Your artwork' : c.kind === 'import' ? 'Imported cover' : 'AI'}</Badge></span>
                  </button>
                  <button onClick={() => remove(c.path)} className="absolute left-2 top-2 hidden rounded-full bg-sheet p-1.5 shadow group-hover:block" aria-label="Delete artwork"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              );
            })}
          </div>
          <Button className="mt-6" onClick={onNext} disabled={!data.cover.selected_path}>Use this</Button>
        </>
      ) : (
        <p className="text-ink-muted">Generate artwork with AI, pick a template, or upload your own to fill the cover.</p>
      )}
    </div>
  );
}

function TemplateThumb({ t }: { t: (typeof TEMPLATES)[number] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.save();
    ctx.scale(c.width / 1024, c.height / 1536);
    drawTemplate(ctx, t.kind, t.colors);
    ctx.restore();
  }, [t]);
  return <canvas ref={ref} width={160} height={240} className="aspect-[2/3] w-full rounded-sm shadow-sm" aria-hidden />;
}

function useImage(url?: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return setImg(null);
    let alive = true;
    loadImage(url).then((i) => alive && setImg(i)).catch(() => alive && setImg(null));
    return () => {
      alive = false;
    };
  }, [url]);
  return img;
}

function useAssets(data: Data, d: CoverDesign): WrapAssets {
  const backImage = useImage(d.backImagePath ? data.urls[d.backImagePath] : null);
  const authorPhoto = useImage(d.authorPhotoPath ? data.urls[d.authorPhotoPath] : null);
  const logo = useImage(d.logoPath ? data.urls[d.logoPath] : null);
  return { backImage, authorPhoto, logo };
}

function frontText(data: Data, brief: CoverBrief, subtitle: string) {
  return {
    title: data.book.title,
    subtitle,
    author: data.author,
    tagline: brief.format === 'paperback' ? '' : brief.tagline,
    series: brief.series ? `${brief.series}${brief.seriesNumber ? ` · Book ${brief.seriesNumber}` : ''}` : '',
  };
}

function backText(brief: CoverBrief, book: { blurb: string; author_bio: string }) {
  return { blurb: book.blurb, quotes: brief.reviewQuotes, sources: brief.quoteSources ?? [], bio: book.author_bio, imprint: brief.imprint, website: brief.website };
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([k, l]) => (
          <button key={k} type="button" className="chip" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function ColourField({ label, value, onChange, id }: { label: string; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <Field label={label} htmlFor={id}>
      <input id={id} type="color" className="h-10 w-full rounded border border-line" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function DesignStep({ data, bookId, design, setDesign, brief, book, imageUrl, busy, onNext }: {
  data: Data; bookId: string; design: CoverDesign; setDesign: (d: CoverDesign) => void; brief: CoverBrief;
  book: { subtitle: string; blurb: string; author_bio: string }; imageUrl?: string; busy: string; onNext: () => void;
}) {
  const toast = useToast();
  const img = useImage(imageUrl);
  const assets = useAssets(data, design);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLCanvasElement>(null);
  const [panel, setPanel] = useState<'front' | 'spine' | 'back'>('front');
  const [overflow, setOverflow] = useState(false);
  const [uploading, setUploading] = useState('');
  const set = <K extends keyof CoverDesign>(k: K, v: CoverDesign[K]) => setDesign({ ...design, [k]: v });
  const paperback = brief.format === 'paperback';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([loadFont(design.titleFont), loadFont(design.authorFont), loadFont(design.blurbFont || design.authorFont), loadFont(design.spineFont || design.titleFont)]);
      if (cancelled) return;
      const t = frontText(data, brief, book.subtitle);
      const c = frontRef.current;
      if (c) {
        const ctx = c.getContext('2d')!;
        ctx.clearRect(0, 0, c.width, c.height);
        drawFront(ctx, img, design, t, 0, 0, c.width, c.height);
      }
      const w = wrapRef.current;
      if (w && paperback) {
        const g = data.geometry;
        const dpi = 60;
        w.width = Math.round((g.trimW * 2 + g.spine + BLEED * 2) * dpi);
        w.height = Math.round((g.trimH + BLEED * 2) * dpi);
        const r = drawWrap(w.getContext('2d')!, img, design, { ...t, tagline: brief.tagline }, backText(brief, book), { ...g, bleed: BLEED }, dpi, assets);
        setOverflow(r.overflow);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [img, design, data, brief, book, assets, paperback]);

  async function uploadAsset(file: File | undefined, key: 'backImagePath' | 'authorPhotoPath' | 'logoPath') {
    if (!file) return;
    if (!/image\/(png|jpeg|webp)/.test(file.type)) return toast('Use a JPG, PNG or WebP image.', 'error');
    setUploading(key);
    try {
      const path = await uploadToCovers(bookId, file, `${key}-${crypto.randomUUID()}.${file.type.split('/')[1].replace('jpeg', 'jpg')}`, file.type);
      const next = { ...design, [key]: path, ...(key === 'backImagePath' ? { backBackground: 'image' as const } : {}) };
      await api(`/api/books/${bookId}/cover`, { method: 'PUT', body: { design: next } });
      const fresh = await api<Data>(`/api/books/${bookId}/cover`);
      data.urls[path] = fresh.urls[path];
      setDesign(next);
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setUploading('');
  }

  const fonts = TITLE_FONTS.map((f) => <option key={f}>{f}</option>);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_1fr]">
      <div className="space-y-3">
        <canvas ref={frontRef} width={800} height={1200} className="w-full rounded-sm shadow-lg" aria-label="Front cover preview" />
        {design.finishedFront && <p className="text-[13px] text-ink-muted">This is an imported finished cover, so no lettering is added to the front. <button className="text-cloth underline" onClick={() => set('finishedFront', false)}>Add lettering anyway</button></p>}
      </div>
      <div className="space-y-5">
        {paperback && (
          <div className="flex rounded-md border border-line bg-sheet p-1 text-[14px] sm:w-fit" role="tablist">
            {([['front', 'Front'], ['spine', 'Spine'], ['back', 'Back']] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={panel === k} onClick={() => setPanel(k)} className={clsx('flex-1 rounded px-4 py-1.5', panel === k ? 'bg-ink text-white' : 'text-ink-soft')}>{l}</button>
            ))}
          </div>
        )}

        {panel === 'front' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title font" htmlFor="tf"><select id="tf" className="field" value={design.titleFont} onChange={(e) => set('titleFont', e.target.value)}>{fonts}</select></Field>
              <Field label="Author font" htmlFor="af"><select id="af" className="field" value={design.authorFont} onChange={(e) => set('authorFont', e.target.value)}>{fonts}</select></Field>
              <ColourField id="tc" label="Title colour" value={design.titleColor} onChange={(v) => set('titleColor', v)} />
              <ColourField id="ac" label="Author colour" value={design.authorColor} onChange={(v) => set('authorColor', v)} />
              <Field label={`Title size (${Math.round(design.titleScale * 100)}%)`} htmlFor="ts"><input id="ts" type="range" min={0.6} max={1.6} step={0.05} className="w-full accent-cloth" value={design.titleScale} onChange={(e) => set('titleScale', Number(e.target.value))} /></Field>
              <Field label={`Author size (${Math.round((design.authorScale ?? 1) * 100)}%)`} htmlFor="as"><input id="as" type="range" min={0.6} max={1.6} step={0.05} className="w-full accent-cloth" value={design.authorScale ?? 1} onChange={(e) => set('authorScale', Number(e.target.value))} /></Field>
              <Field label="Title position" htmlFor="ty"><input id="ty" type="range" min={0.04} max={0.6} step={0.01} className="w-full accent-cloth" value={design.titleY} onChange={(e) => set('titleY', Number(e.target.value))} /></Field>
              <Field label="Author position" htmlFor="ay"><input id="ay" type="range" min={0.6} max={0.97} step={0.01} className="w-full accent-cloth" value={design.authorY} onChange={(e) => set('authorY', Number(e.target.value))} /></Field>
              <Field label="Art position" htmlFor="apy"><input id="apy" type="range" min={0} max={1} step={0.02} className="w-full accent-cloth" value={design.artY ?? 0.5} onChange={(e) => set('artY', Number(e.target.value))} /></Field>
              <Field label={`Art zoom (${Math.round((design.artZoom ?? 1) * 100)}%)`} htmlFor="az"><input id="az" type="range" min={1} max={1.6} step={0.02} className="w-full accent-cloth" value={design.artZoom ?? 1} onChange={(e) => set('artZoom', Number(e.target.value))} /></Field>
            </div>
            <Seg label="Alignment" value={design.align} onChange={(v) => set('align', v)} options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} />
            <Seg label="Text backdrop" value={design.shadePosition} onChange={(v) => set('shadePosition', v)} options={[['none', 'None'], ['bottom', 'Fade from bottom'], ['top', 'Fade from top'], ['both', 'Top and bottom'], ['all', 'Darken all']]} />
            {design.shadePosition !== 'none' && (
              <Field label="Backdrop strength" htmlFor="sh"><input id="sh" type="range" min={0.1} max={0.8} step={0.05} className="w-full accent-cloth" value={design.shade} onChange={(e) => set('shade', Number(e.target.value))} /></Field>
            )}
            <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" className="accent-cloth" checked={design.uppercaseTitle} onChange={(e) => set('uppercaseTitle', e.target.checked)} />Title in capital letters</label>
          </div>
        )}

        {panel === 'spine' && (
          <div className="space-y-4">
            <p className="text-[14px] text-ink-muted">{data.geometry.spineText ? `Your spine is ${data.geometry.spine.toFixed(3)}″ wide, so it shows the title and your name.` : 'Under 79 pages, printers don’t allow text on the spine, so it’s colour only.'}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <ColourField id="sc" label="Spine colour" value={design.spineColor} onChange={(v) => set('spineColor', v)} />
              <ColourField id="stc" label="Spine text colour" value={design.spineTextColor ?? '#ffffff'} onChange={(v) => set('spineTextColor', v)} />
              <Field label="Spine font" htmlFor="sf"><select id="sf" className="field" value={design.spineFont || design.titleFont} onChange={(e) => set('spineFont', e.target.value)}>{fonts}</select></Field>
            </div>
          </div>
        )}

        {panel === 'back' && (
          <div className="space-y-4">
            <Seg label="Background" value={design.backBackground ?? 'solid'} onChange={(v) => set('backBackground', v)} options={[['match', 'Match the front'], ['blur', 'Blurred artwork'], ['solid', 'Solid colour'], ['fade', 'Fade to black'], ['image', 'My own image']]} />
            {design.backBackground === 'image' && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-[14px] text-cloth underline">
                <Upload className="h-4 w-4" />{uploading === 'backImagePath' ? 'Uploading…' : design.backImagePath ? 'Change back-cover image' : 'Upload a back-cover image'}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => uploadAsset(e.target.files?.[0], 'backImagePath')} />
              </label>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <ColourField id="bc" label="Background colour" value={design.backColor} onChange={(v) => set('backColor', v)} />
              <ColourField id="btc" label="Text colour" value={design.backTextColor} onChange={(v) => set('backTextColor', v)} />
              <Field label="Blurb font" htmlFor="bf"><select id="bf" className="field" value={design.blurbFont || design.authorFont} onChange={(e) => set('blurbFont', e.target.value)}>{fonts}</select></Field>
              <Field label={`Blurb size (${Math.round((design.blurbScale ?? 1) * 100)}%)`} htmlFor="bs"><input id="bs" type="range" min={0.8} max={1.3} step={0.05} className="w-full accent-cloth" value={design.blurbScale ?? 1} onChange={(e) => set('blurbScale', Number(e.target.value))} /></Field>
            </div>
            <Seg label="Blurb alignment" value={design.blurbAlign ?? 'left'} onChange={(v) => set('blurbAlign', v)} options={[['left', 'Left'], ['center', 'Centre'], ['justify', 'Justified']]} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded border border-line p-3">
                <p className="label">Author photo</p>
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {design.authorPhotoPath && data.urls[design.authorPhotoPath] && <img src={data.urls[design.authorPhotoPath]} alt="" className={clsx('h-14 w-14 object-cover', design.photoShape === 'circle' ? 'rounded-full' : 'rounded')} />}
                  <label className="cursor-pointer text-[14px] text-cloth underline">
                    {uploading === 'authorPhotoPath' ? 'Uploading…' : design.authorPhotoPath ? 'Change' : 'Upload a photo'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => uploadAsset(e.target.files?.[0], 'authorPhotoPath')} />
                  </label>
                  {design.authorPhotoPath && <button className="text-[14px] text-ink-muted underline" onClick={() => set('authorPhotoPath', null)}>Remove</button>}
                </div>
                {design.authorPhotoPath && <Seg label="Photo shape" value={design.photoShape ?? 'circle'} onChange={(v) => set('photoShape', v)} options={[['circle', 'Circle'], ['square', 'Square']]} />}
                <p className="text-[12px] text-ink-muted">Shown beside your author bio.</p>
              </div>
              <div className="space-y-2 rounded border border-line p-3">
                <p className="label">Publisher logo</p>
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {design.logoPath && data.urls[design.logoPath] && <img src={data.urls[design.logoPath]} alt="" className="h-10 max-w-[100px] object-contain" />}
                  <label className="cursor-pointer text-[14px] text-cloth underline">
                    {uploading === 'logoPath' ? 'Uploading…' : design.logoPath ? 'Change' : 'Upload a logo'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => uploadAsset(e.target.files?.[0], 'logoPath')} />
                  </label>
                  {design.logoPath && <button className="text-[14px] text-ink-muted underline" onClick={() => set('logoPath', null)}>Remove</button>}
                </div>
                <p className="text-[12px] text-ink-muted">A PNG with a transparent background works best.</p>
              </div>
            </div>
            <p className="text-[13px] text-ink-muted">The blurb, quotes, tagline and bio come from the Brief step.</p>
          </div>
        )}

        {paperback && (
          <div>
            <h3 className="mb-2">Full paperback cover</h3>
            <canvas ref={wrapRef} className="w-full rounded-sm shadow" aria-label="Full cover preview: back, spine and front" />
            {overflow && <p className="mt-2 flex items-center gap-2 text-[13px] text-danger"><AlertTriangle className="h-4 w-4" />The back-cover text doesn’t all fit. Shorten the blurb or bio, or reduce the blurb size.</p>}
            <p className="mt-2 text-[13px] text-ink-muted">The white box on the back is where the printer adds the ISBN barcode. Edges extend 0.125″ past the trim for bleed.</p>
          </div>
        )}
        <Button onClick={onNext} loading={busy === 'save'}>Save design and continue</Button>
      </div>
    </div>
  );
}

interface Check { label: string; status: 'ok' | 'warn' | 'fail'; note: string }

function ExportStep({ data, design, brief, book, imageUrl, bookId, onDone, onOpenDesign }: {
  data: Data; design: CoverDesign; brief: CoverBrief; book: { subtitle: string; blurb: string; author_bio: string }; imageUrl?: string; bookId: string; onDone: () => Promise<Data>; onOpenDesign: () => void;
}) {
  const toast = useToast();
  const img = useImage(imageUrl);
  const assets = useAssets(data, design);
  const [busy, setBusy] = useState('');
  const g = data.geometry;
  const paperback = brief.format === 'paperback';

  const checks: Check[] = [];
  if (img) {
    const dpi = Math.round(img.width / (g.trimW + BLEED));
    checks.push({
      label: 'Artwork resolution',
      status: dpi >= 250 ? 'ok' : dpi >= 150 ? 'warn' : 'fail',
      note: dpi >= 250 ? `${dpi} dpi at print size: sharp.` : dpi >= 150 ? `${dpi} dpi at print size: fine for ebooks, may look slightly soft in print.` : `${dpi} dpi at print size: too low for print. Use a larger image.`,
    });
  } else checks.push({ label: 'Artwork', status: 'fail', note: 'Choose artwork in the Create step.' });
  if (paperback) {
    checks.push({ label: 'Page count', status: g.pagesSource === 'measured' ? 'ok' : 'warn', note: g.pagesSource === 'measured' ? `${g.pages} pages, measured from your print interior.` : `${g.pages} pages, ${g.pagesSource === 'yours' ? 'entered by you' : 'estimated'}. Create the print PDF on the Layout tab for an exact spine.` });
    checks.push({ label: 'Spine text', status: 'ok', note: g.spineText ? 'Title and author on the spine.' : 'Under 79 pages: colour only, as printers require.' });
    checks.push({ label: 'Back-cover blurb', status: book.blurb.trim() ? 'ok' : 'warn', note: book.blurb.trim() ? 'Present.' : 'No description on the back cover yet. Add one in the Brief step.' });
    checks.push({ label: 'Barcode area', status: 'ok', note: 'Kept clear for the ISBN barcode.' });
  }
  const finalVersion = data.versions.find((v) => v.status === 'final');
  checks.push({ label: 'Final version', status: finalVersion ? 'ok' : 'warn', note: finalVersion ? `“${finalVersion.name}” is marked final.` : 'Save a version and mark it final, so you can always get back to it.' });
  const blocking = checks.some((c) => c.status === 'fail');

  async function exportAll() {
    if (!img) return toast('Choose cover artwork first.', 'error');
    setBusy('export');
    try {
      await Promise.all([loadFont(design.titleFont), loadFont(design.authorFont), loadFont(design.blurbFont || design.authorFont), loadFont(design.spineFont || design.titleFont)]);
      const t = frontText(data, brief, book.subtitle);
      const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob>((r) => c.toBlob((b) => r(b!), type, q));

      // Ebook front: 1600 × 2560 (Amazon's recommended size).
      const fc = document.createElement('canvas');
      fc.width = 1600;
      fc.height = 2560;
      drawFront(fc.getContext('2d')!, img, design, t, 0, 0, 1600, 2560);
      const frontPath = await uploadToCovers(bookId, await toBlob(fc, 'image/png'), 'cover-front.png', 'image/png');
      await uploadToCovers(bookId, await toBlob(fc, 'image/jpeg', 0.92), 'cover-ebook.jpg', 'image/jpeg');

      const sc = document.createElement('canvas');
      sc.width = 1200;
      sc.height = 630;
      drawSocial(sc.getContext('2d')!, fc, design, { ...t, tagline: brief.tagline });
      const socialPath = await uploadToCovers(bookId, await toBlob(sc, 'image/png'), 'cover-social.png', 'image/png');

      let wrapPath: string | undefined;
      let wrapInches: { width: number; height: number } | undefined;
      if (paperback) {
        const dpi = 300;
        const wc = document.createElement('canvas');
        wrapInches = { width: g.trimW * 2 + g.spine + BLEED * 2, height: g.trimH + BLEED * 2 };
        wc.width = Math.round(wrapInches.width * dpi);
        wc.height = Math.round(wrapInches.height * dpi);
        drawWrap(wc.getContext('2d')!, img, design, { ...t, tagline: brief.tagline }, backText(brief, book), { ...g, bleed: BLEED }, dpi, assets);
        wrapPath = await uploadToCovers(bookId, await toBlob(wc, 'image/jpeg', 0.95), 'cover-wrap.jpg', 'image/jpeg');
      }
      await api(`/api/books/${bookId}/cover/final`, { body: { frontPath, wrapPath, wrapInches, socialPath } });
      await onDone();
      toast('Cover files exported');
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  async function version(action: string, versionId?: string, name?: string) {
    setBusy(`${action}:${versionId ?? ''}`);
    try {
      if (action === 'open') {
        await api(`/api/books/${bookId}/cover/versions`, { body: { action, versionId } });
        await onDone();
        toast('Version opened. Make changes in the Design step.');
        onOpenDesign();
      } else {
        await api(`/api/books/${bookId}/cover/versions`, { body: { action, versionId, name, pages: g.pages } });
        await onDone();
        if (action === 'final') toast('Marked as the final cover');
        if (action === 'save') toast('Version saved');
      }
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  const frontUrl = data.cover.front_path ? data.urls[data.cover.front_path] : undefined;
  const wrapUrl = data.cover.wrap_path ? data.urls[data.cover.wrap_path] : undefined;
  const socialUrl = data.cover.social_path ? data.urls[data.cover.social_path] : undefined;
  const ebookUrl = data.cover.front_path ? data.urls[data.cover.front_path.replace('cover-front.png', 'cover-ebook.jpg')] : undefined;

  return (
    <div className="grid max-w-[1100px] gap-8 lg:grid-cols-[300px_1fr]">
      <div className="space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {frontUrl ? <img src={frontUrl} alt="Finished front cover" className="w-full rounded-sm shadow-lg" /> : <div className="grid aspect-[10/16] place-items-center rounded-sm bg-ground text-ink-muted">Not exported yet</div>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {socialUrl && <img src={socialUrl} alt="Social media image" className="w-full rounded-sm shadow" />}
      </div>
      <div className="space-y-6">
        <section>
          <h3 className="mb-2">Preflight</h3>
          <ul className="panel divide-y divide-line">
            {checks.map((c) => (
              <li key={c.label} className="flex gap-3 px-4 py-2.5 text-[14px]">
                {c.status === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cloth" /> : <AlertTriangle className={clsx('mt-0.5 h-4 w-4 shrink-0', c.status === 'fail' ? 'text-danger' : 'text-gilt')} />}
                <span><span className="font-medium">{c.label}.</span> <span className="text-ink-muted">{c.note}</span></span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h3>Export files</h3>
          <p className="text-[14px] text-ink-muted">
            Creates your ebook cover (1600 × 2560, JPEG and PNG), a social media image (1200 × 630){paperback && `, and a print-ready full cover PDF: ${(g.trimW * 2 + g.spine + BLEED * 2).toFixed(3)}″ × ${(g.trimH + BLEED * 2).toFixed(3)}″ at 300 dpi with a ${g.spine.toFixed(3)}″ spine`}.
          </p>
          <Button onClick={exportAll} loading={busy === 'export'} disabled={blocking}>{frontUrl ? 'Export again' : 'Export files'}</Button>
          {frontUrl && (
            <div className="flex flex-wrap gap-2 pt-1">
              {ebookUrl && <a href={ebookUrl} download="ebook-cover.jpg" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded border border-line-strong bg-sheet px-3 py-2 text-[14px]"><Download className="h-4 w-4" />Ebook cover (JPEG)</a>}
              <a href={frontUrl} download="cover-front.png" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded border border-line-strong bg-sheet px-3 py-2 text-[14px]"><Download className="h-4 w-4" />Front cover (PNG)</a>
              {wrapUrl && <a href={wrapUrl} download="cover-paperback.pdf" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded border border-line-strong bg-sheet px-3 py-2 text-[14px]"><Download className="h-4 w-4" />Print cover (PDF)</a>}
              {socialUrl && <a href={socialUrl} download="cover-social.png" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded border border-line-strong bg-sheet px-3 py-2 text-[14px]"><Download className="h-4 w-4" />Social image</a>}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3>Versions</h3>
              <p className="text-[13px] text-ink-muted">Every save is kept. One final version is your book’s cover.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => version('save', undefined, prompt('Name this version', `Version ${data.versions.length + 1}`) ?? undefined)} loading={busy === 'save:'}>Save current design as a version</Button>
          </div>
          {data.versions.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.versions.map((v) => {
                const outdated = !!v.pages && paperback && (v.pages !== g.pages || v.trim_size !== data.book.trim_size || v.paper !== data.book.paper);
                return (
                  <li key={v.id} className="panel flex gap-3 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {v.selected_path && data.urls[v.selected_path] ? <img src={data.urls[v.selected_path]} alt="" className="h-24 w-16 rounded-sm object-cover" /> : <div className="h-24 w-16 rounded-sm bg-ground" />}
                    <div className="min-w-0 flex-1 text-[14px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{v.name}</span>
                        <Badge tone={v.status === 'final' ? 'cloth' : 'neutral'}>{v.status === 'final' ? 'Final' : 'Draft'}</Badge>
                        {outdated && <Badge tone="gilt">Outdated</Badge>}
                      </div>
                      <p className="text-[12px] text-ink-muted">{new Date(v.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                      {outdated && <p className="text-[12px] text-ink-muted">Page count or trim size changed since it was saved. Open it and export again.</p>}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button size="sm" variant="secondary" onClick={() => version('open', v.id)} loading={busy === `open:${v.id}`}>Open</Button>
                        {v.status !== 'final' && <Button size="sm" variant="ghost" onClick={() => version('final', v.id)}><Star className="h-3.5 w-3.5" />Mark final</Button>}
                        <Button size="sm" variant="ghost" onClick={() => version('duplicate', v.id)} aria-label={`Duplicate ${v.name}`}><Copy className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { const n = prompt('Rename version', v.name); if (n) version('rename', v.id, n); }} aria-label={`Rename ${v.name}`}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete “${v.name}”?`)) version('delete', v.id); }} aria-label={`Delete ${v.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[14px] text-ink-muted">No saved versions yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
