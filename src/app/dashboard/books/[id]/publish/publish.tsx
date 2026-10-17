'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Check, Circle, Copy, Sparkles } from 'lucide-react';
import type { Book } from '@/lib/api';
import { api, errorText } from '@/lib/client';
import { Badge, Button, Field, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';

type CheckItem = { id: string; label: string; ok: boolean; fix: string; link: string };
type Submission = { id: string; status: string; platforms: string[]; formats: string[]; price: number; isbn: string | null; reviewer_notes: string; history: { status: string; at: string; note?: string }[]; created_at: string };

const STORES: Record<string, string> = { amazon_kdp: 'Amazon Kindle and paperback', apple_books: 'Apple Books', kobo: 'Kobo', barnes_noble: 'Barnes & Noble', google_play: 'Google Play Books', ingramspark: 'IngramSpark (bookshops and libraries)' };
const STAGES = [
  ['submitted', 'Submitted'],
  ['in_review', 'Reviewed by our team'],
  ['formatting', 'Prepared for the stores'],
  ['publishing', 'Sent to the stores'],
  ['live', 'Live'],
] as const;

export function Publish({ book }: { book: Book }) {
  const router = useRouter();
  const toast = useToast();
  const [kit, setKit] = useState({ blurb: book.blurb, keywords: [...book.keywords, ...Array(7).fill('')].slice(0, 7), categories: [...book.categories, '', '', ''].slice(0, 3), author_bio: book.author_bio });
  const [extra, setExtra] = useState<{ tagline?: string; social_posts?: string[] }>({});
  const [busy, setBusy] = useState('');
  const [formats, setFormats] = useState<string[]>(['ebook', 'paperback']);
  const [stores, setStores] = useState<string[]>(['amazon_kdp']);
  const [price, setPrice] = useState(4.99);
  const [checks, setChecks] = useState<CheckItem[] | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);

  const refresh = useCallback(async () => {
    const r = await api<{ checks: CheckItem[]; submissions: Submission[] }>(`/api/books/${book.id}/submit?formats=${formats.join(',')}`);
    setChecks(r.checks);
    setSubs(r.submissions);
  }, [book.id, formats]);
  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  async function generate() {
    setBusy('gen');
    try {
      const r = await api<{ blurb: string; keywords: string[]; categories: string[]; author_bio: string; tagline: string; social_posts: string[] }>(`/api/books/${book.id}/publishing-kit`, {
        body: { fields: ['blurb', 'keywords', 'categories', 'author_bio', 'tagline', 'social_posts'] },
      });
      setKit({ blurb: r.blurb, keywords: [...r.keywords, ...Array(7).fill('')].slice(0, 7), categories: [...r.categories, '', '', ''].slice(0, 3), author_bio: r.author_bio });
      setExtra({ tagline: r.tagline, social_posts: r.social_posts });
      toast('Publishing kit written and saved');
      refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  async function saveKit() {
    setBusy('save');
    try {
      await api(`/api/books/${book.id}`, { method: 'PATCH', body: { blurb: kit.blurb, keywords: kit.keywords.map((k) => k.trim()).filter(Boolean), categories: kit.categories.map((c) => c.trim()).filter(Boolean), author_bio: kit.author_bio } });
      toast('Saved');
      refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  async function submit() {
    setBusy('submit');
    try {
      await api(`/api/books/${book.id}/submit`, { body: { platforms: stores, formats, price } });
      toast('Submitted. We’ll keep you posted at every step.');
      refresh();
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  const active = subs.find((s) => s.status !== 'live' && s.status !== 'changes_requested');
  const ready = checks?.every((c) => c.ok);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <section>
        <PageHeader title="Publishing kit" actions={<Button variant="secondary" onClick={generate} loading={busy === 'gen'}><Sparkles className="h-4 w-4" />Write it all with AI</Button>}>
          The description, keywords and categories the stores ask for. AI drafts them from your book; edit anything before you submit.
        </PageHeader>
        <div className="panel space-y-5 p-5">
          <Field label="Book description" htmlFor="blurb" hint={`${kit.blurb.trim().split(/\s+/).filter(Boolean).length} words. 150–250 works best on store pages.`}>
            <textarea id="blurb" className="field min-h-[180px]" value={kit.blurb} onChange={(e) => setKit({ ...kit, blurb: e.target.value })} />
          </Field>
          <div>
            <p className="label">Keywords (Amazon allows 7)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {kit.keywords.map((k, i) => (
                <input key={i} aria-label={`Keyword ${i + 1}`} className="field" maxLength={50} value={k} onChange={(e) => setKit({ ...kit, keywords: kit.keywords.map((x, j) => (j === i ? e.target.value : x)) })} />
              ))}
            </div>
          </div>
          <div>
            <p className="label">Categories</p>
            <div className="space-y-2">
              {kit.categories.map((c, i) => (
                <input key={i} aria-label={`Category ${i + 1}`} className="field" placeholder="e.g. Biography & Autobiography / Sports" value={c} onChange={(e) => setKit({ ...kit, categories: kit.categories.map((x, j) => (j === i ? e.target.value : x)) })} />
              ))}
            </div>
          </div>
          <Field label="About the author" htmlFor="bio"><textarea id="bio" className="field min-h-[100px]" value={kit.author_bio} onChange={(e) => setKit({ ...kit, author_bio: e.target.value })} /></Field>
          <Button onClick={saveKit} loading={busy === 'save'}>Save</Button>
        </div>

        {(extra.tagline || extra.social_posts?.length) && (
          <div className="mt-6 space-y-3">
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

      <aside className="space-y-6">
        {subs.length > 0 && (
          <div className="panel p-4">
            <h3 className="mb-3">Publishing status</h3>
            {subs.slice(0, 1).map((s) => {
              const reached = new Set(s.history.map((h) => h.status));
              return (
                <div key={s.id}>
                  {s.status === 'changes_requested' && (
                    <div className="mb-3 rounded-md border border-gilt/40 bg-gilt-light p-3 text-[14px]">
                      <p className="font-medium">Our team asked for changes</p>
                      {s.reviewer_notes && <p className="mt-1 whitespace-pre-wrap">{s.reviewer_notes}</p>}
                      <p className="mt-1 text-ink-muted">Make the changes, then submit again below.</p>
                    </div>
                  )}
                  <ol className="space-y-3">
                    {STAGES.map(([k, label]) => {
                      const h = [...s.history].reverse().find((x) => x.status === k);
                      const done = reached.has(k);
                      return (
                        <li key={k} className="flex gap-3 text-[14px]">
                          {done ? <Check className="mt-0.5 h-4 w-4 text-cloth" /> : <Circle className="mt-0.5 h-4 w-4 text-line-strong" />}
                          <div>
                            <p className={clsx(!done && 'text-ink-muted')}>{label}</p>
                            {h && <p className="text-[12px] text-ink-muted">{new Date(h.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {s.isbn && <p className="mt-3 text-[14px]">ISBN: <span className="font-medium">{s.isbn}</span></p>}
                  <p className="mt-3 text-[13px] text-ink-muted">{s.formats.join(' and ')} on {s.platforms.map((p) => STORES[p]?.split(' (')[0] ?? p).join(', ')} at ${Number(s.price).toFixed(2)}</p>
                </div>
              );
            })}
          </div>
        )}

        {!active && (
          <div className="panel space-y-4 p-4">
            <h3>Submit for publishing</h3>
            <fieldset>
              <legend className="label">Formats</legend>
              <div className="flex gap-2">
                {(['ebook', 'paperback'] as const).map((f) => (
                  <button key={f} type="button" className="chip" aria-pressed={formats.includes(f)} onClick={() => setFormats(formats.includes(f) ? formats.filter((x) => x !== f) : [...formats, f])}>{f === 'ebook' ? 'Ebook' : 'Paperback'}</button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="label">Stores</legend>
              <div className="space-y-1.5 text-[14px]">
                {Object.entries(STORES).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-2">
                    <input type="checkbox" className="accent-cloth" checked={stores.includes(k)} onChange={(e) => setStores(e.target.checked ? [...stores, k] : stores.filter((x) => x !== k))} />{v}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Ebook price (USD)" htmlFor="price" hint="Amazon pays 70% royalty between $2.99 and $9.99.">
              <input id="price" type="number" min={0.99} step={0.01} className="field" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </Field>
            <div>
              <p className="label">Before you submit</p>
              {checks ? (
                <ul className="space-y-2 text-[14px]">
                  {checks.map((c) => (
                    <li key={c.id} className="flex gap-2">
                      {c.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-cloth" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gilt" />}
                      <span>
                        {c.label}
                        {!c.ok && <> · <Link href={c.link} className="text-cloth underline">{c.fix}</Link></>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-ink-muted">Checking…</p>
              )}
            </div>
            <Button className="w-full" onClick={submit} loading={busy === 'submit'} disabled={!ready || !stores.length || !formats.length}>Submit for publishing</Button>
            {!ready && checks && <Badge tone="gilt">{checks.filter((c) => !c.ok).length} steps left</Badge>}
          </div>
        )}
      </aside>
    </div>
  );
}
