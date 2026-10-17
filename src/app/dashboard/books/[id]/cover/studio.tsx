'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Check, Download, Sparkles, Trash2, Upload } from 'lucide-react';
import { api, errorText } from '@/lib/client';
import { createClient } from '@/lib/supabase/client';
import { COVER_STYLES, MOODS, PALETTES, TITLE_FONTS, type CoverBrief, type CoverDesign } from '@/lib/cover';
import { drawFront, drawWrap, loadFont, loadImage } from '@/lib/canvas';
import { BLEED } from '@/lib/spine';
import { Button, Field, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';

interface Data {
  book: { id: string; title: string; subtitle: string; genre: string; summary: string; blurb: string; author_bio: string; trim_size: string; paper: 'white' | 'cream' };
  author: string;
  cover: { brief: CoverBrief; design: CoverDesign; concepts: { path: string; prompt: string; created_at: string }[]; selected_path: string | null; front_path: string | null; wrap_path: string | null };
  urls: Record<string, string>;
  geometry: { pages: number; pagesSource: 'yours' | 'measured' | 'estimated'; words: number; width: number; height: number; spine: number; trimW: number; trimH: number; spineText: boolean };
  trims: Record<string, { w: number; h: number; label: string }>;
}

const STEPS = ['Brief', 'Create', 'Design', 'Finish and export'] as const;

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
        Claude turns your brief into art direction, ChatGPT paints the artwork, and you set the lettering with real fonts so the title is always sharp and spelled right.
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
          onSelect={async (path) => {
            await api(`/api/books/${bookId}/cover`, { method: 'PUT', body: { selected_path: path } });
            await reload();
          }}
          onNext={() => saveAll(2)}
        />
      )}
      {step === 2 && <DesignStep data={data} design={design} setDesign={setDesign} brief={brief} book={book} imageUrl={selectedUrl} busy={busy} onNext={() => saveAll(3)} />}
      {step === 3 && <ExportStep data={data} design={design} brief={brief} book={book} imageUrl={selectedUrl} bookId={bookId} onDone={reload} />}
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
              {geo.pages} pages ({geo.pagesSource === 'measured' ? 'measured from your print interior' : geo.pagesSource === 'yours' ? 'your number' : `estimated from ${geo.words.toLocaleString('en-GB')} words; create the print PDF on the Format tab for the exact count`}) · spine {geo.spine.toFixed(3)}″
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
            <Field label="Review quotes (optional, one per line, real reviews only)" htmlFor="rq">
              <textarea id="rq" className="field min-h-[70px]" value={brief.reviewQuotes.join('\n')} onChange={(e) => set('reviewQuotes', e.target.value.split('\n').slice(0, 3))} />
            </Field>
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

function CreateStep({ data, busy, onGenerate, onSelect, onNext }: { data: Data; busy: string; onGenerate: (count: number, tweak: string) => Promise<void>; onSelect: (p: string) => Promise<void>; onNext: () => void }) {
  const [tweak, setTweak] = useState('');
  const [count, setCount] = useState(3);
  const concepts = data.cover.concepts;
  return (
    <div className="max-w-[1100px]">
      <div className="panel mb-6 flex flex-wrap items-end gap-3 p-4">
        <Field label={concepts.length ? 'What should change? (optional)' : 'Anything to add? (optional)'} htmlFor="tw">
          <input id="tw" className="field w-[min(80vw,460px)]" placeholder="e.g. Warmer light, a stadium at dusk" value={tweak} onChange={(e) => setTweak(e.target.value)} />
        </Field>
        <Field label="How many" htmlFor="cnt">
          <select id="cnt" className="field w-auto" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}
          </select>
        </Field>
        <Button onClick={() => onGenerate(count, tweak)} loading={busy === 'gen'}>
          <Sparkles className="h-4 w-4" />{busy === 'gen' ? 'Painting… about a minute' : concepts.length ? 'Generate more' : 'Generate concepts'}
        </Button>
      </div>
      {concepts.length ? (
        <>
          <p className="mb-3 text-[14px] text-ink-muted">Choose the artwork you like. The title and your name are added in the next step.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {concepts.map((c) => {
              const sel = c.path === data.cover.selected_path;
              return (
                <button key={c.path} onClick={() => onSelect(c.path)} aria-pressed={sel} className={clsx('relative overflow-hidden rounded-md border-2', sel ? 'border-cloth' : 'border-transparent hover:border-line-strong')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={data.urls[c.path]} alt="Cover concept" className="aspect-[2/3] w-full object-cover" />
                  {sel && <span className="absolute right-2 top-2 rounded-full bg-cloth p-1 text-white"><Check className="h-4 w-4" /></span>}
                </button>
              );
            })}
          </div>
          <Button className="mt-6" onClick={onNext} disabled={!data.cover.selected_path}>Use this artwork</Button>
        </>
      ) : (
        <p className="text-ink-muted">Each concept uses AI tokens from your monthly allowance. Generation takes about a minute.</p>
      )}
    </div>
  );
}

