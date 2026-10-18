'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageCircle, Search, ThumbsDown, ThumbsUp } from 'lucide-react';
import { searchHelp } from '@/lib/help/search';
import { Button } from '@/components/ui';

/** Opens the help assistant from anywhere on the page. */
export function openAssistant(detail: { mode?: 'chat' | 'contact'; question?: string } = {}) {
  window.dispatchEvent(new CustomEvent('ap-help', { detail }));
}

/** Sends feedback for the team. Quietly ignored when signed out or offline. */
export function sendHelpFeedback(body: { kind: 'article' | 'answer' | 'unanswered'; slug?: string; question?: string; helpful?: boolean }) {
  fetch('/api/help/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
}

export function HelpSearch({ base }: { base: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => (q.trim().length >= 2 ? searchHelp(q, 7) : []), [q]);
  const [show, setShow] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setShow(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const open = show && q.trim().length >= 2;
  return (
    <div ref={box} className="relative text-left">
      <label htmlFor="help-search" className="sr-only">Search the help guides</label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" aria-hidden />
      <input
        id="help-search"
        type="search"
        autoComplete="off"
        value={q}
        onChange={(e) => { setQ(e.target.value); setShow(true); }}
        onFocus={() => setShow(true)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter') {
            e.preventDefault();
            if (results[active]) router.push(`${base}/${results[active].slug}`);
            else openAssistant({ question: q });
          }
          if (e.key === 'Escape') setShow(false);
        }}
        placeholder="Search, e.g. “change the font” or “cancel my plan”"
        className="field h-12 rounded-md pl-11 text-[16px]"
        role="combobox"
        aria-expanded={open}
        aria-controls="help-search-results"
      />
      {open && (
        <div id="help-search-results" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-line bg-sheet shadow-lg">
          {results.map((a, i) => (
            <Link
              key={a.slug}
              href={`${base}/${a.slug}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              className={`block px-4 py-2.5 ${i === active ? 'bg-cloth-light' : ''}`}
            >
              <span className="block text-[14px] font-medium text-ink">{a.title}</span>
              <span className="block truncate text-[13px] text-ink-muted">{a.summary}</span>
            </Link>
          ))}
          <button
            role="option"
            aria-selected={active === results.length}
            onMouseEnter={() => setActive(results.length)}
            onClick={() => openAssistant({ question: q })}
            className={`flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-[14px] text-cloth ${active === results.length ? 'bg-cloth-light' : ''}`}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            {results.length ? 'Not what you need? Ask the help assistant' : 'No guides match. Ask the help assistant'}
          </button>
        </div>
      )}
    </div>
  );
}

export function ArticleFeedback({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const [vote, setVote] = useState<null | boolean>(null);
  return (
    <div className="mt-10 rounded-md border border-line px-4 py-3 text-[14px]" aria-live="polite">
      {vote === null ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-ink-soft">Was this guide helpful?</span>
          <Button size="sm" variant="secondary" onClick={() => { setVote(true); if (signedIn) sendHelpFeedback({ kind: 'article', slug, helpful: true }); }}><ThumbsUp className="h-4 w-4" aria-hidden />Yes</Button>
          <Button size="sm" variant="secondary" onClick={() => { setVote(false); if (signedIn) sendHelpFeedback({ kind: 'article', slug, helpful: false }); }}><ThumbsDown className="h-4 w-4" aria-hidden />No</Button>
        </div>
      ) : vote ? (
        <p className="text-ink-soft">Thanks for letting us know.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-soft">Sorry about that. Tell us what you were looking for and we’ll help.</p>
          <Button size="sm" onClick={() => openAssistant({ mode: 'contact' })}>Contact support</Button>
        </div>
      )}
    </div>
  );
}

export function AskButtons() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => openAssistant()}><MessageCircle className="h-4 w-4" aria-hidden />Ask the assistant</Button>
      <Button size="sm" variant="secondary" onClick={() => openAssistant({ mode: 'contact' })}>Contact support</Button>
    </div>
  );
}

