'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { api, ApiError, errorText } from '@/lib/client';
import { Badge, Button, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';

type Ch = { id: string; position: number; title: string; word_count: number };
type Proof = { type: string; original: string; replacement: string; explanation: string };
type Cont = { quote: string; problem: string; fix: string; severity: 'high' | 'medium' | 'low' };
type Report = { chapter_id: string; kind: 'proofread' | 'continuity'; result: unknown; created_at: string };

export function Checks({ bookId, chapters, reports, defaultDialect }: { bookId: string; chapters: Ch[]; reports: Report[]; defaultDialect: 'US' | 'UK' }) {
  const toast = useToast();
  const [tab, setTab] = useState<'proofread' | 'continuity'>('proofread');
  const [dialect, setDialect] = useState(defaultDialect);
  const init = (kind: Report['kind']) => Object.fromEntries(reports.filter((r) => r.kind === kind).map((r) => [r.chapter_id, r.result]));
  const [proof, setProof] = useState<Record<string, Proof[]>>(init('proofread') as Record<string, Proof[]>);
  const [cont, setCont] = useState<Record<string, Cont[]>>(init('continuity') as Record<string, Cont[]>);
  const [progress, setProgress] = useState<{ i: number; n: number } | null>(null);
  const stop = useRef(false);
  const written = chapters.filter((c) => c.word_count > 0);

  async function runAll() {
    stop.current = false;
    for (let i = 0; i < written.length; i++) {
      if (stop.current) break;
      setProgress({ i, n: written.length });
      try {
        const r = await api<{ issues: unknown[] }>(`/api/books/${bookId}/${tab}`, { body: { chapterId: written[i].id, dialect } });
        if (tab === 'proofread') setProof((p) => ({ ...p, [written[i].id]: r.issues as Proof[] }));
        else setCont((p) => ({ ...p, [written[i].id]: r.issues as Cont[] }));
      } catch (e) {
        toast(`${written[i].title}: ${errorText(e)}`, 'error');
        if (e instanceof ApiError && e.code === 'TOKENS_EXHAUSTED') break;
      }
    }
    setProgress(null);
  }

  async function fix(ch: Ch, items: Proof[]) {
    try {
      const r = await api<{ applied: number; skipped: number }>(`/api/books/${bookId}/proofread`, { method: 'PUT', body: { chapterId: ch.id, fixes: items.map(({ original, replacement }) => ({ original, replacement })) } });
      setProof((p) => ({ ...p, [ch.id]: (p[ch.id] ?? []).filter((x) => !items.includes(x)) }));
      toast(r.skipped ? `Fixed ${r.applied}. ${r.skipped} no longer matched the text and were skipped.` : `Fixed ${r.applied}`);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }
  async function dismiss(ch: Ch, item: Proof) {
    await api(`/api/books/${bookId}/proofread`, { method: 'PATCH', body: { chapterId: ch.id, original: item.original } });
    setProof((p) => ({ ...p, [ch.id]: (p[ch.id] ?? []).filter((x) => x !== item) }));
  }

  const data = tab === 'proofread' ? proof : cont;
  const checked = written.filter((c) => data[c.id]).length;
  const total = written.reduce((s, c) => s + (data[c.id]?.length ?? 0), 0);

  return (
    <div className="max-w-[920px]">
      <PageHeader
        title={tab === 'proofread' ? 'Proofreading' : 'Continuity check'}
        actions={
          progress ? (
            <Button variant="secondary" onClick={() => { stop.current = true; }}>Stop</Button>
          ) : (
            <Button onClick={runAll} disabled={!written.length}>{checked ? 'Check again' : 'Check the whole book'}</Button>
          )
        }
      >
        {tab === 'proofread'
          ? 'Every spelling, grammar, punctuation and consistency error, chapter by chapter. Style is left alone.'
          : 'Contradictions across chapters: names, ages, dates, places, timeline. Checked against your story bible.'}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-line bg-sheet p-1 text-[14px]" role="tablist">
          {(['proofread', 'continuity'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} disabled={!!progress} className={clsx('rounded px-3 py-1.5', tab === t ? 'bg-ink text-white' : 'text-ink-soft')}>
              {t === 'proofread' ? 'Proofreading' : 'Continuity'}
            </button>
          ))}
        </div>
        {tab === 'proofread' && (
          <label className="flex items-center gap-2 text-[14px]">
            Spelling
            <select className="field w-auto py-1.5" value={dialect} onChange={(e) => setDialect(e.target.value as 'US' | 'UK')}>
              <option value="US">American English</option>
              <option value="UK">British English</option>
            </select>
          </label>
        )}
        {progress && <span className="text-[14px] text-ink-muted" aria-live="polite">Checking chapter {progress.i + 1} of {progress.n}…</span>}
        {!progress && checked > 0 && (
          <span className="text-[14px] text-ink-muted">
            {checked} of {written.length} chapters checked · {total} {total === 1 ? 'issue' : 'issues'} open
          </span>
        )}
      </div>

      {!written.length && <p className="text-ink-muted">Write some chapters first.</p>}

      <div className="space-y-6">
        {written.map((ch) => {
          const items = data[ch.id];
          if (!items) return null;
          return (
            <section key={ch.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-[1.1rem]">{ch.position}. {ch.title}</h2>
                {tab === 'proofread' && items.length > 1 && <Button size="sm" variant="secondary" onClick={() => fix(ch, items as Proof[])}>Fix all {items.length}</Button>}
              </div>
              {!items.length ? (
                <p className="text-[14px] text-cloth">No issues found.</p>
              ) : tab === 'proofread' ? (
                <ul className="panel divide-y divide-line">
                  {(items as Proof[]).map((it, i) => (
                    <li key={i} className="flex flex-wrap items-start gap-3 px-4 py-3 text-[14px]">
                      <Badge>{it.type}</Badge>
                      <div className="min-w-0 flex-1">
                        <p><span className="rounded-sm bg-removed-bg px-1 text-removed line-through">{it.original}</span> <span className="rounded-sm bg-added-bg px-1 text-added">{it.replacement}</span></p>
                        <p className="mt-0.5 text-[13px] text-ink-muted">{it.explanation}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => fix(ch, [it])}>Fix</Button>
                        <Button size="sm" variant="ghost" onClick={() => dismiss(ch, it)}>Ignore</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="panel divide-y divide-line">
                  {(items as Cont[]).map((it, i) => (
                    <li key={i} className="space-y-1 px-4 py-3 text-[14px]">
                      <div className="flex items-center gap-2">
                        <Badge tone={it.severity === 'high' ? 'danger' : it.severity === 'medium' ? 'gilt' : 'neutral'}>{it.severity}</Badge>
                        <span className="font-medium">{it.problem}</span>
                      </div>
                      <blockquote className="border-l-2 border-line pl-3 font-serif italic text-ink-soft">{it.quote}</blockquote>
                      <p className="text-ink-muted">Suggested fix: {it.fix}</p>
                      <Link href={`/dashboard/books/${bookId}/write?chapter=${ch.id}`} className="text-[13px] text-cloth underline">Open chapter</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
