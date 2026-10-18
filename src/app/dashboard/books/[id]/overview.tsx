'use client';
import { importManuscript } from '@/lib/import-client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import type { Book, Chapter } from '@/lib/api';
import type { BookProgress } from '@/lib/text';
import { countWords, formatNumber } from '@/lib/text';
import { api, ApiError, errorText, stream } from '@/lib/client';
import { DIALECTS, GENRES, PACING, POVS } from '@/lib/genres';
import { Button, ButtonLink, Empty, Field, Modal, Progress } from '@/components/ui';
import { useToast } from '@/components/toast';

export function Overview({ book, chapters, progress, autowrite }: { book: Book; chapters: Chapter[]; progress: BookProgress; autowrite?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState(book);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState<Chapter | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [writeAllOpen, setWriteAllOpen] = useState(!!autowrite && chapters.some((c) => !c.word_count));
  const set = <K extends keyof Book>(k: K, v: Book[K]) => setF((x) => ({ ...x, [k]: v }));

  async function run(label: string, fn: () => Promise<unknown>, done?: string) {
    setBusy(label);
    try {
      await fn();
      if (done) toast(done);
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy('');
    }
  }

  const saveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    const { title, subtitle, book_type, genre, audience, style, tone, summary, target_words, target_chapters, author_name, reader_outcome, key_message, pov, pacing, themes, dialect, writing_sample } = f;
    run(
      'details',
      () =>
        api(`/api/books/${book.id}`, {
          method: 'PATCH',
          body: { title, subtitle, book_type, genre, audience, style, tone, summary, target_words, target_chapters, author_name, reader_outcome, key_message, pov, pacing, themes: themes ?? [], dialect, writing_sample },
        }),
      'Details saved',
    );
  };

  const move = (i: number, dir: -1 | 1) => {
    const order = chapters.map((c) => c.id);
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    run('order', () => api(`/api/books/${book.id}/chapters`, { method: 'PATCH', body: { order } }));
  };

  const empty = chapters.filter((c) => !c.word_count).length;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2>Chapters</h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>Import manuscript</Button>
            <Button size="sm" variant="secondary" onClick={() => setPlanOpen(true)} loading={busy === 'plan'}>
              {chapters.length ? 'Re-plan unwritten chapters' : 'Plan chapters with AI'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => run('add', () => api(`/api/books/${book.id}/chapters`, { body: {} }))} loading={busy === 'add'}>
              Add chapter
            </Button>
            {empty > 0 && (
              <Button size="sm" onClick={() => setWriteAllOpen(true)}>
                Write {empty === chapters.length ? 'all chapters' : `the ${empty} empty chapters`} with AI
              </Button>
            )}
          </div>
        </div>

        {chapters.length ? (
          <ol className="panel divide-y divide-line">
            {chapters.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-7 shrink-0 font-serif text-[1.05rem] text-ink-faint">{c.position}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/books/${book.id}/write?chapter=${c.id}`} className="font-medium hover:underline">
                    {c.title || `Chapter ${c.position}`}
                  </Link>
                  {c.synopsis && <p className="line-clamp-1 text-[13px] text-ink-muted">{c.synopsis}</p>}
                </div>
                <span className="hidden w-24 text-right text-[13px] text-ink-muted sm:block">
                  {c.word_count ? `${formatNumber(c.word_count)} words` : 'Not written'}
                </span>
                <div className="flex shrink-0">
                  <button className="rounded p-1.5 text-ink-muted hover:bg-ink/5 disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0 || !!busy} aria-label={`Move chapter ${c.position} up`}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button className="rounded p-1.5 text-ink-muted hover:bg-ink/5 disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === chapters.length - 1 || !!busy} aria-label={`Move chapter ${c.position} down`}>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button className="rounded p-1.5 text-ink-muted hover:bg-ink/5" onClick={() => setEditing(c)} aria-label={`Edit chapter ${c.position} details`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="No chapters yet" action={<Button onClick={() => setPlanOpen(true)}>Plan chapters with AI</Button>}>
            Let Claude outline the book from your description, import a manuscript, or add chapters yourself.
          </Empty>
        )}
      </section>

      <aside className="space-y-6">
        <div className="panel p-4">
          <h3 className="mb-3">Progress</h3>
          <div className="space-y-3 text-[14px]">
            <div>
              <div className="mb-1 flex justify-between"><span>Chapters written</span><span>{progress.chaptersDone} of {progress.chaptersTotal}</span></div>
              <Progress value={progress.chapterPercent} label="Chapters written" />
            </div>
            <div>
              <div className="mb-1 flex justify-between"><span>Words</span><span>{formatNumber(progress.words)} of {formatNumber(progress.targetWords)}</span></div>
              <Progress value={progress.wordPercent} tone="gilt" label="Words written" />
            </div>
          </div>
          {chapters.length > 0 && (
            <ButtonLink href={`/dashboard/books/${book.id}/write${empty ? `?chapter=${chapters.find((c) => !c.word_count)?.id}` : ''}`} className="mt-4 w-full">
              {empty ? 'Write next chapter' : 'Open the editor'}
            </ButtonLink>
          )}
        </div>

        <form onSubmit={saveDetails} className="panel space-y-3 p-4">
          <h3>Book details</h3>
          <p className="text-[13px] text-ink-muted">The AI uses these every time it writes or edits.</p>
          <Field label="Title" htmlFor="t"><input id="t" className="field" required value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Subtitle" htmlFor="st"><input id="st" className="field" value={f.subtitle} onChange={(e) => set('subtitle', e.target.value)} /></Field>
          <Field label="Author name for this book" htmlFor="an" hint="Pen names are fine. Leave empty to use your profile name."><input id="an" className="field" value={f.author_name ?? ''} onChange={(e) => set('author_name', e.target.value)} /></Field>
          <Field label="Genre" htmlFor="g">
            <select id="g" className="field" value={f.genre} onChange={(e) => set('genre', e.target.value)}>
              {!GENRES[f.book_type].includes(f.genre) && <option>{f.genre}</option>}
              {GENRES[f.book_type].map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Audience" htmlFor="a"><input id="a" className="field" value={f.audience} onChange={(e) => set('audience', e.target.value)} /></Field>
          <Field label="Style" htmlFor="s"><input id="s" className="field" value={f.style} onChange={(e) => set('style', e.target.value)} /></Field>
          <Field label="Tone" htmlFor="to"><input id="to" className="field" value={f.tone} onChange={(e) => set('tone', e.target.value)} /></Field>
          <Field label="Summary" htmlFor="su"><textarea id="su" className="field min-h-[110px]" value={f.summary} onChange={(e) => set('summary', e.target.value)} /></Field>
          <Field label="What readers should gain" htmlFor="ro"><textarea id="ro" className="field min-h-[70px]" value={f.reader_outcome ?? ''} onChange={(e) => set('reader_outcome', e.target.value)} /></Field>
          <Field label="The one key message" htmlFor="km"><input id="km" className="field" value={f.key_message ?? ''} onChange={(e) => set('key_message', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Point of view" htmlFor="pov">
              <select id="pov" className="field" value={f.pov ?? ''} onChange={(e) => set('pov', e.target.value)}>
                <option value="">Not set</option>
                {POVS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Pacing" htmlFor="pac">
              <select id="pac" className="field" value={f.pacing ?? ''} onChange={(e) => set('pacing', e.target.value)}>
                <option value="">Not set</option>
                {PACING.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Spelling" htmlFor="dia">
            <select id="dia" className="field" value={f.dialect ?? 'US English'} onChange={(e) => set('dialect', e.target.value)}>
              {DIALECTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Themes and keywords" htmlFor="th" hint="Separate with commas.">
            <input id="th" className="field" value={(f.themes ?? []).join(', ')} onChange={(e) => set('themes', e.target.value.split(',').map((x) => x.trimStart()).filter((x, i, a) => x || i === a.length - 1))} />
          </Field>
          <div id="writing-sample" className="scroll-mt-24">
            <Field label="Your writing sample" htmlFor="ws" hint="Paste a page or two you’ve written. When “Write in my style” is on, the AI matches your voice.">
              <textarea id="ws" className="field min-h-[120px]" value={f.writing_sample ?? ''} onChange={(e) => set('writing_sample', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target words" htmlFor="tw"><input id="tw" type="number" className="field" min={500} value={f.target_words} onChange={(e) => set('target_words', Number(e.target.value))} /></Field>
            <Field label="Chapters" htmlFor="tc"><input id="tc" type="number" className="field" min={1} value={f.target_chapters} onChange={(e) => set('target_chapters', Number(e.target.value))} /></Field>
          </div>
          <Button type="submit" size="sm" loading={busy === 'details'}>Save details</Button>
        </form>

        <div className="rounded-md border border-danger/30 p-4">
          <h3 className="text-danger">Delete this book</h3>
          <p className="mt-1 text-[13px] text-ink-muted">Removes every chapter, version, cover and report. This can’t be undone.</p>
          <Button variant="secondary" size="sm" className="mt-3 text-danger" onClick={() => setDeleteOpen(true)}>Delete book</Button>
        </div>
      </aside>

      <ChapterModal chapter={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />
      <ImportModal open={importOpen} bookId={book.id} hasChapters={chapters.length > 0} onClose={() => setImportOpen(false)} />
      <PlanModal open={planOpen} bookId={book.id} written={chapters.length - empty} target={book.target_chapters} onClose={() => setPlanOpen(false)} />
      <DeleteModal open={deleteOpen} book={book} onClose={() => setDeleteOpen(false)} />
      <WriteAllModal open={writeAllOpen} chapters={chapters.filter((c) => !c.word_count)} onClose={() => { setWriteAllOpen(false); history.replaceState(null, '', location.pathname); router.refresh(); }} />
    </div>
  );
}

function ChapterModal({ chapter, onClose, onSaved }: { chapter: Chapter | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if (chapter && chapter.id !== lastId) {
    setLastId(chapter.id);
    setTitle(chapter.title);
    setSynopsis(chapter.synopsis ?? '');
  }
  async function save() {
    setBusy(true);
    try {
      await api(`/api/chapters/${chapter!.id}`, { method: 'PATCH', body: { title, synopsis } });
      onSaved();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy(false);
  }
  async function remove() {
    if (!confirm(`Delete “${chapter!.title}” and its text? You can’t undo this.`)) return;
    setBusy(true);
    try {
      await api(`/api/chapters/${chapter!.id}`, { method: 'DELETE' });
      onSaved();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy(false);
  }
  return (
    <Modal open={!!chapter} onClose={onClose} title="Chapter details">
      <div className="space-y-4">
        <Field label="Title" htmlFor="ct"><input id="ct" className="field" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="What happens in this chapter" htmlFor="cs" hint="The AI follows this when it writes the chapter.">
          <textarea id="cs" className="field min-h-[120px]" value={synopsis} onChange={(e) => setSynopsis(e.target.value)} />
        </Field>
        <div className="flex justify-between">
          <Button variant="ghost" className="text-danger" onClick={remove} disabled={busy}><Trash2 className="h-4 w-4" />Delete chapter</Button>
          <Button onClick={save} loading={busy}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({ open, bookId, hasChapters, onClose }: { open: boolean; bookId: string; hasChapters: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!file) return;
    setBusy(true);
    try {
      const r = await importManuscript(bookId, file, replace);
      toast(`Imported ${r.chapters} chapters (${formatNumber(r.words)} words${r.images ? `, ${r.images} image${r.images === 1 ? '' : 's'}` : ''})`);
      onClose();
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy(false);
  }
  return (
    <Modal open={open} onClose={onClose} title="Import a manuscript">
      <div className="space-y-4 text-[14px]">
        <p className="text-ink-muted">Upload a Word (.docx), PDF, text (.txt) or Markdown (.md) file up to 40 MB. Word files keep their formatting and pictures. Chapters are split at headings like “Chapter 1” or “Prologue”.</p>
        <input type="file" accept=".docx,.pdf,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {hasChapters && (
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-cloth" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Replace the existing chapters (otherwise they’re added at the end)
          </label>
        )}
        <Button onClick={go} loading={busy} disabled={!file}>Import</Button>
      </div>
    </Modal>
  );
}

function PlanModal({ open, bookId, written, target, onClose }: { open: boolean; bookId: string; written: number; target: number; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [guidance, setGuidance] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await api<{ count: number }>(`/api/books/${bookId}/outline`, { body: { guidance } });
      toast(`Planned ${r.count} chapters`);
      onClose();
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy(false);
  }
  return (
    <Modal open={open} onClose={onClose} title="Plan chapters with AI">
      <div className="space-y-4 text-[14px]">
        <p className="text-ink-muted">
          Claude plans {Math.max(0, target - written)} chapter{target - written === 1 ? '' : 's'} from your book details.
          {written > 0 && ` Your ${written} written chapter${written === 1 ? ' stays' : 's stay'} exactly as they are; only empty chapters are replaced.`}
        </p>
        <Field label="Anything the plan should include? (optional)" htmlFor="gd">
          <textarea id="gd" className="field min-h-[100px]" placeholder="e.g. Start with his debut at Santos, end on his last match for Brazil" value={guidance} onChange={(e) => setGuidance(e.target.value)} />
        </Field>
        <Button onClick={go} loading={busy}>{busy ? 'Planning… about a minute' : 'Plan chapters'}</Button>
      </div>
    </Modal>
  );
}

function DeleteModal({ open, book, onClose }: { open: boolean; book: Book; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await api(`/api/books/${book.id}`, { method: 'DELETE' });
      toast('Book deleted');
      router.push('/dashboard/books');
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Delete this book?">
      <div className="space-y-4 text-[14px]">
        <p>This permanently deletes <strong>{book.title}</strong>: every chapter, saved version, story bible entry, report and cover.</p>
        <Field label="Type the book’s title to confirm" htmlFor="dt">
          <input id="dt" className="field" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </Field>
        <Button variant="danger" onClick={go} loading={busy} disabled={typed.trim() !== book.title.trim()}>Delete book permanently</Button>
      </div>
    </Modal>
  );
}

function WriteAllModal({ open, chapters, onClose }: { open: boolean; chapters: Chapter[]; onClose: () => void }) {
  const [state, setState] = useState<{ i: number; done: number; words: number; failed: string[]; stopped: boolean; finished: boolean } | null>(null);
  const stopRef = useRef(false);
  const startedRef = useRef(false);

  async function go() {
    if (startedRef.current) return;
    startedRef.current = true;
    stopRef.current = false;
    const failed: string[] = [];
    let words = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (stopRef.current) break;
      setState({ i, done: i, words, failed, stopped: false, finished: false });
      try {
        await stream(`/api/chapters/${chapters[i].id}/generate`, { mode: 'write' }, (t) => setState((s) => (s ? { ...s, words: words + countWords(t) } : s)));
        const r = await api<{ chapter: { word_count: number } }>(`/api/chapters/${chapters[i].id}`);
        words += r.chapter.word_count;
      } catch (e) {
        failed.push(`${chapters[i].title}: ${errorText(e)}`);
        if (e instanceof ApiError && ['TOKENS_EXHAUSTED', 'TOKENS_LOW', 'AI_NOT_CONFIGURED'].includes(e.code ?? '')) break;
      }
    }
    setState((s) => ({ i: s?.i ?? 0, done: chapters.length, words, failed, stopped: stopRef.current, finished: true }));
    startedRef.current = false;
  }

  useEffect(() => {
    if (open && !state && chapters.length) go();
    // start once when opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const running = state && !state.finished;
  return (
    <Modal open={open} onClose={() => { if (!running) { setState(null); onClose(); } }} title="Writing your book">
      {!state ? (
        <p className="text-[14px] text-ink-muted">Starting…</p>
      ) : (
        <div className="space-y-3 text-[14px]">
          <p>
            {state.finished
              ? state.stopped
                ? `Stopped. ${formatNumber(state.words)} words written so far.`
                : `Done. ${formatNumber(state.words)} words written.`
              : `Writing chapter ${state.i + 1} of ${chapters.length}: ${chapters[state.i]?.title}`}
          </p>
          <Progress value={(state.finished ? chapters.length : state.done) / Math.max(1, chapters.length) * 100} label="Chapters written" />
          {!state.finished && <p className="text-ink-muted">{formatNumber(state.words)} words so far. Keep this page open; each chapter takes a minute or two.</p>}
          {state.failed.length > 0 && <ul className="list-disc pl-5 text-danger">{state.failed.map((f) => <li key={f}>{f}</li>)}</ul>}
          {running ? (
            <Button variant="secondary" onClick={() => { stopRef.current = true; }}>Stop after this chapter</Button>
          ) : (
            <Button onClick={() => { setState(null); onClose(); }}>Done</Button>
          )}
        </div>
      )}
    </Modal>
  );
}
