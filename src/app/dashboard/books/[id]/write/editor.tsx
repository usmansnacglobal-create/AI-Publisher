'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Check, Download, History, MessageSquare, PanelRightClose, PanelRightOpen, Plus, Scissors, SlidersHorizontal, Sparkles, Square, Wand2, X } from 'lucide-react';
import type { Book, Chapter, ChapterSettings } from '@/lib/api';
import { api, ApiError, errorText, stream } from '@/lib/client';
import { countWords, fleschScore, formatNumber, readingMinutes } from '@/lib/text';
import { EDIT_ACTIONS } from '@/lib/ai/prompts';
import { Button, Field, Modal } from '@/components/ui';
import { useToast } from '@/components/toast';
import { ManuscriptEditor, type ManuscriptEditorHandle } from '@/components/manuscript-editor';

type ListItem = Pick<Chapter, 'id' | 'position' | 'title' | 'synopsis' | 'word_count' | 'status'>;
type Suggestion = { id: string; kind: string; original: string; replacement: string; reason: string };
type SaveState = 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error';
type PanelTab = 'edit' | 'controls' | 'ask' | 'history';

export function Editor({ book, chapters: initialList, initialId, canPrint }: { book: Book; chapters: ListItem[]; initialId: string | null; canPrint: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [list, setList] = useState(initialList);
  const [currentId, setCurrentId] = useState(initialId);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [save, setSave] = useState<SaveState>('saved');
  const [generating, setGenerating] = useState<'write' | 'continue' | 'outline' | null>(null);
  const [panel, setPanel] = useState<PanelTab>('edit');
  const [showPanel, setShowPanel] = useState(true);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const edRef = useRef<ManuscriptEditorHandle>(null);
  const baseRef = useRef<string>('');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef<Promise<void> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latest = useRef({ content: '', title: '' });
  latest.current = { content, title };

  const load = useCallback(async (id: string) => {
    const r = await api<{ chapter: Chapter; suggestions: Suggestion[] }>(`/api/chapters/${id}`);
    setChapter(r.chapter);
    setContent(r.chapter.content);
    setTitle(r.chapter.title);
    setSuggestions(r.suggestions);
    baseRef.current = r.chapter.updated_at;
    setSave('saved');
  }, []);

  useEffect(() => {
    if (!currentId) return;
    load(currentId).catch((e) => toast(errorText(e), 'error'));
    const u = new URL(location.href);
    u.searchParams.set('chapter', currentId);
    history.replaceState(null, '', u);
  }, [currentId, load, toast]);

  // Ctrl/Cmd + Shift + A shows or hides the AI panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setShowPanel((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Autosave 1.2 s after typing stops.
  const doSave = useCallback(async () => {
    if (!chapter) return;
    const body = { content: latest.current.content, title: latest.current.title, baseUpdatedAt: baseRef.current };
    setSave('saving');
    const p = (async () => {
      try {
        const r = await api<{ updated_at: string; word_count: number }>(`/api/chapters/${chapter.id}`, { method: 'PATCH', body });
        baseRef.current = r.updated_at;
        setList((l) => l.map((c) => (c.id === chapter.id ? { ...c, title: body.title, word_count: r.word_count, status: r.word_count ? 'drafted' : 'planned' } : c)));
        setSave(latest.current.content === body.content && latest.current.title === body.title ? 'saved' : 'unsaved');
      } catch (e) {
        setSave(e instanceof ApiError && e.code === 'CONFLICT' ? 'conflict' : 'error');
      }
    })();
    pending.current = p;
    await p;
    pending.current = null;
  }, [chapter]);

  const schedule = () => {
    setSave('unsaved');
    clearTimeout(timer.current);
    timer.current = setTimeout(doSave, 1200);
  };
  const flush = async () => {
    clearTimeout(timer.current);
    if (pending.current) await pending.current;
    if (save === 'unsaved') await doSave();
  };

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (save === 'unsaved' || save === 'saving' || generating) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [save, generating]);

  async function switchTo(id: string) {
    if (id === currentId) return;
    await flush();
    setCurrentId(id);
  }

  async function generate(mode: 'write' | 'continue', guidance = '') {
    if (!chapter) return;
    await flush();
    const outlineOnly = mode === 'write' && chapter.settings?.mode === 'outline';
    const ctl = new AbortController();
    abortRef.current = ctl;
    setGenerating(outlineOnly ? 'outline' : mode);
    const base = mode === 'continue' ? content.trimEnd() + '\n\n' : '';
    // Update the page at most a few times a second while text streams in.
    let last = 0;
    let queued: ReturnType<typeof setTimeout> | undefined;
    const show = (t: string) => {
      const apply = () => {
        last = Date.now();
        if (outlineOnly) setChapter((c) => (c ? { ...c, synopsis: t } : c));
        else setContent(base + t);
      };
      clearTimeout(queued);
      if (Date.now() - last > 250) apply();
      else queued = setTimeout(apply, 250);
    };
    try {
      await stream(`/api/chapters/${chapter.id}/generate`, { mode, guidance }, show, ctl.signal);
      toast(outlineOnly ? 'Chapter plan written' : mode === 'write' ? 'Chapter written' : 'Added to the chapter');
      if (outlineOnly) setPlanOpen(true);
    } catch (e) {
      if (!ctl.signal.aborted) toast(errorText(e), 'error');
    } finally {
      clearTimeout(queued);
      setGenerating(null);
      abortRef.current = null;
      // The server saved the final text; reload so we're in sync.
      setTimeout(() => load(chapter.id), 600);
      router.refresh();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function decide(s: Suggestion, status: 'accepted' | 'rejected') {
    await flush();
    try {
      const r = await api<{ chapter?: { content: string; updated_at: string; word_count: number } }>(`/api/suggestions/${s.id}`, { method: 'PATCH', body: { status } });
      if (r.chapter) {
        setContent(r.chapter.content);
        baseRef.current = r.chapter.updated_at;
        setList((l) => l.map((c) => (c.id === chapter!.id ? { ...c, word_count: r.chapter!.word_count } : c)));
      }
      setSuggestions((x) => x.filter((y) => y.id !== s.id));
    } catch (e) {
      toast(errorText(e), 'error');
      setSuggestions((x) => x.filter((y) => y.id !== s.id));
    }
  }

  async function decideAll(status: 'accepted' | 'rejected') {
    for (const s of [...suggestions]) await decide(s, status);
  }

  async function refreshList(selectId?: string) {
    const r = await api<{ chapters: ListItem[] }>(`/api/books/${book.id}`);
    setList(r.chapters);
    if (selectId) setCurrentId(selectId);
  }

  async function addChapter() {
    await flush();
    const { id } = await api<{ id: string }>(`/api/books/${book.id}/chapters`, { body: {} });
    await refreshList(id);
  }

  const words = countWords(content);
  const flesch = fleschScore(content.replace(/[*_#>\\-]/g, ''));

  if (!list.length)
    return (
      <div className="panel max-w-prose p-8">
        <h2>No chapters yet</h2>
        <p className="mt-2 text-ink-muted">Plan the chapters on the Overview tab, import a manuscript, or start writing straight away.</p>
        <Button className="mt-4" onClick={addChapter}>Add the first chapter</Button>
      </div>
    );

  const outlineMode = chapter?.settings?.mode === 'outline';

  return (
    <div className={clsx('grid gap-6', showPanel ? 'xl:grid-cols-[210px_minmax(0,1fr)_340px]' : 'xl:grid-cols-[210px_minmax(0,1fr)]')}>
      {/* Chapter list */}
      <nav aria-label="Chapters" className="order-2 xl:order-1">
        <ol className="space-y-0.5 xl:sticky xl:top-6">
          {list.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => switchTo(c.id)}
                aria-current={c.id === currentId ? 'true' : undefined}
                className={clsx('flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-[14px]', c.id === currentId ? 'bg-sheet font-medium shadow-[inset_2px_0_0_#A8833A]' : 'text-ink-soft hover:bg-sheet/60')}
              >
                <span className="w-5 shrink-0 text-[12px] text-ink-faint">{c.position}</span>
                <span className="line-clamp-2 flex-1">{c.title || `Chapter ${c.position}`}</span>
                <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', c.word_count ? 'bg-cloth' : 'bg-line-strong')} aria-label={c.word_count ? 'Written' : 'Not written'} />
              </button>
            </li>
          ))}
          <li>
            <button onClick={addChapter} className="mt-1 flex items-center gap-2 px-2 py-1.5 text-[13px] text-ink-muted hover:text-ink">
              <Plus className="h-3.5 w-3.5" /> Add chapter
            </button>
          </li>
        </ol>
      </nav>

      {/* Manuscript */}
      <section className="order-1 min-w-0 xl:order-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-muted">
          <span aria-live="polite">
            {generating ? (generating === 'outline' ? 'AI is planning this chapter…' : 'AI is writing…') : { saved: 'All changes saved', saving: 'Saving…', unsaved: 'Unsaved changes', conflict: '', error: 'Couldn’t save. Retrying when you type.' }[save]}
          </span>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" onClick={() => setSplitOpen(true)} disabled={!!generating || !content.trim()}>
              <Scissors className="h-4 w-4" /> Split chapter
            </Button>
            <DownloadMenu bookId={book.id} canPrint={canPrint} beforeRun={flush} />
            <Button size="sm" variant="ghost" onClick={() => setRewriteOpen(true)} disabled={!!generating}>
              <Wand2 className="h-4 w-4" /> Rewrite whole book
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowPanel((v) => !v)} title="Show or hide the AI panel (Ctrl+Shift+A)" aria-pressed={showPanel}>
              {showPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              <span className="hidden sm:inline">{showPanel ? 'Hide AI' : 'Show AI'}</span>
            </Button>
          </div>
        </div>
        {save === 'conflict' && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-gilt/50 bg-gilt-light px-4 py-2 text-[14px]">
            This chapter changed somewhere else, so your latest typing wasn’t saved.
            <Button size="sm" variant="secondary" onClick={() => chapter && load(chapter.id)}>Load latest</Button>
          </div>
        )}
        {chapter?.admin_note?.trim() && (
          <div className="mb-3 rounded-md border border-gilt/50 bg-gilt-light px-4 py-3 text-[14px]">
            <p className="font-medium">Note from our publishing team</p>
            <p className="mt-1 whitespace-pre-wrap">{chapter.admin_note}</p>
          </div>
        )}

        <article className="rounded-sm border border-line bg-sheet px-5 py-8 shadow-[0_1px_0_rgb(var(--c-line)),0_8px_24px_-12px_rgba(28,34,48,.18)] sm:px-14 sm:py-12">
          <p className="text-center text-[12px] tracking-[0.2em] text-ink-faint">CHAPTER {chapter?.position ?? ''}</p>
          <input
            aria-label="Chapter title"
            className="mt-2 w-full bg-transparent text-center font-serif text-[1.9rem] italic leading-tight text-ink outline-none placeholder:text-ink-faint"
            value={title}
            placeholder="Untitled chapter"
            onChange={(e) => { setTitle(e.target.value); schedule(); }}
            disabled={!chapter}
          />
          {chapter?.synopsis && (
            <div className="mx-auto mt-3 max-w-prose text-center text-[14px] text-ink-muted">
              <p className={clsx('whitespace-pre-wrap text-left sm:text-center', !planOpen && 'line-clamp-2')}>{chapter.synopsis}</p>
              {chapter.synopsis.length > 160 && (
                <button className="mt-1 text-[13px] text-cloth underline" onClick={() => setPlanOpen((v) => !v)}>{planOpen ? 'Show less' : 'Show the full chapter plan'}</button>
              )}
            </div>
          )}

          {chapter && !content.trim() && !generating ? (
            <div className="mx-auto mt-8 max-w-prose space-y-3 text-center">
              <p className="text-ink-muted">
                {outlineMode
                  ? 'This chapter is set to “Outline only”: AI writes a detailed plan for you to write from.'
                  : 'This chapter is empty. Start typing, or let Claude write a draft using the AI controls.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => generate('write')}><Sparkles className="h-4 w-4" />{outlineMode ? 'Plan this chapter with AI' : 'Write this chapter with AI'}</Button>
                <Button variant="secondary" onClick={() => { setShowPanel(true); setPanel('controls'); }}><SlidersHorizontal className="h-4 w-4" />AI controls</Button>
                <Button variant="ghost" onClick={() => setNotesOpen(true)}>Add notes first</Button>
              </div>
            </div>
          ) : null}

          <div className="mx-auto mt-6 max-w-prose">
            <ManuscriptEditor
              ref={edRef}
              value={content}
              readOnly={!!generating && generating !== 'outline'}
              onChange={(v) => { setContent(v); schedule(); }}
              placeholder={chapter ? 'Start writing…' : 'Loading…'}
              selectionMenu={({ text, close }) =>
                chapter ? (
                  <SelectionActions
                    chapterId={chapter.id}
                    text={text}
                    beforeRun={flush}
                    onClose={close}
                    onDecide={async (s, st) => { await decide(s, st); close(); }}
                  />
                ) : null
              }
            />
          </div>
        </article>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-muted">
          <span>
            {formatNumber(words)} words · {readingMinutes(words)} min read{flesch !== null && ` · Readability ${flesch}/100 (${flesch >= 70 ? 'easy' : flesch >= 50 ? 'standard' : 'demanding'})`}
          </span>
          <div className="flex gap-2">
            {generating ? (
              <Button size="sm" variant="secondary" onClick={stop}><Square className="h-3.5 w-3.5" />Stop</Button>
            ) : content.trim() ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => generate('continue')}><Sparkles className="h-4 w-4" />Continue writing</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm('Replace this chapter with a fresh AI draft? The current text is saved in History first.')) generate('write'); }}>Redraft chapter</Button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {/* AI panel */}
      {showPanel && (
        <aside className="order-3 min-w-0">
          <div className="xl:sticky xl:top-6">
            <div className="mb-3 grid grid-cols-4 rounded-md border border-line bg-sheet p-1 text-[13px]" role="tablist">
              {([
                ['edit', 'Edit', Sparkles],
                ['controls', 'Controls', SlidersHorizontal],
                ['ask', 'Ask AI', MessageSquare],
                ['history', 'History', History],
              ] as const).map(([k, label, Icon]) => (
                <button key={k} role="tab" aria-selected={panel === k} onClick={() => setPanel(k)} className={clsx('flex items-center justify-center gap-1 rounded py-1.5', panel === k ? 'bg-ink text-white' : 'text-ink-soft hover:bg-ink/5')}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {k === 'edit' && suggestions.length > 0 && <span className="rounded-full bg-gilt px-1.5 text-[11px] text-white">{suggestions.length}</span>}
                </button>
              ))}
            </div>
            {chapter && panel === 'edit' && (
              <EditPanel
                chapterId={chapter.id}
                suggestions={suggestions}
                disabled={!!generating || !content.trim()}
                getSelection={() => edRef.current?.selectionText() ?? ''}
                beforeRun={flush}
                onNew={(s) => setSuggestions((x) => [...x, ...s])}
                onDecide={decide}
                onDecideAll={decideAll}
                onReveal={(t) => { if (!edRef.current?.reveal(t)) toast('That passage has changed, so it can’t be highlighted.'); }}
              />
            )}
            {chapter && panel === 'controls' && (
              <ControlsPanel
                key={chapter.id}
                book={book}
                chapter={chapter}
                busy={!!generating}
                onSaved={(settings, updatedAt) => { baseRef.current = updatedAt; setChapter((c) => (c ? { ...c, settings } : c)); }}
                onGenerate={() => generate('write')}
                hasText={!!content.trim()}
              />
            )}
            {chapter && panel === 'ask' && <AskPanel chapterId={chapter.id} beforeRun={flush} />}
            {chapter && panel === 'history' && (
              <HistoryPanel
                chapterId={chapter.id}
                beforeRun={flush}
                onRestored={(c) => { setContent(c.content); baseRef.current = c.updated_at; setSave('saved'); }}
              />
            )}
          </div>
        </aside>
      )}

      <NotesModal open={notesOpen} onClose={() => setNotesOpen(false)} onGo={(g) => { setNotesOpen(false); generate('write', g); }} />
      <RewriteModal open={rewriteOpen} onClose={() => { setRewriteOpen(false); if (chapter) load(chapter.id); router.refresh(); }} chapters={list} beforeRun={flush} />
      {chapter && (
        <SplitModal
          open={splitOpen}
          chapter={chapter}
          content={content}
          beforeRun={flush}
          onClose={() => setSplitOpen(false)}
          onDone={async (id) => { setSplitOpen(false); await load(chapter.id); await refreshList(id); router.refresh(); }}
        />
      )}
    </div>
  );
}