function useCoverImage(url?: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return setImg(null);
    loadImage(url).then(setImg).catch(() => setImg(null));
  }, [url]);
  return img;
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

function DesignStep({ data, design, setDesign, brief, book, imageUrl, busy, onNext }: {
  data: Data; design: CoverDesign; setDesign: (d: CoverDesign) => void; brief: CoverBrief;
  book: { subtitle: string; blurb: string; author_bio: string }; imageUrl?: string; busy: string; onNext: () => void;
}) {
  const img = useCoverImage(imageUrl);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLCanvasElement>(null);
  const set = <K extends keyof CoverDesign>(k: K, v: CoverDesign[K]) => setDesign({ ...design, [k]: v });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([loadFont(design.titleFont), loadFont(design.authorFont)]);
      if (cancelled) return;
      const t = frontText(data, brief, book.subtitle);
      const c = frontRef.current;
      if (c) {
        const ctx = c.getContext('2d')!;
        ctx.clearRect(0, 0, c.width, c.height);
        drawFront(ctx, img, design, t, 0, 0, c.width, c.height);
      }
      const w = wrapRef.current;
      if (w && brief.format === 'paperback') {
        const g = data.geometry;
        const dpi = 60;
        w.width = Math.round((g.trimW * 2 + g.spine + BLEED * 2) * dpi);
        w.height = Math.round((g.trimH + BLEED * 2) * dpi);
        const ctx = w.getContext('2d')!;
        drawWrap(ctx, img, design, { ...t, tagline: brief.tagline }, { blurb: book.blurb, quotes: brief.reviewQuotes, bio: book.author_bio, imprint: brief.imprint, website: brief.website }, { ...g, bleed: BLEED }, dpi);
      }
    })();
    return () => { cancelled = true; };
  }, [img, design, data, brief, book]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div>
        <canvas ref={frontRef} width={800} height={1200} className="w-full rounded-sm shadow-lg" aria-label="Front cover preview" />
      </div>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title font" htmlFor="tf">
            <select id="tf" className="field" value={design.titleFont} onChange={(e) => set('titleFont', e.target.value)}>{TITLE_FONTS.map((f) => <option key={f}>{f}</option>)}</select>
          </Field>
          <Field label="Author and subtitle font" htmlFor="af">
            <select id="af" className="field" value={design.authorFont} onChange={(e) => set('authorFont', e.target.value)}>{TITLE_FONTS.map((f) => <option key={f}>{f}</option>)}</select>
          </Field>
          <Field label="Title colour" htmlFor="tc"><input id="tc" type="color" className="h-10 w-full rounded border border-line" value={design.titleColor} onChange={(e) => set('titleColor', e.target.value)} /></Field>
          <Field label="Author colour" htmlFor="ac"><input id="ac" type="color" className="h-10 w-full rounded border border-line" value={design.authorColor} onChange={(e) => set('authorColor', e.target.value)} /></Field>
          <Field label={`Title size (${Math.round(design.titleScale * 100)}%)`} htmlFor="ts"><input id="ts" type="range" min={0.6} max={1.6} step={0.05} className="w-full accent-cloth" value={design.titleScale} onChange={(e) => set('titleScale', Number(e.target.value))} /></Field>
          <Field label="Title position" htmlFor="ty"><input id="ty" type="range" min={0.04} max={0.6} step={0.01} className="w-full accent-cloth" value={design.titleY} onChange={(e) => set('titleY', Number(e.target.value))} /></Field>
          <Field label="Author position" htmlFor="ay"><input id="ay" type="range" min={0.6} max={0.97} step={0.01} className="w-full accent-cloth" value={design.authorY} onChange={(e) => set('authorY', Number(e.target.value))} /></Field>
          <Field label="Shade behind text" htmlFor="sh"><input id="sh" type="range" min={0} max={0.8} step={0.05} className="w-full accent-cloth" value={design.shade} onChange={(e) => set('shade', Number(e.target.value))} /></Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip" aria-pressed={design.align === 'center'} onClick={() => set('align', 'center')}>Centred</button>
          <button type="button" className="chip" aria-pressed={design.align === 'left'} onClick={() => set('align', 'left')}>Left aligned</button>
          <button type="button" className="chip" aria-pressed={design.uppercaseTitle} onClick={() => set('uppercaseTitle', !design.uppercaseTitle)}>Capital letters</button>
          {(['top', 'bottom', 'both'] as const).map((p) => (
            <button key={p} type="button" className="chip" aria-pressed={design.shadePosition === p} onClick={() => set('shadePosition', p)}>Shade {p === 'both' ? 'top and bottom' : p}</button>
          ))}
        </div>
        {brief.format === 'paperback' && (
          <div>
            <h3 className="mb-2">Full paperback cover</h3>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <Field label="Back colour" htmlFor="bc"><input id="bc" type="color" className="h-10 w-full rounded border border-line" value={design.backColor} onChange={(e) => set('backColor', e.target.value)} /></Field>
              <Field label="Back text" htmlFor="btc"><input id="btc" type="color" className="h-10 w-full rounded border border-line" value={design.backTextColor} onChange={(e) => set('backTextColor', e.target.value)} /></Field>
              <Field label="Spine colour" htmlFor="sc"><input id="sc" type="color" className="h-10 w-full rounded border border-line" value={design.spineColor} onChange={(e) => set('spineColor', e.target.value)} /></Field>
            </div>
            <canvas ref={wrapRef} className="w-full rounded-sm shadow" aria-label="Full cover preview: back, spine and front" />
            <p className="mt-2 text-[13px] text-ink-muted">The white box on the back is where the printer adds the ISBN barcode. Edges extend 0.125″ past the trim for bleed.</p>
          </div>
        )}
        <Button onClick={onNext} loading={busy === 'save'}>Save design and continue</Button>
      </div>
    </div>
  );
}

