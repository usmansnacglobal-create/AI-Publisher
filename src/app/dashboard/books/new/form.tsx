'use client';
import { importManuscript } from '@/lib/import-client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { ArrowLeft, ArrowRight, FileUp, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { api, errorText } from '@/lib/client';
import { Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';
import { DIALECTS, GENRES, PACING, POVS, WRITING_STYLES } from '@/lib/genres';
import { compact, formatNumber } from '@/lib/text';

type Mode = 'full' | 'assist' | 'outline';
interface Character { name: string; role: string; traits: string; goals: string }
interface PlanRow { title: string; synopsis: string }
interface Draft {
  title: string; subtitle: string; author_name: string; book_type: 'fiction' | 'nonfiction'; genre: string; niche: string;
  audience: string; reader_outcome: string;
  style: string; tone: string; dialect: string;
  key_message: string;
  summary: string; pov: string; pacing: string; themes: string[];
  characters: Character[];
  size: 'short' | 'standard' | 'full' | 'epic'; target_chapters: number; chapter_length: 'short' | 'standard' | 'long' | 'custom'; chapter_words: number;
  plan: PlanRow[];
  writing_mode: Mode;
}

const SIZES = {
  short: { label: 'Short', note: '10K–20K words', words: 15000 },
  standard: { label: 'Standard', note: '30K–60K words', words: 45000 },
  full: { label: 'Full', note: '60K–90K words', words: 75000 },
  epic: { label: 'Epic', note: '90K+ words', words: 100000 },
} as const;
const CH_LENGTHS = { short: 'Short (500–800 words)', standard: 'Standard (800–1,500 words)', long: 'Long (1,500–3,000 words)', custom: 'Custom' } as const;
const CH_WORDS = { short: 650, standard: 1200, long: 2300 } as const;

const EMPTY: Draft = {
  title: '', subtitle: '', author_name: '', book_type: 'nonfiction', genre: '', niche: '',
  audience: '', reader_outcome: '', style: '', tone: '', dialect: 'US English', key_message: '',
  summary: '', pov: '', pacing: '', themes: [], characters: [],
  size: 'standard', target_chapters: 12, chapter_length: 'standard', chapter_words: 1500, plan: [], writing_mode: 'assist',
};

const STEPS = ['Basics', 'For', 'Voice', 'Key message', 'Story architecture', 'Characters', 'Chapter plan', 'How to write'] as const;
const STORE_KEY = 'ap:new-book-draft';

function load(): { step: number; d: Draft } | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function persist(step: number, d: Draft) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ step, d }));
  } catch {}
}
function clear() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {}
}

export function NewBookForm({ defaultAuthor }: { defaultAuthor: string }) {
  const [path, setPath] = useState<'choose' | 'wizard' | 'upload'>('choose');
  const [resume, setResume] = useState<{ step: number; d: Draft } | null>(null);
  useEffect(() => {
    const saved = load();
    if (saved?.d?.title) setResume(saved);
  }, []);

  if (path === 'wizard') return <Wizard initial={resume} defaultAuthor={defaultAuthor} onExit={() => setPath('choose')} />;
  if (path === 'upload') return <Upload defaultAuthor={defaultAuthor} onBack={() => setPath('choose')} />;

  return (
    <div className="space-y-6">
      {resume && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gilt/40 bg-gilt-light px-4 py-3 text-[14px]">
          <span>You have an unfinished book setup{resume.d.title ? ` for “${resume.d.title}”` : ''}. Would you like to resume where you left off?</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setPath('wizard')}>Resume</Button>
            <Button size="sm" variant="secondary" onClick={() => { clear(); setResume(null); }}>Start fresh</Button>
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <button onClick={() => { if (resume) { clear(); setResume(null); } setPath('wizard'); }} className="panel flex flex-col items-start gap-3 p-6 text-left hover:border-cloth">
          <Wand2 className="h-6 w-6 text-cloth" />
          <span className="font-serif text-[1.3rem]">Start with the AI wizard</span>
          <span className="text-[14px] text-ink-muted">Answer a few questions and build your book with AI: who it’s for, your voice, characters and a chapter plan.</span>
        </button>
        <button onClick={() => setPath('upload')} className="panel flex flex-col items-start gap-3 p-6 text-left hover:border-cloth">
          <FileUp className="h-6 w-6 text-cloth" />
          <span className="font-serif text-[1.3rem]">Upload a manuscript</span>
          <span className="text-[14px] text-ink-muted">Already written something? Import a Word, PDF, text or Markdown file straight into the editor.</span>
        </button>
      </div>
    </div>
  );
}