function DownloadMenu({ bookId, canPrint, beforeRun }: { bookId: string; canPrint: boolean; beforeRun: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const items = [
    ['docx', 'Word (.docx)'],
    ['epub', 'Ebook (.epub)'],
    ...(canPrint ? [['pdf', 'Print PDF']] : []),
    ['md', 'Markdown'],
    ['txt', 'Plain text'],
  ];
  return (
    <div className="relative">
      <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Download className="h-4 w-4" /> Export
      </Button>
      {open && (
        <ul className="absolute right-0 z-30 mt-1 w-44 rounded-md border border-line bg-sheet py-1 text-[14px] shadow-lg" onMouseLeave={() => setOpen(false)}>
          {items.map(([f, label]) => (
            <li key={f}>
              <a
                href={`/api/books/${bookId}/export?format=${f}`}
                onClick={async (e) => { e.preventDefault(); await beforeRun(); setOpen(false); location.href = `/api/books/${bookId}/export?format=${f}`; }}
                className="block px-3 py-1.5 hover:bg-ground"
              >
                {label}
              </a>
            </li>
          ))}
          <li className="border-t border-line">
            <Link href={`/dashboard/books/${bookId}/format`} className="block px-3 py-1.5 text-cloth hover:bg-ground">Layout settings</Link>
          </li>
        </ul>
      )}
    </div>
  );
}

/** The menu that appears next to selected text. */
function SelectionActions({ chapterId, text, beforeRun, onClose, onDecide }: {
  chapterId: string; text: string; beforeRun: () => Promise<void>; onClose: () => void;
  onDecide: (s: Suggestion, status: 'accepted' | 'rejected') => Promise<void>;
}) {
  const toast = useToast();
  const [instruction, setInstruction] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [running, setRunning] = useState('');
  const [result, setResult] = useState<Suggestion | null>(null);
  const actions = Object.entries(EDIT_ACTIONS).filter(([, a]) => a.group === 'selection');

  async function run(action: string) {
    await beforeRun();
    setRunning(action);
    try {
      const r = await api<{ suggestions: Suggestion[]; message?: string }>(`/api/chapters/${chapterId}/suggest`, { body: { action, selection: text, instruction: instruction || undefined } });
      if (!r.suggestions.length) toast(r.message ?? 'No changes needed here.');
      else setResult(r.suggestions[0]);
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setRunning('');
  }

  return (
    <div className="rounded-md border border-line bg-sheet p-2 text-[13px] shadow-xl" role="dialog" aria-label="Edit the selected text">
      {result ? (
        <div className="space-y-2">
          <p className="text-[12px] text-ink-muted">Original</p>
          <p className="max-h-28 overflow-y-auto rounded-sm bg-removed-bg px-2 py-1 text-removed line-through">{result.original}</p>
          <p className="text-[12px] text-ink-muted">Suggested</p>
          <p className="max-h-40 overflow-y-auto rounded-sm bg-added-bg px-2 py-1 text-added">{result.replacement}</p>
          <div className="flex gap-1">
            <Button size="sm" onClick={() => onDecide(result, 'accepted')}><Check className="h-3.5 w-3.5" />Accept</Button>
            <Button size="sm" variant="secondary" onClick={() => onDecide(result, 'rejected')}><X className="h-3.5 w-3.5" />Reject</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            {actions.map(([k, a]) => (
              <Button key={k} size="sm" variant="secondary" loading={running === k} disabled={!!running} onClick={() => run(k)}>{a.label}</Button>
            ))}
          </div>
          {showNote ? (
            <textarea
              className="field mt-2 min-h-[56px] text-[13px]"
              placeholder="How should the AI edit? e.g. “make it more formal”. Leave blank for a general improvement."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
          ) : (
            <button className="mt-1.5 text-[12px] text-cloth underline" onClick={() => setShowNote(true)}>Add an instruction</button>
          )}
          <button className="float-right mt-1.5 text-[12px] text-ink-muted" onClick={onClose}>Close</button>
        </>
      )}
    </div>
  );
}

const LENGTH_LABELS = { short: 'Short (500–800 words)', standard: 'Standard (800–1,500 words)', long: 'Long (1,500–3,000 words)', custom: 'Custom' } as const;

function ControlsPanel({ book, chapter, busy, onSaved, onGenerate, hasText }: {
  book: Book; chapter: Chapter; busy: boolean; onSaved: (s: ChapterSettings, updatedAt: string) => void; onGenerate: () => void; hasText: boolean;
}) {
  const toast = useToast();
  const [s, setS] = useState<ChapterSettings>({ mode: 'full', length: 'standard', formality: 'neutral', sentences: 'varied', ...chapter.settings });
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const set = (patch: Partial<ChapterSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const r = await api<{ updated_at: string }>(`/api/chapters/${chapter.id}`, { method: 'PATCH', body: { settings: next } });
        onSaved(next, r.updated_at);
      } catch (e) {
        toast(errorText(e), 'error');
      }
      setSaving(false);
    }, 500);
  };
  const hasSample = !!book.writing_sample?.trim();

  return (
    <div className="panel space-y-4 p-3 text-[14px]">
      <div className="flex items-center justify-between">
        <h3 className="text-[1rem]">AI controls</h3>
        <span className="text-[12px] text-ink-muted">{saving ? 'Saving…' : 'This chapter only'}</span>
      </div>
      <fieldset>
        <legend className="label">Writing mode</legend>
        <div className="grid gap-1.5">
          {([
            ['full', 'Full draft', 'AI writes the complete chapter'],
            ['assist', 'AI-assisted', 'AI drafts it and leaves [placeholders] for your own stories and details'],
            ['outline', 'Outline only', 'AI writes a detailed plan; you write the chapter'],
          ] as const).map(([k, l, d]) => (
            <label key={k} className={clsx('flex cursor-pointer gap-2 rounded border px-2.5 py-1.5', s.mode === k ? 'border-cloth bg-cloth-light/60' : 'border-line')}>
              <input type="radio" name="mode" className="mt-1 accent-cloth" checked={s.mode === k} onChange={() => set({ mode: k })} />
              <span><span className="block font-medium">{l}</span><span className="text-[12px] text-ink-muted">{d}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Chapter length" htmlFor="len">
        <select id="len" className="field" value={s.length} onChange={(e) => set({ length: e.target.value as ChapterSettings['length'] })}>
          {Object.entries(LENGTH_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      {s.length === 'custom' && (
        <Field label="Target word count" htmlFor="tw">
          <input id="tw" type="number" min={200} max={15000} step={100} className="field" value={s.words ?? 2000} onChange={(e) => set({ words: Number(e.target.value) })} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Formality" htmlFor="fo">
          <select id="fo" className="field" value={s.formality} onChange={(e) => set({ formality: e.target.value as ChapterSettings['formality'] })}>
            <option value="casual">Casual</option><option value="neutral">Neutral</option><option value="formal">Formal</option>
          </select>
        </Field>
        <Field label="Sentences" htmlFor="se">
          <select id="se" className="field" value={s.sentences} onChange={(e) => set({ sentences: e.target.value as ChapterSettings['sentences'] })}>
            <option value="short">Short and punchy</option><option value="varied">Varied</option><option value="long">Long and flowing</option>
          </select>
        </Field>
      </div>
      <Field label="Tone" htmlFor="to"><input id="to" className="field" placeholder={book.tone || 'e.g. Hopeful, tense'} value={s.tone ?? ''} onChange={(e) => set({ tone: e.target.value })} /></Field>
      <Field label="Style" htmlFor="st"><input id="st" className="field" placeholder={book.style || 'e.g. Storytelling, conversational'} value={s.style ?? ''} onChange={(e) => set({ style: e.target.value })} /></Field>
      <Field label="Special instructions" htmlFor="si">
        <textarea id="si" className="field min-h-[70px]" placeholder="Any specific instructions for this chapter…" value={s.instructions ?? ''} onChange={(e) => set({ instructions: e.target.value })} />
      </Field>
      <fieldset className="space-y-1.5">
        <legend className="label">Include in the chapter</legend>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-cloth" checked={!!s.includeSummary} onChange={(e) => set({ includeSummary: e.target.checked })} />Chapter summary</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-cloth" checked={!!s.includeReflection} onChange={(e) => set({ includeReflection: e.target.checked })} />Reflection questions or call to action</label>
        <label className={clsx('flex items-center gap-2', !hasSample && 'opacity-60')}>
          <input type="checkbox" className="accent-cloth" disabled={!hasSample} checked={!!s.useSample && hasSample} onChange={(e) => set({ useSample: e.target.checked })} />
          Write in my style (uses my writing sample)
        </label>
        {!hasSample && (
          <p className="text-[12px] text-ink-muted">
            Add a writing sample in the <Link className="text-cloth underline" href={`/dashboard/books/${book.id}#writing-sample`}>book details</Link> to turn this on.
          </p>
        )}
      </fieldset>
      <Button className="w-full" onClick={onGenerate} disabled={busy}>
        <Sparkles className="h-4 w-4" />
        {s.mode === 'outline' ? 'Plan this chapter' : hasText ? 'Redraft with these settings' : 'Write this chapter'}
      </Button>
      {hasText && s.mode !== 'outline' && <p className="text-[12px] text-ink-muted">Redrafting replaces the current text. It’s saved in History first.</p>}
    </div>
  );
}

function SplitModal({ open, chapter, content, beforeRun, onClose, onDone }: {
  open: boolean; chapter: Chapter; content: string; beforeRun: () => Promise<void>; onClose: () => void; onDone: (newId: string) => void;
}) {
  const toast = useToast();
  const [at, setAt] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const paras = content.split(/\n\s*\n/);
  async function go() {
    if (at === null) return;
    setBusy(true);
    try {
      await beforeRun();
      const r = await api<{ id: string }>(`/api/chapters/${chapter.id}/split`, { body: { at, title } });
      toast('Chapter split in two');
      setAt(null);
      setTitle('');
      onDone(r.id);
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy(false);
  }
  return (
    <Modal open={open} onClose={onClose} title="Split chapter" wide>
      <div className="space-y-4 text-[14px]">
        <p className="text-ink-muted">Click the paragraph that should start the new chapter. Everything from there on moves into a new chapter straight after this one.</p>
        <ol className="max-h-[45vh] space-y-1 overflow-y-auto rounded border border-line p-2">
          {paras.map((p, i) =>
            i === 0 ? (
              <li key={i} className="px-2 py-1 text-ink-faint">{p.slice(0, 140)}{p.length > 140 && '…'}</li>
            ) : (
              <li key={i}>
                <button
                  onClick={() => setAt(i)}
                  className={clsx('w-full rounded px-2 py-1 text-left', at === i ? 'bg-cloth text-white' : at !== null && i > at ? 'bg-cloth-light' : 'hover:bg-ground')}
                >
                  {p.replace(/[*_#>]/g, '').slice(0, 140)}{p.length > 140 && '…'}
                </button>
              </li>
            ),
          )}
        </ol>
        <Field label="Title for the new chapter" htmlFor="nt">
          <input id="nt" className="field" placeholder={`${chapter.title} (continued)`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button onClick={go} loading={busy} disabled={at === null}>Split</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function EditPanel({
  chapterId, suggestions, disabled, getSelection, beforeRun, onNew, onDecide, onDecideAll, onReveal,
}: {
  chapterId: string;
  suggestions: Suggestion[];
  disabled: boolean;
  getSelection: () => string;
  beforeRun: () => Promise<void>;
  onNew: (s: Suggestion[]) => void;
  onDecide: (s: Suggestion, status: 'accepted' | 'rejected') => Promise<void>;
  onDecideAll: (status: 'accepted' | 'rejected') => Promise<void>;
  onReveal: (text: string) => void;
}) {
  const toast = useToast();
  const [running, setRunning] = useState('');
  const [custom, setCustom] = useState('');
  const [bulk, setBulk] = useState(false);

  async function run(action: string, instruction?: string) {
    const selection = getSelection();
    await beforeRun();
    setRunning(action);
    try {
      const r = await api<{ suggestions: Suggestion[]; message?: string }>(`/api/chapters/${chapterId}/suggest`, { body: { action, selection: selection || undefined, instruction } });
      if (!r.suggestions.length) toast(r.message ?? 'No changes suggested.');
      onNew(r.suggestions);
      if (action === 'custom') setCustom('');
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setRunning('');
  }

  const quick = Object.entries(EDIT_ACTIONS).filter(([, a]) => a.group === 'quick');
  const deep = Object.entries(EDIT_ACTIONS).filter(([, a]) => a.group === 'deep');

  return (
    <div className="space-y-4">
      {suggestions.length > 0 && (
        <section className="panel p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[1rem]">Suggested changes</h3>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" loading={bulk} onClick={async () => { setBulk(true); await onDecideAll('accepted'); setBulk(false); }}>Accept all</Button>
              <Button size="sm" variant="ghost" disabled={bulk} onClick={() => onDecideAll('rejected')}>Reject all</Button>
            </div>
          </div>
          <ul className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {suggestions.map((s) => (
              <li key={s.id} className="rounded border border-line p-2.5 text-[14px]">
                <button className="block w-full text-left" onClick={() => onReveal(s.original)} title="Show in text">
                  <span className="block rounded-sm bg-removed-bg px-1 text-removed line-through decoration-removed/60">{truncate(s.original)}</span>
                  <span className="mt-1 block rounded-sm bg-added-bg px-1 text-added">{truncate(s.replacement)}</span>
                </button>
                {s.reason && <p className="mt-1.5 text-[12px] text-ink-muted">{s.reason}</p>}
                <div className="mt-2 flex gap-1">
                  <Button size="sm" onClick={() => onDecide(s, 'accepted')}><Check className="h-3.5 w-3.5" />Accept</Button>
                  <Button size="sm" variant="secondary" onClick={() => onDecide(s, 'rejected')}><X className="h-3.5 w-3.5" />Reject</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel p-3">
        <h3 className="text-[1rem]">Quick edits</h3>
        <p className="mb-2 text-[12px] text-ink-muted">Changes appear as suggestions you accept or reject. Select text first for “expand” and “tighten”.</p>
        <div className="flex flex-wrap gap-1.5">
          {quick.map(([k, a]) => (
            <Button key={k} size="sm" variant="secondary" disabled={disabled || !!running} loading={running === k} onClick={() => run(k)}>{a.label}</Button>
          ))}
        </div>
        <h3 className="mt-4 text-[1rem]">Deep edits</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {deep.map(([k, a]) => (
            <Button key={k} size="sm" variant="secondary" disabled={disabled || !!running} loading={running === k} onClick={() => run(k)}>{a.label}</Button>
          ))}
        </div>
        <form className="mt-4" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) run('custom', custom); }}>
          <label htmlFor="custom" className="label">Your own instruction</label>
          <textarea id="custom" className="field min-h-[70px] text-[14px]" placeholder="e.g. Make the match scene more tense" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <Button type="submit" size="sm" className="mt-2" disabled={disabled || !custom.trim() || !!running} loading={running === 'custom'}>Suggest changes</Button>
        </form>
      </section>
    </div>
  );
}

function truncate(s: string, n = 420) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function AskPanel({ chapterId, beforeRun }: { chapterId: string; beforeRun: () => Promise<void> }) {
  const toast = useToast();
  const [msgs, setMsgs] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    await beforeRun();
    const history = msgs.slice(-10);
    const question = q;
    setMsgs((m) => [...m, { role: 'user', text: question }, { role: 'assistant', text: '' }]);
    setQ('');
    setBusy(true);
    try {
      await stream(`/api/chapters/${chapterId}/ask`, { question, history }, (t) => setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', text: t }]));
    } catch (err) {
      toast(errorText(err), 'error');
      setMsgs((m) => m.slice(0, -1));
    }
    setBusy(false);
  }
  return (
    <div className="panel flex h-[70vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-[14px]">
        {!msgs.length && (
          <p className="text-ink-muted">Ask anything about your book: brainstorm a scene, check a fact, find a better word, or get feedback on this chapter.</p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={clsx('whitespace-pre-wrap rounded-md px-3 py-2', m.role === 'user' ? 'ml-6 bg-cloth-light' : 'mr-2 bg-ground')}>
            {m.text || <span className="text-ink-muted">Thinking…</span>}
            {m.role === 'assistant' && m.text && !busy && (
              <button className="mt-1 block text-[12px] text-cloth underline" onClick={() => navigator.clipboard.writeText(m.text).then(() => toast('Copied'))}>Copy</button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={send} className="border-t border-line p-2">
        <label htmlFor="ask" className="sr-only">Ask AI</label>
        <textarea
          id="ask"
          className="field min-h-[60px] text-[14px]"
          placeholder="Ask about your book…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }}
        />
        <Button type="submit" size="sm" className="mt-2" loading={busy} disabled={!q.trim()}>Send</Button>
      </form>
    </div>
  );
}

type Version = { id: string; label: string; word_count: number; created_at: string };

function HistoryPanel({ chapterId, beforeRun, onRestored }: { chapterId: string; beforeRun: () => Promise<void>; onRestored: (c: { content: string; updated_at: string }) => void }) {
  const toast = useToast();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [preview, setPreview] = useState<{ id: string; content: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => api<{ versions: Version[] }>(`/api/chapters/${chapterId}/versions`).then((r) => setVersions(r.versions)), [chapterId]);
  useEffect(() => { refresh().catch(() => setVersions([])); }, [refresh]);

  async function saveNamed() {
    const label = prompt('Name this version', 'Draft');
    if (!label) return;
    await beforeRun();
    await api(`/api/chapters/${chapterId}/versions`, { body: { label } });
    toast('Version saved');
    refresh();
  }
  async function open(v: Version) {
    const r = await api<{ version: { content: string } }>(`/api/chapters/${chapterId}/versions?version=${v.id}`);
    setPreview({ id: v.id, content: r.version.content, label: v.label });
  }
  async function restore() {
    if (!preview) return;
    setBusy(true);
    try {
      await beforeRun();
      const r = await api<{ chapter: { content: string; updated_at: string } }>(`/api/chapters/${chapterId}/versions`, { body: { restore: preview.id } });
      onRestored(r.chapter);
      toast('Version restored. The text it replaced is saved in History.');
      setPreview(null);
      refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy(false);
  }
  return (
    <div className="panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[1rem]">Saved versions</h3>
        <Button size="sm" variant="secondary" onClick={saveNamed}>Save version</Button>
      </div>
      <p className="mb-2 text-[12px] text-ink-muted">Saved automatically every 15 minutes of writing and before any AI change.</p>
      {versions === null ? (
        <p className="text-[14px] text-ink-muted">Loading…</p>
      ) : versions.length ? (
        <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
          {versions.map((v) => (
            <li key={v.id}>
              <button onClick={() => open(v)} className="flex w-full justify-between gap-2 py-2 text-left text-[14px] hover:text-cloth">
                <span>{v.label}<span className="block text-[12px] text-ink-muted">{new Date(v.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
                <span className="text-[12px] text-ink-muted">{formatNumber(v.word_count)} w</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-ink-muted">No saved versions yet.</p>
      )}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.label ?? ''} wide>
        <div className="manuscript max-h-[55vh] overflow-y-auto whitespace-pre-wrap text-[16px]">{preview?.content}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPreview(null)}>Close</Button>
          <Button onClick={restore} loading={busy}>Restore this version</Button>
        </div>
      </Modal>
    </div>
  );
}

function NotesModal({ open, onClose, onGo }: { open: boolean; onClose: () => void; onGo: (g: string) => void }) {
  const [g, setG] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Notes for this chapter">
      <Field label="What should the AI make sure to include?" htmlFor="notes" hint="Events, facts, quotes you have permission to use, a particular scene or ending.">
        <textarea id="notes" className="field min-h-[140px]" value={g} onChange={(e) => setG(e.target.value)} />
      </Field>
      <Button className="mt-4" onClick={() => onGo(g)} disabled={!g.trim()}><Sparkles className="h-4 w-4" />Write this chapter</Button>
    </Modal>
  );
}

function RewriteModal({ open, onClose, chapters, beforeRun }: { open: boolean; onClose: () => void; chapters: ListItem[]; beforeRun: () => Promise<void> }) {
  const toast = useToast();
  const [instruction, setInstruction] = useState('');
  const [state, setState] = useState<{ index: number; done: number; failed: string[] } | null>(null);
  const stopRef = useRef(false);
  const written = chapters.filter((c) => c.word_count > 0);
  const estTokens = Math.round(written.reduce((s, c) => s + c.word_count, 0) * 1.33 * 2.3);

  async function go() {
    await beforeRun();
    stopRef.current = false;
    const failed: string[] = [];
    for (let i = 0; i < written.length; i++) {
      if (stopRef.current) break;
      setState({ index: i, done: i, failed });
      try {
        await stream(`/api/chapters/${written[i].id}/rewrite`, { instruction }, () => {});
      } catch (e) {
        failed.push(`${written[i].title}: ${errorText(e)}`);
        if (e instanceof ApiError && e.code === 'TOKENS_EXHAUSTED') break;
      }
    }
    setState((s) => (s ? { ...s, done: written.length } : s));
    toast(failed.length ? `Rewrite finished with ${failed.length} problem${failed.length === 1 ? '' : 's'}.` : 'Every chapter was rewritten. Earlier text is saved in each chapter’s History.', failed.length ? 'error' : 'ok');
  }

  const running = state && state.done < written.length && !stopRef.current;
  return (
    <Modal open={open} onClose={() => { if (!running) { setState(null); onClose(); } }} title="Rewrite the whole book">
      {!state ? (
        <div className="space-y-4 text-[14px]">
          <p className="text-ink-muted">
            Claude rewrites each of your {written.length} written chapters in turn, following your instruction. Each chapter’s current text is saved in its History first, so you can undo any of it.
          </p>
          <Field label="Instruction" htmlFor="ri">
            <textarea id="ri" className="field min-h-[110px]" placeholder="e.g. Change the narration to first person, past tense" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
          </Field>
          <p className="text-[13px] text-ink-muted">Uses roughly {formatNumber(estTokens)} AI tokens. Keep this page open while it runs.</p>
          <Button onClick={go} disabled={instruction.trim().length < 3 || !written.length}>Start rewrite</Button>
        </div>
      ) : (
        <div className="space-y-3 text-[14px]">
          <p>
            {state.done >= written.length ? 'Finished.' : `Rewriting chapter ${state.index + 1} of ${written.length}: ${written[state.index]?.title}`}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full bg-cloth" style={{ width: `${(state.done / written.length) * 100}%` }} /></div>
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