function ExportStep({ data, design, brief, book, imageUrl, bookId, onDone }: {
  data: Data; design: CoverDesign; brief: CoverBrief; book: { subtitle: string; blurb: string; author_bio: string }; imageUrl?: string; bookId: string; onDone: () => Promise<Data>;
}) {
  const toast = useToast();
  const img = useCoverImage(imageUrl);
  const [busy, setBusy] = useState(false);
  const g = data.geometry;

  async function exportAll() {
    if (!img) return toast('Choose cover artwork first.', 'error');
    setBusy(true);
    try {
      await Promise.all([loadFont(design.titleFont), loadFont(design.authorFont)]);
      const sb = createClient();
      const { data: u } = await sb.auth.getUser();
      const base = `${u.user!.id}/${bookId}`;
      const t = frontText(data, brief, book.subtitle);

      // Ebook front: 1600 × 2560 (Amazon's recommended size).
      const fc = document.createElement('canvas');
      fc.width = 1600;
      fc.height = 2560;
      drawFront(fc.getContext('2d')!, img, design, t, 0, 0, 1600, 2560);
      const front = await new Promise<Blob>((r) => fc.toBlob((b) => r(b!), 'image/png'));
      const frontPath = `${base}/cover-front.png`;
      const up1 = await sb.storage.from('covers').upload(frontPath, front, { contentType: 'image/png', upsert: true });
      if (up1.error) throw up1.error;

      let wrapPath: string | undefined;
      let wrapInches: { width: number; height: number } | undefined;
      if (brief.format === 'paperback') {
        const dpi = 300;
        const wc = document.createElement('canvas');
        wrapInches = { width: g.trimW * 2 + g.spine + BLEED * 2, height: g.trimH + BLEED * 2 };
        wc.width = Math.round(wrapInches.width * dpi);
        wc.height = Math.round(wrapInches.height * dpi);
        drawWrap(wc.getContext('2d')!, img, design, { ...t, tagline: brief.tagline }, { blurb: book.blurb, quotes: brief.reviewQuotes, bio: book.author_bio, imprint: brief.imprint, website: brief.website }, { ...g, bleed: BLEED }, dpi);
        const wrap = await new Promise<Blob>((r) => wc.toBlob((b) => r(b!), 'image/jpeg', 0.95));
        wrapPath = `${base}/cover-wrap.jpg`;
        const up2 = await sb.storage.from('covers').upload(wrapPath, wrap, { contentType: 'image/jpeg', upsert: true });
        if (up2.error) throw up2.error;
      }
      await api(`/api/books/${bookId}/cover/final`, { body: { frontPath, wrapPath, wrapInches } });
      await onDone();
      toast('Cover finished');
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy(false);
  }

  const frontUrl = data.cover.front_path ? data.urls[data.cover.front_path] : undefined;
  const wrapUrl = data.cover.wrap_path ? data.urls[data.cover.wrap_path] : undefined;

  return (
    <div className="grid max-w-[980px] gap-8 lg:grid-cols-[320px_1fr]">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {frontUrl ? <img src={frontUrl} alt="Finished front cover" className="w-full rounded-sm shadow-lg" /> : <div className="grid aspect-[10/16] place-items-center rounded-sm bg-ground text-ink-muted">Not exported yet</div>}
      </div>
      <div className="space-y-4">
        <p className="text-ink-muted">
          Creates your ebook cover (1600 × 2560 px){brief.format === 'paperback' && `, and a print-ready full cover PDF: ${(g.trimW * 2 + g.spine + BLEED * 2).toFixed(3)}″ × ${(g.trimH + BLEED * 2).toFixed(3)}″ at 300 dpi, with a ${g.spine.toFixed(3)}″ spine for ${g.pages} pages`}.
        </p>
        {g.pagesSource === 'estimated' && brief.format === 'paperback' && (
          <p className="rounded-md border border-gilt/40 bg-gilt-light px-3 py-2 text-[14px]">
            The spine uses an estimated page count. Create the print PDF on the Format tab first for an exact spine, then export again here.
          </p>
        )}
        <Button onClick={exportAll} loading={busy}>{frontUrl ? 'Export again' : 'Export cover'}</Button>
        {frontUrl && (
          <div className="flex flex-wrap gap-2 pt-2">
            <a href={frontUrl} download="cover-front.png" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded border border-line-strong bg-sheet px-3 py-2 text-[14px]"><Download className="h-4 w-4" />Ebook cover (PNG)</a>
            {wrapUrl && <a href={wrapUrl} download="cover-paperback.pdf" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded border border-line-strong bg-sheet px-3 py-2 text-[14px]"><Download className="h-4 w-4" />Paperback cover (PDF)</a>}
          </div>
        )}
      </div>
    </div>
  );
}
