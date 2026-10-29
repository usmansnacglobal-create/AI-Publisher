'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { ArrowLeft, ArrowRight, Check, Circle, Copy, Sparkles, X } from 'lucide-react';
import type { Book } from '@/lib/api';
import { api, errorText } from '@/lib/client';
import { BISAC, EDITIONS, LANGUAGES, PLATFORMS, ebookRoyalty, minPrintPrice, printCost, printRoyalty, type PlatformId, suggestedPrintPrice } from '@/lib/publishing';
import { normaliseLayout } from '@/lib/layout';
import { TRIM_SIZES } from '@/lib/spine';
import { Badge, Button, Field, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';

type CheckItem = { id: string; label: string; ok: boolean; fix: string; link: string };
type Submission = {
  id: string; status: string; platforms: string[]; formats: string[]; price: number; print_price: number | null; hardcover_price?: number | null; isbn: string | null; reviewer_notes: string;
  history: { status: string; at: string; note?: string }[]; created_at: string; publish_at: string | null; language: string; edition: string; category: string;
};
type Format = 'ebook' | 'paperback' | 'hardcover' | 'audiobook';

const STEPS = ['Checklist', 'Formats', 'Platforms', 'Details', 'Review'] as const;
const STAGES = [
  ['submitted', 'Book submitted for review'],
  ['in_review', 'Internal review'],
  ['formatting', 'Prepared for the stores'],
  ['publishing', 'Publishing to stores'],
  ['live', 'Live on all selected stores'],
] as const;
const FORMAT_INFO: Record<Format, { label: string; note: string }> = {
  ebook: { label: 'Ebook (EPUB and Kindle)', note: 'Digital edition for Kindle, Apple Books, Kobo and all e-readers' },
  paperback: { label: 'Paperback (print on demand)', note: 'A paperback printed and shipped as each copy is ordered' },
  hardcover: { label: 'Hardcover (print on demand)', note: 'A case-laminate hardcover, printed as each copy is ordered' },
  audiobook: { label: 'Audiobook', note: 'Your AI-narrated audiobook from the Audiobook tab' },
};

interface Draft {
  formats: Format[];
  platforms: PlatformId[];
  blurb: string;
  keywords: string[];
  category: string;
  categories: string[];
  language: string;
  edition: string;
  price: number;
  print_price: number;
  hardcover_price: number;
  when: 'now' | 'later';
  date: string;
}

const key = (id: string) => `ap:publish:${id}`;

export function Publish({ book, voice }: { book: Book; voice: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const pages = book.page_count ?? 0;
  const ink = normaliseLayout(book.layout).ink;
  const spec = { trim: book.trim_size, ink };
  const hcSpec = { ...spec, binding: 'hardcover' as const };
  const hardcoverOk = !!TRIM_SIZES[book.trim_size]?.hardcover && ink !== 'standard';
  const initial: Draft = {
    formats: ['ebook', 'paperback'],
    platforms: ['amazon_kdp', 'amazon_kdp_print'],
    blurb: book.blurb,
    keywords: book.keywords ?? [],
    category: '',
    categories: book.categories ?? [],
    language: book.language || 'English',
    edition: book.edition || 'First Edition',
    price: 4.99,
    print_price: suggestedPrintPrice(pages, spec),
    hardcover_price: suggestedPrintPrice(pages, hcSpec),
    when: 'now',
    date: '',
  };
  const [d, setD] = useState<Draft>(initial);
  const [step, setStep] = useState(0);
  const [resume, setResume] = useState<{ step: number; d: Draft } | null>(null);
  const [checks, setChecks] = useState<CheckItem[] | null>(null);
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [busy, setBusy] = useState('');
  const [extra, setExtra] = useState<{ tagline?: string; social_posts?: string[] }>({});
  const [kw, setKw] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(book.id));
      if (raw) setResume(JSON.parse(raw));
    } catch {}
  }, [book.id]);
  useEffect(() => {
    if (step === 0 && JSON.stringify(d) === JSON.stringify(initial)) return;
    try {
      localStorage.setItem(key(book.id), JSON.stringify({ step, d }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, d, book.id]);

  const refresh = useCallback(async () => {
    const r = await api<{ checks: CheckItem[]; submissions: Submission[] }>(`/api/books/${book.id}/submit?formats=${d.formats.join(',')}`);
    setChecks(r.checks);
    setSubs(r.submissions);
  }, [book.id, d.formats]);
  useEffect(() => { refresh().catch(() => setSubs([])); }, [refresh]);

  function toggleFormat(f: Format) {
    const formats = d.formats.includes(f) ? d.formats.filter((x) => x !== f) : [...d.formats, f];
    const platforms = d.platforms.filter((p) => (PLATFORMS[p].formats as readonly string[]).some((x) => formats.includes(x as Format)));
    setD((x) => ({ ...x, formats, platforms }));
  }
  const available = (Object.keys(PLATFORMS) as PlatformId[]).filter((p) => (PLATFORMS[p].formats as readonly string[]).some((x) => d.formats.includes(x as Format)));

  async function generate() {
    setBusy('gen');
    try {
      const r = await api<{ blurb: string; keywords: string[]; categories: string[]; tagline: string; social_posts: string[] }>(`/api/books/${book.id}/publishing-kit`, {
        body: { fields: ['blurb', 'keywords', 'categories', 'tagline', 'social_posts'] },
      });
      setD((x) => ({ ...x, blurb: r.blurb, keywords: r.keywords.slice(0, 7), categories: r.categories }));
      setExtra({ tagline: r.tagline, social_posts: r.social_posts });
      toast('Description, keywords and categories written');
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  async function submit() {
    setBusy('submit');
    try {
      await api(`/api/books/${book.id}`, { method: 'PATCH', body: { blurb: d.blurb, keywords: d.keywords, categories: d.categories.length ? d.categories : d.category ? [d.category] : [], language: d.language, edition: d.edition } });
      await api(`/api/books/${book.id}/submit`, {
        body: {
          formats: d.formats,
          platforms: d.platforms,
          price: d.price,
          print_price: d.formats.includes('paperback') ? d.print_price : undefined,
          hardcover_price: d.formats.includes('hardcover') ? d.hardcover_price : undefined,
          language: d.language,
          edition: d.edition,
          category: d.category,
          publish_at: d.when === 'later' && d.date ? new Date(d.date).toISOString() : null,
          narration_voice: d.formats.includes('audiobook') ? voice ?? undefined : undefined,
        },
      });
      try { localStorage.removeItem(key(book.id)); } catch {}
      toast('Book submitted. We’ll keep you posted at every step.');
      setStep(0);
      await refresh();
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  if (!subs) return <p className="text-ink-muted">Loading…</p>;
  const active = subs.find((s) => !['live', 'changes_requested', 'rejected'].includes(s.status));
  const latest = subs[0];
  // The description and keywords are written in the Details step, so they don't block the checklist.
  const LATER = ['blurb', 'keywords'];
  const ready = checks?.filter((c) => !LATER.includes(c.id)).every((c) => c.ok);
  const minPrint = minPrintPrice(pages, spec);
  const minHard = minPrintPrice(pages, hcSpec);
  const descLen = d.blurb.trim().length;
  const stepOk = [
    !!ready,
    d.formats.length > 0,
    d.platforms.length > 0,
    descLen >= 100 && descLen <= 4000 && !!d.category && d.keywords.length > 0 && d.price >= 0.99 && (!d.formats.includes('paperback') || d.print_price >= minPrint) && (!d.formats.includes('hardcover') || d.hardcover_price >= minHard) && (d.when === 'now' || !!d.date),
    true,
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <section>
        <PageHeader title="Publish your book" />

        {active ? (
          <p className="panel p-4 text-[14px]">This book is with our publishing team. Follow its progress on the right.</p>
        ) : (
          <>
            {resume && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gilt/40 bg-gilt-light px-4 py-3 text-[14px]">
                <span>You have an unfinished publishing setup for this book.</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { setD({ ...initial, ...resume.d }); setStep(resume.step); setResume(null); }}>Resume</Button>
                  <Button size="sm" variant="secondary" onClick={() => { try { localStorage.removeItem(key(book.id)); } catch {} setResume(null); }}>Start over</Button>
                </div>
              </div>
            )}
            {latest?.status === 'changes_requested' && (
              <div className="mb-4 rounded-md border border-gilt/40 bg-gilt-light p-4 text-[14px]">
                <p className="font-medium">Changes required before publishing</p>
                {latest.reviewer_notes && <p className="mt-1 whitespace-pre-wrap"><span className="font-medium">Note from our team:</span> {latest.reviewer_notes}</p>}
                <p className="mt-1 text-ink-muted">Please make the changes, then submit your book again.</p>
              </div>
            )}
            {latest?.status === 'rejected' && (
              <div className="mb-4 rounded-md border border-danger/30 bg-danger-light p-4 text-[14px]">
                <p className="font-medium">Submission not approved</p>
                {latest.reviewer_notes && <p className="mt-1 whitespace-pre-wrap">{latest.reviewer_notes}</p>}
              </div>
            )}

            <ol className="mb-6 flex flex-wrap gap-1.5 text-[13px]">
              {STEPS.map((s, i) => (
                <li key={s}>
                  <button
                    onClick={() => (i <= step || stepOk.slice(0, i).every(Boolean) ? setStep(i) : null)}
                    aria-current={i === step ? 'step' : undefined}
                    className={clsx('rounded-full border px-3 py-1', i === step ? 'border-cloth bg-cloth text-white' : i < step ? 'border-cloth/40 bg-cloth-light text-cloth-dark' : 'border-line bg-sheet text-ink-muted')}
                  >
                    {i + 1}. {s}
                  </button>
                </li>
              ))}
            </ol>

            <div className="panel space-y-4 p-5">
              {step === 0 && (
                <>
                  <h2>Is your book ready to publish?</h2>
                  <p className="text-[14px] text-ink-muted">Complete every item before submitting your book for review. The list depends on the formats you choose in the next step.</p>
                  {checks ? (
                    <ul className="space-y-2 text-[14px]">
                      {checks.map((c) => (
                        <li key={c.id} className="flex items-start gap-2">
                          {c.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-cloth" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gilt" />}
                          <span className="flex-1">{c.label}{!c.ok && <span className="block text-ink-muted">{LATER.includes(c.id) ? 'You’ll do this in step 4, Details. The AI can write it for you.' : c.fix}</span>}</span>
                          {!c.ok && !LATER.includes(c.id) && <Link href={c.link} className="shrink-0 text-cloth underline">Fix now</Link>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-ink-muted">Checking…</p>
                  )}
                  {ready && <p className="rounded bg-cloth-light px-3 py-2 text-[14px] text-cloth-dark">Checklist complete. Your book is ready to publish.</p>}
                </>
              )}

              {step === 1 && (
                <>
                  <h2>Choose your formats</h2>
                  <p className="text-[14px] text-ink-muted">Publish in as many formats as you like.</p>
                  <div className="grid gap-2">
                    {(Object.keys(FORMAT_INFO) as Format[]).map((f) => {
                      const off = f === 'hardcover' && !hardcoverOk;
                      return (
                        <label key={f} className={clsx('flex gap-3 rounded border p-3', off ? 'cursor-not-allowed opacity-60' : 'cursor-pointer', d.formats.includes(f) ? 'border-cloth bg-cloth-light/60' : 'border-line')}>
                          <input type="checkbox" className="mt-1 accent-cloth" disabled={off} checked={d.formats.includes(f)} onChange={() => toggleFormat(f)} />
                          <span>
                            <span className="block font-medium">{FORMAT_INFO[f].label}</span>
                            <span className="text-[13px] text-ink-muted">
                              {off
                                ? ink === 'standard'
                                  ? 'Hardcovers aren’t available with standard colour. Choose black and white or premium colour on the Layout tab.'
                                  : `Hardcovers come in 5.5″ × 8.5″, 6″ × 9″, 6.14″ × 9.21″, 7″ × 10″ and 8.25″ × 11″. Change the trim size on the Layout tab to offer one.`
                                : FORMAT_INFO[f].note}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {d.formats.includes('audiobook') && (
                    <p className="text-[14px]">
                      Narration voice: <strong>{voice ?? 'not chosen yet'}</strong>. <Link href={`/dashboard/books/${book.id}/audiobook`} className="text-cloth underline">Change on the Audiobook tab</Link>
                    </p>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2>Choose your stores</h2>
                    <Button size="sm" variant="ghost" onClick={() => set('platforms', available)}>Select all available</Button>
                  </div>
                  {(['ebook', 'paperback', 'hardcover', 'audiobook'] as Format[]).filter((f) => d.formats.includes(f)).map((f) => (
                    <fieldset key={f}>
                      <legend className="label">{FORMAT_INFO[f].label}</legend>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {available.filter((p) => (PLATFORMS[p].formats as readonly string[]).includes(f)).map((p) => (
                          <label key={p} className="flex items-center gap-2 text-[14px]">
                            <input type="checkbox" className="accent-cloth" checked={d.platforms.includes(p)} onChange={(e) => set('platforms', e.target.checked ? [...d.platforms, p] : d.platforms.filter((x) => x !== p))} />
                            {PLATFORMS[p].label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </>
              )}

              {step === 3 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2>Final details</h2>
                      <p className="text-[14px] text-ink-muted">This appears on your book’s page in every store.</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={generate} loading={busy === 'gen'}><Sparkles className="h-4 w-4" />Write description and keywords with AI</Button>
                  </div>
                  <Field label="Book description" htmlFor="desc" hint={`${descLen} characters. What readers see on Amazon and other stores: 100–4,000 characters.`} error={descLen > 4000 ? 'That’s over 4,000 characters.' : undefined}>
                    <textarea id="desc" className="field min-h-[180px]" placeholder="Write a description that hooks readers in the first line…" value={d.blurb} onChange={(e) => set('blurb', e.target.value)} />
                  </Field>
                  <div>
                    <label htmlFor="kw" className="label">Keywords ({d.keywords.length} of 7)</label>
                    <div className="flex flex-wrap items-center gap-1.5 rounded border border-line bg-sheet p-2">
                      {d.keywords.map((k) => (
                        <span key={k} className="inline-flex items-center gap-1 rounded-full bg-cloth-light px-2.5 py-0.5 text-[13px] text-cloth-dark">
                          {k}<button type="button" aria-label={`Remove ${k}`} onClick={() => set('keywords', d.keywords.filter((x) => x !== k))}><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                      {d.keywords.length < 7 && (
                        <input
                          id="kw"
                          className="min-w-[180px] flex-1 bg-transparent px-1 py-1 text-[14px] outline-none"
                          placeholder="Add a keyword and press Enter"
                          maxLength={50}
                          value={kw}
                          onChange={(e) => setKw(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && kw.trim()) {
                              e.preventDefault();
                              if (!d.keywords.includes(kw.trim())) set('keywords', [...d.keywords, kw.trim()]);
                              setKw('');
                            }
                          }}
                        />
                      )}
                    </div>
                    <p className="hint">Help readers find your book. Amazon allows up to 7.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Category" htmlFor="cat">
                      <select id="cat" className="field" value={d.category} onChange={(e) => set('category', e.target.value)}>
                        <option value="">Select a category</option>
                        {BISAC.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Language" htmlFor="lang">
                      <select id="lang" className="field" value={d.language} onChange={(e) => set('language', e.target.value)}>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select>
                    </Field>
                    <Field label="Edition" htmlFor="ed">
                      <select id="ed" className="field" value={d.edition} onChange={(e) => set('edition', e.target.value)}>{EDITIONS.map((l) => <option key={l}>{l}</option>)}</select>
                    </Field>
                  </div>
                  {d.categories.length > 0 && (
                    <p className="text-[13px] text-ink-muted">More specific categories (from AI): {d.categories.join(' · ')}</p>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(d.formats.includes('ebook') || d.formats.includes('audiobook')) && (
                      <Field label="Ebook price (USD)" htmlFor="ep" hint={`Min $0.99. You’d earn about $${ebookRoyalty(d.price).toFixed(2)} per Kindle sale${d.price >= 2.99 && d.price <= 9.99 ? ' (70% royalty)' : ' (35% royalty: $2.99–$9.99 earns 70%)'}.`}>
                        <input id="ep" type="number" min={0.99} step={0.01} className="field" value={d.price} onChange={(e) => set('price', Number(e.target.value))} />
                      </Field>
                    )}
                    {d.formats.includes('paperback') && (
                      <Field
                        label="Paperback price (USD)"
                        htmlFor="pp"
                        hint={`Min $${minPrint.toFixed(2)}. Printing costs about $${printCost(pages, spec).toFixed(2)}${pages ? '' : ' (estimated)'}; you’d earn about $${Math.max(0, printRoyalty(d.print_price, pages, spec)).toFixed(2)} per Amazon sale (${d.print_price >= 9.99 ? '60%' : '50%'} royalty${d.print_price >= 9.99 ? '' : '; $9.99 and up earns 60%'}).`}
                        error={d.print_price < minPrint ? `Set at least $${minPrint.toFixed(2)} to cover printing.` : undefined}
                      >
                        <input id="pp" type="number" min={minPrint} step={0.01} className="field" value={d.print_price} onChange={(e) => set('print_price', Number(e.target.value))} />
                      </Field>
                    )}
                    {d.formats.includes('hardcover') && (
                      <Field
                        label="Hardcover price (USD)"
                        htmlFor="hp"
                        hint={`Min $${minHard.toFixed(2)}. Printing costs about $${printCost(pages, hcSpec).toFixed(2)}${pages ? '' : ' (estimated)'}; you’d earn about $${Math.max(0, printRoyalty(d.hardcover_price, pages, hcSpec)).toFixed(2)} per Amazon sale.`}
                        error={d.hardcover_price < minHard ? `Set at least $${minHard.toFixed(2)} to cover printing.` : undefined}
                      >
                        <input id="hp" type="number" min={minHard} step={0.01} className="field" value={d.hardcover_price} onChange={(e) => set('hardcover_price', Number(e.target.value))} />
                      </Field>
                    )}
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="label">Publishing date</legend>
                    <label className="flex items-center gap-2 text-[14px]"><input type="radio" name="when" className="accent-cloth" checked={d.when === 'now'} onChange={() => set('when', 'now')} />Publish as soon as it’s approved</label>
                    <label className="flex items-center gap-2 text-[14px]"><input type="radio" name="when" className="accent-cloth" checked={d.when === 'later'} onChange={() => set('when', 'later')} />Schedule for later</label>
                    {d.when === 'later' && <input type="date" aria-label="Publishing date" className="field w-auto" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} value={d.date} onChange={(e) => set('date', e.target.value)} />}
                  </fieldset>
                </>
              )}

              {step === 4 && (
                <>
                  <h2>Everything look right?</h2>
                  <p className="text-[14px] text-ink-muted">Check your details before sending your book for review.</p>
                  <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[160px_1fr]">
                    <dt className="text-ink-muted">Formats</dt><dd>{d.formats.map((f) => FORMAT_INFO[f].label).join(', ')}</dd>
                    <dt className="text-ink-muted">Stores</dt><dd>{d.platforms.map((p) => PLATFORMS[p].label.split(' (')[0]).join(', ')}</dd>
                    <dt className="text-ink-muted">Price</dt><dd>Ebook ${d.price.toFixed(2)}{d.formats.includes('paperback') && ` · Paperback $${d.print_price.toFixed(2)}`}{d.formats.includes('hardcover') && ` · Hardcover $${d.hardcover_price.toFixed(2)}`}</dd>
                    <dt className="text-ink-muted">Category</dt><dd>{d.category}</dd>
                    <dt className="text-ink-muted">Keywords</dt><dd>{d.keywords.join(', ')}</dd>
                    <dt className="text-ink-muted">Language and edition</dt><dd>{d.language}, {d.edition}</dd>
                    <dt className="text-ink-muted">Publishing</dt><dd>{d.when === 'later' && d.date ? new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'As soon as it’s approved'}</dd>
                    {d.formats.includes('audiobook') && <><dt className="text-ink-muted">Narration</dt><dd>{voice ?? '—'}</dd></>}
                    <dt className="text-ink-muted">Description</dt><dd className="whitespace-pre-wrap">{d.blurb}</dd>
                  </dl>
                  {!ready && <p className="text-[14px] text-danger">Some checklist items are still open. Go back to step 1 to finish them.</p>}
                </>
              )}
            </div>

            <div className="mt-4 flex justify-between">
              <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={step === 0}><ArrowLeft className="h-4 w-4" />Back</Button>
              {step < 4 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!stepOk[step]}>Continue to {STEPS[step + 1].toLowerCase()}<ArrowRight className="h-4 w-4" /></Button>
              ) : (
                <Button onClick={submit} loading={busy === 'submit'} disabled={!stepOk.every(Boolean)}>Submit for review</Button>
              )}
            </div>
          </>
        )}

        {(extra.tagline || extra.social_posts?.length) && (
          <div className="mt-8 space-y-3">
            <h2>Launch posts</h2>
            {extra.tagline && <p className="font-serif text-[1.2rem] italic">{extra.tagline}</p>}
            <ul className="space-y-2">
              {extra.social_posts?.map((p, i) => (
                <li key={i} className="panel flex gap-3 p-3 text-[14px]">
                  <p className="flex-1 whitespace-pre-wrap">{p}</p>
                  <button className="h-fit rounded p-1.5 text-ink-muted hover:bg-ink/5" aria-label="Copy post" onClick={() => navigator.clipboard.writeText(p).then(() => toast('Copied'))}><Copy className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <aside>
        {latest ? (
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3>Publishing status</h3>
              <Badge tone={latest.status === 'live' ? 'cloth' : ['rejected', 'failed', 'changes_requested'].includes(latest.status) ? 'danger' : 'gilt'}>
                {{ submitted: 'Submitted', in_review: 'In review', changes_requested: 'Changes requested', formatting: 'Formatting', publishing: 'Publishing', live: 'Live', rejected: 'Not approved', failed: 'Problem at the stores' }[latest.status] ?? latest.status}
              </Badge>
            </div>
            <ol className="space-y-3">
              {STAGES.map(([k, label]) => {
                const h = [...latest.history].reverse().find((x) => x.status === k);
                return (
                  <li key={k} className="flex gap-3 text-[14px]">
                    {h ? <Check className="mt-0.5 h-4 w-4 text-cloth" /> : <Circle className="mt-0.5 h-4 w-4 text-line-strong" />}
                    <div>
                      <p className={clsx(!h && 'text-ink-muted')}>{label}</p>
                      {h && <p className="text-[12px] text-ink-muted">{new Date(h.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                      {h?.note && <p className="mt-0.5 text-[12px] text-ink-soft">{h.note}</p>}
                    </div>
                  </li>
                );
              })}
              {latest.isbn && (
                <li className="flex gap-3 text-[14px]"><Check className="mt-0.5 h-4 w-4 text-cloth" /><div><p>ISBN registered</p><p className="text-[12px] text-ink-muted">{latest.isbn}</p></div></li>
              )}
            </ol>
            {latest.status === 'failed' && latest.reviewer_notes && <p className="mt-3 rounded bg-danger-light p-2 text-[13px]">{latest.reviewer_notes}</p>}
            <p className="mt-3 text-[13px] text-ink-muted">
              {latest.formats.join(', ')} · {latest.platforms.map((p) => PLATFORMS[p as PlatformId]?.label.split(' (')[0] ?? p).join(', ')}
              {latest.publish_at && ` · scheduled for ${new Date(latest.publish_at).toLocaleDateString('en-GB')}`}
            </p>
            {latest.status === 'live' && (
              <a className="mt-3 inline-block text-[14px] text-cloth underline" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`My book “${book.title}” is out now!`)}`}>Share on X (Twitter)</a>
            )}
          </div>
        ) : (
          <div className="panel p-4 text-[14px] text-ink-muted">Once you submit, you can follow your book here: review, preparation for the stores and going live.</div>
        )}
      </aside>
    </div>
  );
}