function Upload({ defaultAuthor, onBack }: { defaultAuthor: string; onBack: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ title: '', author_name: defaultAuthor, book_type: 'nonfiction' as 'fiction' | 'nonfiction', genre: '' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast('Choose your manuscript file.', 'error');
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>('/api/books', { body: { ...f, target_words: 50000, target_chapters: 1 } });
      await importManuscript(id, file).catch((err) => toast(`Book created, but the import failed: ${errorText(err)}`, 'error'));
      router.push(`/dashboard/books/${id}/write`);
      router.refresh();
    } catch (err) {
      toast(errorText(err), 'error');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={go} className="space-y-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-[14px] text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Back</button>
      {busy ? (
        <div className="panel p-8 text-center">
          <p className="font-serif text-[1.3rem]">Importing your manuscript…</p>
          <p className="mt-2 text-ink-muted">Extracting the text and setting up your editor. This can take a few seconds.</p>
        </div>
      ) : (
        <>
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const x = e.dataTransfer.files?.[0]; if (x) { setFile(x); if (!f.title) setF({ ...f, title: x.name.replace(/\.[^.]+$/, '') }); } }}
            className={clsx('flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-10 text-center', drag ? 'border-cloth bg-cloth-light/50' : 'border-line-strong bg-sheet')}
          >
            <FileUp className="h-7 w-7 text-cloth" />
            <span className="font-medium">{file ? file.name : 'Drag and drop your manuscript'}</span>
            <span className="text-[13px] text-ink-muted">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · click to choose another` : 'or click to browse · Word (.docx), PDF, .txt or .md, up to 4 MB'}</span>
            <input type="file" accept=".docx,.pdf,.txt,.md" className="sr-only" onChange={(e) => { const x = e.target.files?.[0] ?? null; setFile(x); if (x && !f.title) setF({ ...f, title: x.name.replace(/\.[^.]+$/, '') }); }} />
          </label>
          <div className="panel grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Book title" htmlFor="ut"><input id="ut" className="field" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="Author name" htmlFor="ua" hint="Pen names are fine."><input id="ua" className="field" value={f.author_name} onChange={(e) => setF({ ...f, author_name: e.target.value })} /></Field>
            <Field label="Book type" htmlFor="uy">
              <select id="uy" className="field" value={f.book_type} onChange={(e) => setF({ ...f, book_type: e.target.value as 'fiction' | 'nonfiction', genre: '' })}>
                <option value="nonfiction">Non-fiction</option><option value="fiction">Fiction</option>
              </select>
            </Field>
            <Field label="Genre" htmlFor="ug">
              <select id="ug" className="field" required value={f.genre} onChange={(e) => setF({ ...f, genre: e.target.value })}>
                <option value="">Select a genre</option>
                {GENRES[f.book_type].map((g) => <option key={g}>{g}</option>)}
              </select>
            </Field>
          </div>
          <Button type="submit" disabled={!file}>Import and open the editor</Button>
        </>
      )}
    </form>
  );
}

function Wizard({ initial, defaultAuthor, onExit }: { initial: { step: number; d: Draft } | null; defaultAuthor: string; onExit: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(initial?.step ?? 0);
  const [d, setD] = useState<Draft>(initial?.d ?? { ...EMPTY, author_name: defaultAuthor });
  const [busy, setBusy] = useState('');
  const [tokensLeft, setTokensLeft] = useState<number | null>(null);
  const [themeInput, setThemeInput] = useState('');
  const fiction = d.book_type === 'fiction';
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => persist(step, d), [step, d]);
  useEffect(() => {
    api<{ data: { tokensRemaining: number } }>('/api/token-usage').then((r) => setTokensLeft(r.data.tokensRemaining)).catch(() => {});
  }, []);

  const targetWords = SIZES[d.size].words;
  const perChapter = d.chapter_length === 'custom' ? d.chapter_words : CH_WORDS[d.chapter_length];
  const estimate = useMemo(() => {
    const words = Math.max(targetWords, perChapter * d.target_chapters);
    const outline = 4000;
    if (d.writing_mode === 'full') return Math.round(words * 1.4 + d.target_chapters * 4500 + outline);
    if (d.writing_mode === 'assist') return Math.round(words * 0.85 + d.target_chapters * 4000 + outline);
    return Math.round(d.target_chapters * 2500 + outline);
  }, [d.writing_mode, d.target_chapters, targetWords, perChapter]);

  const canNext = step === 0 ? d.title.trim() && d.genre : true;

  // Keep the planned chapter rows in step with the chapter count.
  function setChapters(n: number) {
    const count = Math.max(3, Math.min(40, n || 3));
    setD((x) => ({ ...x, target_chapters: count, plan: x.plan.length ? Array.from({ length: count }, (_, i) => x.plan[i] ?? { title: '', synopsis: '' }) : [] }));
  }

  async function create() {
    setBusy('create');
    try {
      const plan = d.plan.filter((p) => p.title.trim() || p.synopsis.trim()).length ? d.plan : [];
      const body = {
        title: d.title, subtitle: d.subtitle, author_name: d.author_name, book_type: d.book_type,
        genre: d.genre, audience: d.audience, reader_outcome: d.reader_outcome,
        style: d.style, tone: d.tone, dialect: d.dialect, key_message: d.key_message,
        summary: d.summary, pov: fiction ? d.pov : '', pacing: d.pacing,
        themes: [...(d.niche.trim() ? [d.niche.trim()] : []), ...d.themes],
        characters: d.characters.filter((c) => c.name.trim()),
        target_words: Math.max(targetWords, 500), target_chapters: d.target_chapters,
        writing_mode: d.writing_mode, plan, chapter_length: d.chapter_length, chapter_words: d.chapter_length === 'custom' ? d.chapter_words : undefined,
      };
      const { id, planned } = await api<{ id: string; planned: number }>('/api/books', { body });
      if (!planned) {
        setBusy('outline');
        await api(`/api/books/${id}/outline`, { body: { chapter_length: d.chapter_length, chapter_words: d.chapter_length === 'custom' ? d.chapter_words : undefined } }).catch((err) =>
          toast(`Book created, but planning the chapters failed: ${errorText(err)}`, 'error'),
        );
      }
      clear();
      router.push(d.writing_mode === 'full' ? `/dashboard/books/${id}?autowrite=1` : `/dashboard/books/${id}/write`);
      router.refresh();
    } catch (err) {
      toast(errorText(err), 'error');
      setBusy('');
    }
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-1.5 text-[13px]" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              onClick={() => (i <= step || canNext ? setStep(i) : null)}
              aria-current={i === step ? 'step' : undefined}
              className={clsx('rounded-full border px-2.5 py-1', i === step ? 'border-cloth bg-cloth text-white' : i < step ? 'border-cloth/40 bg-cloth-light text-cloth-dark' : 'border-line bg-sheet text-ink-muted')}
            >
              {i + 1}. {s === 'Characters' && !fiction ? 'Key people' : s}
            </button>
          </li>
        ))}
      </ol>

      <section className="panel space-y-4 p-5">
        {step === 0 && (
          <>
            <h2>The basics</h2>
            <Field label="Title" htmlFor="w-title" hint="A working title is fine. You can change it later.">
              <input id="w-title" className="field" required value={d.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="Subtitle (optional, recommended for non-fiction)" htmlFor="w-sub"><input id="w-sub" className="field" value={d.subtitle} onChange={(e) => set('subtitle', e.target.value)} /></Field>
            <Field label="Author name" htmlFor="w-author" hint="Pen names are fine."><input id="w-author" className="field" value={d.author_name} onChange={(e) => set('author_name', e.target.value)} /></Field>
            <fieldset>
              <legend className="label">Type</legend>
              <div className="flex gap-2">
                {(['nonfiction', 'fiction'] as const).map((t) => (
                  <button type="button" key={t} className="chip" aria-pressed={d.book_type === t} onClick={() => setD((x) => ({ ...x, book_type: t, genre: '' }))}>{t === 'fiction' ? 'Fiction' : 'Non-fiction'}</button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Genre" htmlFor="w-genre">
                <select id="w-genre" className="field" value={d.genre} onChange={(e) => set('genre', e.target.value)}>
                  <option value="">Select a genre</option>
                  {GENRES[d.book_type].map((g) => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Niche (optional)" htmlFor="w-niche"><input id="w-niche" className="field" placeholder={fiction ? 'e.g. Space opera' : 'e.g. Personal finance'} value={d.niche} onChange={(e) => set('niche', e.target.value)} /></Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2>Who is it for?</h2>
            <Field label="Target readers" htmlFor="w-aud"><input id="w-aud" className="field" placeholder="e.g. Football fans aged 16+, first-time managers" value={d.audience} onChange={(e) => set('audience', e.target.value)} /></Field>
            <Field label={fiction ? 'What should readers feel or take away?' : 'What will readers gain or be able to do after reading this book?'} htmlFor="w-out">
              <textarea id="w-out" className="field min-h-[110px]" value={d.reader_outcome} onChange={(e) => set('reader_outcome', e.target.value)} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Your voice</h2>
            <Field label="Writing style" htmlFor="w-style">
              <select id="w-style" className="field" value={WRITING_STYLES.includes(d.style) ? d.style : d.style ? '__custom' : ''} onChange={(e) => set('style', e.target.value === '__custom' ? ' ' : e.target.value)}>
                <option value="">Select a writing style</option>
                {WRITING_STYLES.map((s) => <option key={s}>{s}</option>)}
                <option value="__custom">Something else…</option>
              </select>
            </Field>
            {d.style && !WRITING_STYLES.includes(d.style) && (
              <Field label="Describe your style" htmlFor="w-style2"><input id="w-style2" className="field" value={d.style.trim()} onChange={(e) => set('style', e.target.value || ' ')} /></Field>
            )}
            <Field label="Tone" htmlFor="w-tone"><input id="w-tone" className="field" placeholder="e.g. Warm, inspirational, a little funny" value={d.tone} onChange={(e) => set('tone', e.target.value)} /></Field>
            <Field label="Spelling" htmlFor="w-dia" hint="Used for spelling and word choice throughout, and for proofreading.">
              <select id="w-dia" className="field" value={d.dialect} onChange={(e) => set('dialect', e.target.value)}>
                {DIALECTS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Key message</h2>
            <Field label="What’s the ONE thing you want readers to remember?" htmlFor="w-key" hint="Optional, but it gives every chapter a clear thread.">
              <textarea id="w-key" className="field min-h-[100px]" value={d.key_message} onChange={(e) => set('key_message', e.target.value)} />
            </Field>
          </>
        )}

        {step === 4 && (
          <>
            <h2>{fiction ? 'Story architecture' : 'Book structure'}</h2>
            <Field label={fiction ? 'Summary or core premise' : 'What the book covers'} htmlFor="w-sum" hint={fiction ? 'The beginning, major twists and the intended ending. Rough notes are fine.' : 'The main argument or journey, and what each part covers. Rough notes are fine.'}>
              <textarea id="w-sum" className="field min-h-[160px]" value={d.summary} onChange={(e) => set('summary', e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {fiction && (
                <Field label="Point of view" htmlFor="w-pov">
                  <select id="w-pov" className="field" value={d.pov} onChange={(e) => set('pov', e.target.value)}>
                    <option value="">Select a POV</option>
                    {POVS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Pacing" htmlFor="w-pace">
                <select id="w-pace" className="field" value={d.pacing} onChange={(e) => set('pacing', e.target.value)}>
                  <option value="">Select a pacing style</option>
                  {PACING.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
            </div>
            <div>
              <label htmlFor="w-theme" className="label">Themes and keywords (press Enter to add)</label>
              <div className="flex flex-wrap items-center gap-1.5 rounded border border-line bg-sheet p-2">
                {d.themes.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-cloth-light px-2.5 py-0.5 text-[13px] text-cloth-dark">
                    {t}
                    <button type="button" aria-label={`Remove ${t}`} onClick={() => set('themes', d.themes.filter((x) => x !== t))}>×</button>
                  </span>
                ))}
                <input
                  id="w-theme"
                  className="min-w-[160px] flex-1 bg-transparent px-1 py-1 text-[14px] outline-none"
                  placeholder={fiction ? 'e.g. Redemption, Noir' : 'e.g. Resilience, Micro-investing'}
                  value={themeInput}
                  onChange={(e) => setThemeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ',') && themeInput.trim()) {
                      e.preventDefault();
                      if (!d.themes.includes(themeInput.trim()) && d.themes.length < 20) set('themes', [...d.themes, themeInput.trim()]);
                      setThemeInput('');
                    }
                  }}
                />
              </div>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h2>{fiction ? 'Characters and world-building' : 'Key people'}</h2>
            <p className="text-[14px] text-ink-muted">
              {fiction ? 'Add your main characters. They go into the story bible, so the AI keeps them consistent.' : 'Add the real people your book is about or features. They go into the story bible, so names and facts stay consistent.'}
            </p>
            {!d.characters.length && <p className="text-[14px] text-ink-faint">No {fiction ? 'characters' : 'people'} added yet.</p>}
            <ul className="space-y-3">
              {d.characters.map((c, i) => (
                <li key={i} className="grid gap-2 rounded border border-line p-3 sm:grid-cols-2">
                  <Field label="Name" htmlFor={`c-n-${i}`}><input id={`c-n-${i}`} className="field" value={c.name} onChange={(e) => set('characters', d.characters.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></Field>
                  <Field label="Role" htmlFor={`c-r-${i}`}><input id={`c-r-${i}`} className="field" placeholder={fiction ? 'e.g. Protagonist, antagonist' : 'e.g. Subject, mentor, coach'} value={c.role} onChange={(e) => set('characters', d.characters.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} /></Field>
                  <Field label={fiction ? 'Flaws and traits' : 'Key facts'} htmlFor={`c-t-${i}`}><input id={`c-t-${i}`} className="field" placeholder={fiction ? 'e.g. Stubborn, fiercely loyal' : 'e.g. Born 1992, plays for Santos'} value={c.traits} onChange={(e) => set('characters', d.characters.map((x, j) => (j === i ? { ...x, traits: e.target.value } : x)))} /></Field>
                  <Field label={fiction ? 'Goals' : 'Why they matter'} htmlFor={`c-g-${i}`}><input id={`c-g-${i}`} className="field" placeholder={fiction ? 'What does this character want?' : 'Their part in the story'} value={c.goals} onChange={(e) => set('characters', d.characters.map((x, j) => (j === i ? { ...x, goals: e.target.value } : x)))} /></Field>
                  <button type="button" className="flex items-center gap-1 text-[13px] text-danger sm:col-span-2" onClick={() => set('characters', d.characters.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" />Remove</button>
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" onClick={() => set('characters', [...d.characters, { name: '', role: '', traits: '', goals: '' }])}><Plus className="h-4 w-4" />Add {fiction ? 'a character' : 'a person'}</Button>
          </>
        )}

        {step === 6 && (
          <>
            <h2>Chapter plan</h2>
            <fieldset>
              <legend className="label">Book length</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((k) => (
                  <button key={k} type="button" aria-pressed={d.size === k} onClick={() => set('size', k)} className="rounded border border-line bg-sheet p-3 text-left aria-pressed:border-cloth aria-pressed:bg-cloth-light">
                    <span className="block font-medium">{SIZES[k].label}</span>
                    <span className="text-[12px] text-ink-muted">{SIZES[k].note}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Number of chapters (3–40)" htmlFor="w-ch"><input id="w-ch" type="number" min={3} max={40} className="field" value={d.target_chapters} onChange={(e) => setChapters(Number(e.target.value))} /></Field>
              <Field label="Target chapter length" htmlFor="w-cl">
                <select id="w-cl" className="field" value={d.chapter_length} onChange={(e) => set('chapter_length', e.target.value as Draft['chapter_length'])}>
                  {Object.entries(CH_LENGTHS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </Field>
              {d.chapter_length === 'custom' && (
                <Field label="Words per chapter" htmlFor="w-cw"><input id="w-cw" type="number" min={200} max={15000} step={100} className="field" value={d.chapter_words} onChange={(e) => set('chapter_words', Number(e.target.value))} /></Field>
              )}
            </div>
            <div className="rounded-md bg-ground p-3 text-[14px]">
              {d.plan.length ? (
                <div className="space-y-3">
                  <p className="text-ink-muted">Fill in as many as you like. Empty chapters are planned by AI from your answers.</p>
                  {d.plan.map((c, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[180px_1fr]">
                      <input aria-label={`Chapter ${i + 1} title`} className="field" placeholder={`Chapter ${i + 1}`} value={c.title} onChange={(e) => set('plan', d.plan.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                      <input aria-label={`Chapter ${i + 1} summary`} className="field" placeholder="What happens in this chapter?" value={c.synopsis} onChange={(e) => set('plan', d.plan.map((x, j) => (j === i ? { ...x, synopsis: e.target.value } : x)))} />
                    </div>
                  ))}
                  <button type="button" className="text-[13px] text-ink-muted underline" onClick={() => set('plan', [])}>Let AI plan all chapters instead</button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-ink-muted">Optional: plan individual chapters now, or skip and let the AI outline them for you.</span>
                  <Button size="sm" variant="secondary" onClick={() => set('plan', Array.from({ length: d.target_chapters }, () => ({ title: '', synopsis: '' })))}>Plan chapters myself</Button>
                </div>
              )}
            </div>
          </>
        )}

        {step === 7 && (
          <>
            <h2>How do you want to write?</h2>
            <div className="grid gap-3">
              {([
                ['full', 'Write it all with AI', 'AI writes your complete manuscript, chapter by chapter. You review and refine.', 'Best for: getting a full first draft fast'],
                ['assist', 'AI helps me write', 'AI drafts each chapter with gaps for your own stories and details, then suggests, expands and improves as you write.', 'Best for: memoir, expertise books, your own voice'],
                ['outline', 'AI outlines, I write', 'AI creates your chapter structure and a detailed plan for each chapter. You write the text.', 'Best for: writers who want structure, not prose'],
              ] as const).map(([k, title, text, best]) => (
                <label key={k} className={clsx('flex cursor-pointer gap-3 rounded border p-4', d.writing_mode === k ? 'border-cloth bg-cloth-light/60' : 'border-line bg-sheet')}>
                  <input type="radio" name="wm" className="mt-1 accent-cloth" checked={d.writing_mode === k} onChange={() => set('writing_mode', k)} />
                  <span>
                    <span className="block font-medium">{title}</span>
                    <span className="block text-[14px] text-ink-muted">{text}</span>
                    <span className="mt-1 block text-[12px] text-gilt">{best}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="rounded-md bg-ground p-3 text-[14px]">
              <p>
                Estimated AI tokens: <strong>about {compact(estimate)}</strong>
                {tokensLeft !== null && <> · you have {formatNumber(tokensLeft)} left this month</>}
              </p>
              {tokensLeft !== null && estimate > tokensLeft && (
                <p className="mt-1 text-danger">That’s more than you have left this month. The book will be written as far as your tokens allow; you can continue after they reset or after upgrading.</p>
              )}
            </div>
          </>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => (step ? setStep(step - 1) : onExit())} disabled={!!busy}><ArrowLeft className="h-4 w-4" />Back</Button>
          {step === 5 || step === 6 ? <Button variant="ghost" onClick={() => setStep(step + 1)} disabled={!!busy}>Skip this step</Button> : null}
        </div>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext}>Next<ArrowRight className="h-4 w-4" /></Button>
        ) : (
          <Button onClick={create} loading={!!busy}>
            <Sparkles className="h-4 w-4" />
            {busy === 'outline' ? 'Planning your chapters… about a minute' : busy ? 'Creating your book…' : 'Create my book'}
          </Button>
        )}
      </div>
      {!canNext && step === 0 && <p className="text-right text-[13px] text-ink-muted">Add a title and choose a genre to continue.</p>}
      <p className="text-[12px] text-ink-faint">Your answers are saved in this browser as you go, so you can come back to them.</p>
    </div>
  );
}
