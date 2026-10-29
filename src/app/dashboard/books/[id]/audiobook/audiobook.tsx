'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Download, Lock, Mic, Play, Sparkles, Square, Volume2 } from 'lucide-react';
import { api, ApiError, errorText } from '@/lib/client';
import { VOICES, type VoiceId } from '@/lib/audiobook';
import { QUALITIES, hoursFor, type Quality } from '@/lib/pricing';
import type { NarrationStatus } from '@/lib/narration';
import { compact, formatNumber } from '@/lib/text';
import { Badge, Button, ButtonLink, PageHeader, Progress } from '@/components/ui';
import { useToast } from '@/components/toast';
import { SampleButton, VoiceLibrary, useSamplePlayer, voiceTags, type LibraryVoice } from './voice-library';

type Ch = {
  id: string; position: number; title: string; empty: boolean; chars: number; estMinutes: number; estTokens: number;
  estCredits: Record<Quality, number>;
  track: { path: string; minutes: number; label: string; engine: 'basic' | 'premium'; generated_at: string; url: string | null; outdated: boolean } | null;
};
type Data = {
  engine: 'basic' | 'premium'; voice: VoiceId; premium_voice_id: string | null; premium_voice_name: string | null; quality: Quality;
  premiumVoice: (LibraryVoice & { active: boolean }) | null;
  basicAllowed: boolean; premiumReady: boolean; narration: NarrationStatus; chapters: Ch[];
};

/** Errors that mean narrating the next chapter would fail too, so "narrate all" stops. */
const STOP = ['TOKENS_EXHAUSTED', 'TOKENS_LOW', 'AI_NOT_CONFIGURED', 'NARRATION_CREDITS', 'NARRATION_REQUIRED', 'QUALITY_LOCKED', 'VOICE_REQUIRED', 'VOICE_UNAVAILABLE', 'NARRATION_PROVIDER', 'PLAN_REQUIRED'];
const fmt = (n: number) => n.toLocaleString('en-GB');

