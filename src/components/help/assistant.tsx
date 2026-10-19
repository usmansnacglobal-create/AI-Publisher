'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { ArrowRight, BookOpen, CheckCircle2, ChevronDown, LifeBuoy, MessageCircle, Send, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { articlesForPath, getArticle, type HelpArticle } from '@/lib/help';
import { rank, reply, type BotReply } from '@/lib/help/search';
import { Button } from '@/components/ui';
import { Inline, RichText } from './rich-text';
import { sendHelpFeedback } from './centre-client';
import { useBrand } from '@/components/brand-context';
import { brandify } from '@/lib/brand';

type Msg =
  | { id: number; from: 'user'; text: string }
  | { id: number; from: 'bot'; reply: BotReply; question?: string; vote?: boolean };

const STORE = 'ap-help-chat';
const STARTERS = ['create-book-wizard', 'writing-modes', 'cover-overview', 'publish-overview', 'tokens-explained', 'themes'];
const TOPICS = ['Writing and AI', 'Cover design', 'Layout and downloads', 'Audiobook', 'Publishing', 'Plans and billing', 'My account', 'Something isn’t working', 'Other'];

let nextId = 1;

export function HelpAssistant({ signedIn }: { signedIn: boolean }) {
  const brand = useBrand();
  const path = usePathname() ?? '/';
  const base = signedIn && path.startsWith('/dashboard') ? '/dashboard/help' : '/help';
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'chat' | 'contact'>('chat');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  // Keep the conversation while the author moves between pages.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) ?? 'null') as { msgs: Msg[] } | null;
      if (saved?.msgs?.length) {
        // Articles are stored by slug and looked up again, so content is always current.
        setMsgs(saved.msgs.map(revive).filter(Boolean) as Msg[]);
        nextId = Math.max(...saved.msgs.map((m) => m.id)) + 1;
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ msgs: msgs.slice(-40) }));
    } catch {}
  }, [msgs]);

  const ask = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      const r = reply(q, path);
      setMsgs((m) => [...m, { id: nextId++, from: 'user', text: q }, { id: nextId++, from: 'bot', reply: r, question: q }]);
      if (r.kind === 'none' && signedIn) sendHelpFeedback({ kind: 'unanswered', question: q.slice(0, 500) });
      if (r.kind === 'text' && r.contact) setMode('chat');
    },
    [path, signedIn],
  );

  const showArticle = (a: HelpArticle, question?: string) =>
    setMsgs((m) => [...m, { id: nextId++, from: 'bot', reply: { kind: 'answer', article: a, also: [] }, question }]);

  // Other parts of the app (Help Centre buttons, search) can open the assistant.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ mode?: 'chat' | 'contact'; question?: string }>).detail ?? {};
      setOpen(true);
      setMode(d.mode ?? 'chat');
      if (d.question) ask(d.question);
    };
    window.addEventListener('ap-help', onOpen);
    return () => window.removeEventListener('ap-help', onOpen);
  }, [ask]);

  useEffect(() => {
    if (open && mode === 'chat') setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, mode]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, open]);

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  const here = articlesForPath(path, 4);
  const starters = (here.length ? here : STARTERS.map((s) => getArticle(s)!)).slice(0, 4);

  return (
    <>
      <button
        ref={launcherRef}
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls="help-assistant"
        className={clsx(
          'fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-cloth px-4 py-2.5 text-[14px] font-medium text-white shadow-lg hover:bg-cloth-dark print:hidden',
          open && 'max-sm:hidden',
        )}
      >
        {open ? <X className="h-4 w-4" aria-hidden /> : <MessageCircle className="h-4 w-4" aria-hidden />}
        {open ? 'Close help' : 'Help'}
      </button>

      {open && (
        <section
          id="help-assistant"
          role="dialog"
          aria-label="Help assistant"
          onKeyDown={(e) => e.key === 'Escape' && close()}
          className="fixed inset-x-2 bottom-2 top-16 z-50 flex flex-col overflow-hidden rounded-lg border border-line bg-sheet shadow-2xl sm:inset-x-auto sm:bottom-16 sm:right-4 sm:top-auto sm:h-[min(620px,calc(100vh-6rem))] sm:w-[400px]"
        >
          <header className="flex items-start justify-between gap-2 border-b border-line bg-cloth px-4 py-3 text-white">
            <div>
              <h2 className="font-sans text-[15px] font-semibold text-white">{mode === 'contact' ? 'Contact support' : 'Help assistant'}</h2>
              <p className="text-[12px] opacity-80">{mode === 'contact' ? 'We’ll reply by email or in your notifications.' : 'Answers from our guides. Doesn’t use your AI tokens.'}</p>
            </div>
            <div className="flex items-center gap-1">
              <Link href={base} className="rounded p-1.5 hover:bg-white/15" title="Open the Help Centre" aria-label="Open the Help Centre"><BookOpen className="h-4 w-4" /></Link>
              <button onClick={close} className="rounded p-1.5 hover:bg-white/15" aria-label="Close help"><X className="h-4 w-4" /></button>
            </div>
          </header>

          {mode === 'contact' ? (
            <ContactForm signedIn={signedIn} path={path} onBack={() => setMode('chat')} lastQuestion={[...msgs].reverse().find((m): m is Extract<Msg, { from: 'user' }> => m.from === 'user')?.text} />
          ) : (
            <>
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4" aria-live="polite">
                <BotBubble>
                  <p>Hi! I can help you find your way around {brand.name}. Type a question, or pick one below.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {starters.map((a) => (
                      <button key={a.slug} onClick={() => setMsgs((m) => [...m, { id: nextId++, from: 'user', text: a.title }, { id: nextId++, from: 'bot', reply: { kind: 'answer', article: a, also: [] } }])} className="rounded-full border border-line bg-sheet px-2.5 py-1 text-left text-[12.5px] text-ink-soft hover:border-cloth hover:text-cloth">
                        {a.title}
                      </button>
                    ))}
                  </div>
                </BotBubble>
                {msgs.map((m) =>
                  m.from === 'user' ? (
                    <div key={m.id} className="flex justify-end">
                      <p className="max-w-[85%] rounded-lg rounded-br-sm bg-cloth px-3 py-2 text-[14px] text-white">{m.text}</p>
                    </div>
                  ) : (
                    <BotMessage
                      key={m.id}
                      msg={m}
                      base={base}
                      onPick={(a) => showArticle(a, m.question)}
                      onContact={() => setMode('contact')}
                      onVote={(v) => {
                        setMsgs((all) => all.map((x) => (x.id === m.id && x.from === 'bot' ? { ...x, vote: v } : x)));
                        if (signedIn && m.reply.kind === 'answer') sendHelpFeedback({ kind: 'answer', slug: m.reply.article.slug, question: m.question?.slice(0, 500), helpful: v });
                      }}
                    />
                  ),
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(input);
                  setInput('');
                }}
                className="border-t border-line p-2"
              >
                <div className="flex items-end gap-2">
                  <label htmlFor="help-input" className="sr-only">Your question</label>
                  <textarea
                    id="help-input"
                    ref={inputRef}
                    rows={1}
                    value={input}
                    maxLength={500}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        ask(input);
                        setInput('');
                      }
                    }}
                    placeholder="Ask a question…"
                    className="field max-h-28 min-h-[40px] resize-none"
                  />
                  <Button type="submit" aria-label="Send" disabled={!input.trim()} className="h-10 w-10 shrink-0 px-0"><Send className="h-4 w-4" /></Button>
                </div>
                <div className="mt-1.5 flex items-center justify-between px-1 text-[12px] text-ink-muted">
                  <button type="button" onClick={() => setMode('contact')} className="flex items-center gap-1 hover:text-cloth"><LifeBuoy className="h-3.5 w-3.5" aria-hidden />Contact support</button>
                  {msgs.length > 0 && <button type="button" onClick={() => setMsgs([])} className="hover:text-ink">Clear chat</button>}
                </div>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
}

function revive(m: Msg): Msg | null {
  if (m.from === 'user') return m;
  const r = m.reply as BotReply & { article?: { slug: string }; also?: { slug: string }[]; options?: { slug: string }[] };
  const get = (x?: { slug: string }) => (x ? getArticle(x.slug) : undefined);
  if (r.kind === 'answer') {
    const a = get(r.article);
    if (!a) return null;
    return { ...m, reply: { kind: 'answer', article: a, also: (r.also ?? []).map(get).filter(Boolean) as HelpArticle[] } };
  }
  if (r.kind === 'unsure') return { ...m, reply: { kind: 'unsure', options: (r.options ?? []).map(get).filter(Boolean) as HelpArticle[] } };
  if (r.kind === 'text') return { ...m, reply: { ...r, options: (r.options ?? []).map(get).filter(Boolean) as HelpArticle[] } };
  return m;
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[92%] rounded-lg rounded-bl-sm border border-line bg-ground/60 px-3 py-2 text-[14px] text-ink">{children}</div>;
}

function BotMessage({ msg, base, onPick, onContact, onVote }: { msg: Extract<Msg, { from: 'bot' }>; base: string; onPick: (a: HelpArticle) => void; onContact: () => void; onVote: (v: boolean) => void }) {
  const brand = useBrand().name;
  const r = msg.reply;
  const [steps, setSteps] = useState(false);
  if (r.kind === 'text')
    return (
      <BotBubble>
        <p>{brandify(r.text, brand)}</p>
        {r.contact && <Button size="sm" className="mt-2" onClick={onContact}>Message our team</Button>}
      </BotBubble>
    );
  if (r.kind === 'none')
    return (
      <BotBubble>
        <p>Sorry, I couldn’t find an answer to that. Try asking in different words, browse the <Link href={base} className="text-cloth underline">Help Centre</Link>, or message our support team.</p>
        <Button size="sm" variant="secondary" className="mt-2" onClick={onContact}>Contact support</Button>
      </BotBubble>
    );
  if (r.kind === 'unsure')
    return (
      <BotBubble>
        <p>I’m not completely sure what you mean. Is it one of these?</p>
        <div className="mt-2 space-y-1.5">
          {r.options.map((a) => (
            <button key={a.slug} onClick={() => onPick(a)} className="flex w-full items-center justify-between gap-2 rounded-md border border-line bg-sheet px-2.5 py-2 text-left text-[13.5px] hover:border-cloth">
              <span><span className="block font-medium text-ink">{a.title}</span><span className="block text-[12.5px] text-ink-muted">{a.summary}</span></span>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
            </button>
          ))}
        </div>
        <button onClick={onContact} className="mt-2 text-[13px] text-cloth underline">None of these: contact support</button>
      </BotBubble>
    );

  const a = r.article;
  const more = msg.vote === false ? rank(msg.question ?? a.title).map((x) => x.article).filter((x) => x.slug !== a.slug).slice(0, 3) : [];
  return (
    <BotBubble>
      <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">{a.title}</p>
      <p><Inline text={brandify(a.answer, brand)} /></p>
      <button onClick={() => setSteps((s) => !s)} aria-expanded={steps} className="mt-2 flex items-center gap-1 text-[13px] font-medium text-cloth">
        <ChevronDown className={clsx('h-4 w-4 transition-transform', steps && 'rotate-180')} aria-hidden />
        {steps ? 'Hide the details' : 'Show the step-by-step guide'}
      </button>
      {steps && (
        <div className="mt-2 rounded-md border border-line bg-sheet p-3">
          <RichText body={brandify(a.body, brand)} compact />
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {a.action && <Link href={a.action.href} className="inline-flex items-center gap-1 rounded bg-cloth px-2.5 py-1 text-[13px] font-medium text-white hover:bg-cloth-dark">{a.action.label}<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>}
        <Link href={`${base}/${a.slug}`} className="inline-flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-[13px] text-ink hover:border-ink-faint">Open full guide</Link>
      </div>
      {r.also.length > 0 && (
        <div className="mt-3">
          <p className="text-[12px] text-ink-muted">Related</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {r.also.map((x) => <button key={x.slug} onClick={() => onPick(x)} className="rounded-full border border-line bg-sheet px-2.5 py-0.5 text-[12.5px] text-ink-soft hover:border-cloth hover:text-cloth">{x.title}</button>)}
          </div>
        </div>
      )}
      <div className="mt-3 border-t border-line pt-2 text-[12.5px] text-ink-muted">
        {msg.vote === undefined ? (
          <div className="flex items-center gap-2">
            <span>Did this answer your question?</span>
            <button onClick={() => onVote(true)} className="rounded p-1 hover:bg-ink/5 hover:text-cloth" aria-label="Yes, it helped"><ThumbsUp className="h-4 w-4" /></button>
            <button onClick={() => onVote(false)} className="rounded p-1 hover:bg-ink/5 hover:text-danger" aria-label="No, it didn’t help"><ThumbsDown className="h-4 w-4" /></button>
          </div>
        ) : msg.vote ? (
          <p className="flex items-center gap-1 text-cloth"><CheckCircle2 className="h-4 w-4" aria-hidden />Great, glad that helped.</p>
        ) : (
          <div>
            <p>Sorry. Maybe one of these?</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {more.map((x) => <button key={x.slug} onClick={() => onPick(x)} className="rounded-full border border-line bg-sheet px-2.5 py-0.5 text-[12.5px] text-ink-soft hover:border-cloth hover:text-cloth">{x.title}</button>)}
            </div>
            <button onClick={onContact} className="mt-1.5 text-cloth underline">Or contact support</button>
          </div>
        )}
      </div>
    </BotBubble>
  );
}

function ContactForm({ signedIn, path, onBack, lastQuestion }: { signedIn: boolean; path: string; onBack: () => void; lastQuestion?: string }) {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState(lastQuestion ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | string>('idle');

  if (!signedIn)
    return (
      <div className="flex-1 space-y-3 p-4 text-[14px]">
        <p>To message our support team, please sign in first so we can find your account and books.</p>
        <p className="text-ink-muted">Can’t sign in? Try <Link href="/forgot-password" className="text-cloth underline">resetting your password</Link>, or ask the assistant about confirmation emails.</p>
        <div className="flex gap-2">
          <Link href={`/login?next=${encodeURIComponent(path)}`} className="inline-flex h-9 items-center rounded bg-cloth px-3 text-[14px] font-medium text-white hover:bg-cloth-dark">Sign in</Link>
          <Button size="sm" variant="ghost" onClick={onBack} className="h-9">Back to the assistant</Button>
        </div>
      </div>
    );

  if (state === 'sent')
    return (
      <div className="flex-1 space-y-3 p-4 text-[14px]">
        <p className="flex items-center gap-2 font-medium text-cloth"><CheckCircle2 className="h-5 w-5" aria-hidden />Message sent</p>
        <p className="text-ink-soft">Thanks. Our team has your message and will reply by email or in your notifications.</p>
        <Button size="sm" variant="secondary" onClick={onBack}>Back to the assistant</Button>
      </div>
    );

  return (
    <form
      className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 text-[14px]"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('sending');
        try {
          const res = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, message, page: path }) });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error ?? 'Couldn’t send your message. Please try again.');
          setState('sent');
        } catch (err) {
          setState(err instanceof Error ? err.message : 'Couldn’t send your message.');
        }
      }}
    >
      <div>
        <label htmlFor="support-topic" className="label">What’s it about?</label>
        <select id="support-topic" className="field" value={topic} onChange={(e) => setTopic(e.target.value)}>
          {TOPICS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex flex-1 flex-col">
        <label htmlFor="support-message" className="label">Your message</label>
        <textarea id="support-message" className="field min-h-[140px] flex-1" value={message} maxLength={4000} onChange={(e) => setMessage(e.target.value)} placeholder="What do you need help with? Include the book title and what you clicked if something went wrong." required />
        <p className="hint">We’ll include the page you’re on so we can help faster.</p>
      </div>
      {state !== 'idle' && state !== 'sending' && <p className="text-danger">{state}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={state === 'sending'} disabled={message.trim().length < 10}>Send</Button>
        <Button type="button" variant="ghost" onClick={onBack}>Back</Button>
      </div>
    </form>
  );
}