export function Audiobook({ bookId }: { bookId: string }) {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [previewing, setPreviewing] = useState<VoiceId | null>(null);
  const [run, setRun] = useState<{ i: number; n: number; current: string } | null>(null);
  const [one, setOne] = useState('');
  const stopRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const player = useSamplePlayer();

  const load = useCallback(async () => setD(await api<Data>(`/api/books/${bookId}/audiobook`)), [bookId]);
  useEffect(() => { load().catch((e) => toast(errorText(e), 'error')); }, [load, toast]);

  const save = async (body: Record<string, unknown>) => {
    await api(`/api/books/${bookId}/audiobook`, { method: 'PUT', body });
    await load();
  };
  const saveOrToast = (body: Record<string, unknown>) => save(body).catch((e) => toast(errorText(e), 'error'));

  async function previewBasic(v: VoiceId) {
    audioRef.current?.pause();
    player.stop();
    setPreviewing(v);
    try {
      const res = await fetch(`/api/books/${bookId}/audiobook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preview: true, voice: v }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Preview failed.');
      const a = new Audio(URL.createObjectURL(await res.blob()));
      audioRef.current = a;
      a.onended = () => setPreviewing(null);
      await a.play();
    } catch (e) {
      toast(errorText(e), 'error');
      setPreviewing(null);
    }
  }

  async function narrateChapter(c: Ch) {
    await api(`/api/books/${bookId}/audiobook`, { body: { chapterId: c.id } });
  }

  async function narrateOne(c: Ch) {
    setOne(c.id);
    try {
      await narrateChapter(c);
      await load();
    } catch (e) {
      toast(errorText(e), 'error');
      await load();
    }
    setOne('');
  }

  async function narrateAll() {
    if (!d) return;
    const todo = d.chapters.filter((c) => !c.empty && (!c.track || c.track.outdated));
    if (!todo.length) return toast('Every chapter is already narrated.');
    stopRef.current = false;
    for (let i = 0; i < todo.length; i++) {
      if (stopRef.current) break;
      setRun({ i, n: todo.length, current: todo[i].title });
      try {
        await narrateChapter(todo[i]);
      } catch (e) {
        toast(`${todo[i].title}: ${errorText(e)}`, 'error');
        if (e instanceof ApiError && STOP.includes(e.code ?? '')) break;
      }
      await load();
    }
    setRun(null);
  }

  async function downloadAll() {
    for (const c of d?.chapters ?? []) {
      if (!c.track?.url) continue;
      const a = document.createElement('a');
      a.href = c.track.url;
      a.download = `${String(c.position).padStart(2, '0')} ${c.title}.mp3`;
      a.target = '_blank';
      a.click();
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  if (!d) return <p className="text-ink-muted">Loading…</p>;
  const n = d.narration;
  const premium = d.engine === 'premium';
  const written = d.chapters.filter((c) => !c.empty);
  const done = written.filter((c) => c.track && !c.track.outdated).length;
  const remaining = written.filter((c) => !c.track || c.track.outdated);
  const minutes = written.reduce((s, c) => s + c.estMinutes, 0);
  const needTokens = remaining.reduce((s, c) => s + c.estTokens, 0);
  const needCredits = remaining.reduce((s, c) => s + c.estCredits[d.quality], 0);
  const short = premium && needCredits > n.available;
  const canRun = premium ? n.canNarrate && !!d.premium_voice_id && d.premiumReady : d.basicAllowed;

  return (
    <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
      <section className="space-y-5">
        <PageHeader title="Audiobook">An AI narrator reads your book aloud, chapter by chapter, as MP3 files.</PageHeader>

        <div role="radiogroup" aria-label="Kind of narrator" className="grid grid-cols-2 gap-2">
          {([
            ['premium', 'Premium voices', 'ElevenLabs library · credits', Sparkles],
            ['basic', 'Basic voices', 'Included with Pro · AI tokens', Mic],
          ] as const).map(([k, title, sub, Icon]) => (
            <button
              key={k}
              role="radio"
              aria-checked={d.engine === k}
              onClick={() => d.engine !== k && saveOrToast({ engine: k })}
              className={clsx('rounded border px-3 py-2.5 text-left', d.engine === k ? 'border-cloth bg-cloth-light/60' : 'border-line bg-sheet hover:border-ink-faint')}
            >
              <span className="flex items-center gap-1.5 font-medium"><Icon className="h-4 w-4 text-cloth" aria-hidden />{title}</span>
              <span className="block text-[12px] text-ink-muted">{sub}</span>
            </button>
          ))}
        </div>

        {premium ? (
          <>
            {!d.premiumReady && <p className="rounded-md border border-gilt/40 bg-gilt-light px-4 py-3 text-[14px]">Premium voices are coming soon. The site owner needs to finish setting up ElevenLabs.</p>}
            {!n.canNarrate && (
              <div className="panel space-y-2 p-4 text-[14px]">
                <h3>Add narration to your account</h3>
                <p className="text-ink-muted">Premium narration needs a narration add-on. Browse the voices and listen to samples now; choose an add-on when you’re ready to narrate.</p>
                <ButtonLink href="/dashboard/billing" size="sm">See narration add-ons</ButtonLink>
              </div>
            )}

            <div>
              <h3 className="mb-2">Narrator</h3>
              {d.premiumVoice ? (
                <div className="panel space-y-2 p-3">
                  <p className="font-medium">{d.premiumVoice.name}</p>
                  <p className="text-[12px] text-ink-muted">{voiceTags(d.premiumVoice).join(' · ')}</p>
                  {d.premiumVoice.description && <p className="line-clamp-3 text-[13px] text-ink-soft">{d.premiumVoice.description}</p>}
                  {!d.premiumVoice.active && <p className="text-[12px] text-gilt-ink">This voice has left the public library. It still works for this book for now; consider choosing another.</p>}
                  <div className="flex gap-2">
                    <SampleButton voice={d.premiumVoice} player={player} />
                    <Button size="sm" variant="secondary" onClick={() => setLibraryOpen(true)}>Change voice</Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setLibraryOpen(true)} disabled={!d.premiumReady}><Volume2 className="h-4 w-4" />Browse the voice library</Button>
              )}
            </div>

            <div>
              <h3 className="mb-2">Quality</h3>
              <ul className="space-y-2" role="radiogroup" aria-label="Narration quality">
                {(['turbo', 'standard'] as Quality[]).map((q) => {
                  const allowed = n.qualities.includes(q) || (q === 'turbo' && !n.canNarrate);
                  return (
                    <li key={q}>
                      <label className={clsx('flex gap-2.5 rounded border px-3 py-2.5 text-[14px]', d.quality === q ? 'border-cloth bg-cloth-light/60' : 'border-line bg-sheet', allowed ? 'cursor-pointer' : 'opacity-70')}>
                        <input type="radio" name="quality" className="mt-1 accent-cloth" checked={d.quality === q} disabled={!allowed} onChange={() => saveOrToast({ quality: q })} />
                        <span>
                          <span className="flex items-center gap-1.5 font-medium">{QUALITIES[q].label}{!allowed && <><Lock className="h-3.5 w-3.5" aria-hidden /><Badge tone="gilt">Narration Pro</Badge></>}</span>
                          <span className="text-[12px] text-ink-muted">{QUALITIES[q].note}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        ) : (
          <div>
            <h3 className="mb-2">Narrator voice</h3>
            {!d.basicAllowed && (
              <div className="panel mb-3 space-y-2 p-4 text-[14px]">
                <p className="text-ink-muted">Basic voices are included with the Pro and Agency plans. Or switch to Premium voices with a narration add-on, on any plan.</p>
                <ButtonLink href="/dashboard/billing" size="sm" variant="secondary">See plans</ButtonLink>
              </div>
            )}
            <ul className={clsx('space-y-2', !d.basicAllowed && 'pointer-events-none opacity-60')} role="radiogroup" aria-label="Narrator voice">
              {(Object.keys(VOICES) as VoiceId[]).map((k) => (
                <li key={k} className={clsx('flex items-center gap-3 rounded border px-3 py-2.5', d.voice === k ? 'border-cloth bg-cloth-light/60' : 'border-line bg-sheet')}>
                  <label className="flex flex-1 cursor-pointer gap-2.5 text-[14px]">
                    <input type="radio" name="voice" className="mt-1 accent-cloth" checked={d.voice === k} onChange={() => saveOrToast({ voice: k })} />
                    <span><span className="block font-medium">{VOICES[k].label}</span><span className="text-[12px] text-ink-muted">{VOICES[k].note}</span></span>
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => (previewing === k ? (audioRef.current?.pause(), setPreviewing(null)) : previewBasic(k))} aria-label={`Listen to ${VOICES[k].label}`}>
                    {previewing === k ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-ink-muted">Each sample reads the opening of your first chapter and uses a few AI tokens.</p>
          </div>
        )}

        <div className="panel space-y-3 p-4 text-[14px]">
          <div className="flex justify-between"><span>Chapters narrated</span><span>{done} of {written.length}</span></div>
          <Progress value={(done / Math.max(1, written.length)) * 100} label="Chapters narrated" />
          <p className="text-ink-muted">
            About {minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`} of audio in total.
            {remaining.length > 0 && (premium ? ` Narrating the rest uses about ${fmt(needCredits)} credits in ${QUALITIES[d.quality].label}.` : ` Narrating the rest uses about ${compact(needTokens)} AI tokens.`)}
          </p>
          {premium && n.canNarrate && (
            <p className={clsx(short ? 'text-danger' : 'text-ink-muted')}>
              You have {fmt(n.available)} credits ({hoursFor(n.available, d.quality)} in {QUALITIES[d.quality].label}).
              {short && ' That’s not enough for every chapter left: narration stops when credits run out.'}{' '}
              <a href="/dashboard/billing" className="underline">{short ? 'Buy a top-up' : 'Manage credits'}</a>
            </p>
          )}
          {run ? (
            <>
              <p aria-live="polite">Narrating chapter {run.i + 1} of {run.n}: {run.current}. Keep this page open.</p>
              <Button variant="secondary" onClick={() => { stopRef.current = true; }}>Stop after this chapter</Button>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={narrateAll} disabled={!remaining.length || !!one || !canRun}>{!remaining.length ? 'Every chapter is narrated' : done ? `Narrate the ${remaining.length} remaining` : 'Narrate the whole book'}</Button>
              {done > 0 && <Button variant="secondary" onClick={downloadAll}><Download className="h-4 w-4" />Download all</Button>}
            </div>
          )}
        </div>
        <p className="text-[12px] text-ink-muted">
          Stores have different rules for AI-narrated audiobooks, and some don’t accept them. Our publishing team confirms which stores can take your audiobook when you submit it.
        </p>
      </section>

      <section>
        <h2 className="mb-3">Chapters</h2>
        <ul className="panel divide-y divide-line">
          {d.chapters.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="w-6 font-serif text-ink-faint">{c.position}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.title}</p>
                <p className="text-[12px] text-ink-muted">
                  {c.empty
                    ? 'No text yet'
                    : c.track
                      ? `${c.track.minutes} min · ${c.track.label}`
                      : `About ${c.estMinutes} min · ${premium ? `${fmt(c.estCredits[d.quality])} credits` : `${formatNumber(c.chars)} characters`}`}
                </p>
              </div>
              {c.track?.outdated && <Badge tone="gilt">Outdated</Badge>}
              {c.track && !c.track.outdated && <Badge tone="cloth">Narrated</Badge>}
              {c.track?.url && <audio controls preload="none" src={c.track.url} className="h-9 w-full sm:w-72" />}
              {!c.empty && (
                <Button size="sm" variant={c.track ? 'ghost' : 'secondary'} onClick={() => narrateOne(c)} loading={one === c.id} disabled={!!run || (!!one && one !== c.id) || !canRun}>
                  <Play className="h-3.5 w-3.5" />{c.track ? 'Re-narrate' : 'Narrate'}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-ink-muted">“Outdated” means the chapter text, the narrator or the quality changed after it was narrated. If narration fails, the credits are given back.</p>
      </section>

      <VoiceLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        selected={d.premium_voice_id}
        onChoose={async (v) => {
          await save({ premiumVoiceId: v.voice_id, engine: 'premium' });
          toast(`${v.name} will narrate this book`);
        }}
      />
    </div>
  );
}
