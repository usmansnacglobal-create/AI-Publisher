'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Download, Play, Square, Volume2 } from 'lucide-react';
import { api, ApiError, errorText } from '@/lib/client';
import { VOICES, type VoiceId } from '@/lib/audiobook';
import { compact, formatNumber } from '@/lib/text';
import { Badge, Button, PageHeader, Progress } from '@/components/ui';
import { useToast } from '@/components/toast';

type Ch = {
  id: string; position: number; title: string; empty: boolean; chars: number; estMinutes: number; estTokens: number;
  track: { path: string; minutes: number; voice: string; generated_at: string; url: string | null; outdated: boolean } | null;
};

export function Audiobook({ bookId }: { bookId: string }) {
  const toast = useToast();
  const [voice, setVoice] = useState<VoiceId>('american_female');
  const [chapters, setChapters] = useState<Ch[] | null>(null);
  const [previewing, setPreviewing] = useState<VoiceId | null>(null);
  const [run, setRun] = useState<{ i: number; n: number; current: string } | null>(null);
  const [one, setOne] = useState('');
  const stopRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ voice: VoiceId; chapters: Ch[] }>(`/api/books/${bookId}/audiobook`);
    setVoice(r.voice);
    setChapters(r.chapters);
  }, [bookId]);
  useEffect(() => { load().catch((e) => toast(errorText(e), 'error')); }, [load, toast]);

  async function chooseVoice(v: VoiceId) {
    setVoice(v);
    await api(`/api/books/${bookId}/audiobook`, { method: 'PUT', body: { voice: v } }).catch((e) => toast(errorText(e), 'error'));
    load();
  }

  async function preview(v: VoiceId) {
    audioRef.current?.pause();
    setPreviewing(v);
    try {
      const res = await fetch(`/api/books/${bookId}/audiobook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preview: true, voice: v }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Preview failed.');
      const url = URL.createObjectURL(await res.blob());
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => setPreviewing(null);
      await a.play();
    } catch (e) {
      toast(errorText(e), 'error');
      setPreviewing(null);
    }
  }

  async function narrateOne(c: Ch) {
    setOne(c.id);
    try {
      await api(`/api/books/${bookId}/audiobook`, { body: { chapterId: c.id } });
      await load();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setOne('');
  }

  async function narrateAll() {
    if (!chapters) return;
    const todo = chapters.filter((c) => !c.empty && (!c.track || c.track.outdated));
    if (!todo.length) return toast('Every chapter is already narrated.');
    stopRef.current = false;
    for (let i = 0; i < todo.length; i++) {
      if (stopRef.current) break;
      setRun({ i, n: todo.length, current: todo[i].title });
      try {
        await api(`/api/books/${bookId}/audiobook`, { body: { chapterId: todo[i].id } });
      } catch (e) {
        toast(`${todo[i].title}: ${errorText(e)}`, 'error');
        if (e instanceof ApiError && ['TOKENS_EXHAUSTED', 'TOKENS_LOW', 'AI_NOT_CONFIGURED'].includes(e.code ?? '')) break;
      }
      await load();
    }
    setRun(null);
  }

  async function downloadAll() {
    for (const c of chapters ?? []) {
      if (!c.track?.url) continue;
      const a = document.createElement('a');
      a.href = c.track.url;
      a.download = `${String(c.position).padStart(2, '0')} ${c.title}.mp3`;
      a.target = '_blank';
      a.click();
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  if (!chapters) return <p className="text-ink-muted">Loading…</p>;
  const written = chapters.filter((c) => !c.empty);
  const done = written.filter((c) => c.track && !c.track.outdated).length;
  const remaining = written.filter((c) => !c.track || c.track.outdated);
  const minutes = written.reduce((s, c) => s + c.estMinutes, 0);
  const tokens = remaining.reduce((s, c) => s + c.estTokens, 0);

  return (
    <div className="grid gap-10 lg:grid-cols-[360px_1fr]">
      <section className="space-y-4">
        <PageHeader title="Audiobook">An AI narrator reads your book aloud, chapter by chapter, as MP3 files.</PageHeader>
        <div>
          <h3 className="mb-2">Narrator voice</h3>
          <ul className="space-y-2" role="radiogroup" aria-label="Narrator voice">
            {(Object.keys(VOICES) as VoiceId[]).map((k) => (
              <li key={k} className={clsx('flex items-center gap-3 rounded border px-3 py-2.5', voice === k ? 'border-cloth bg-cloth-light/60' : 'border-line bg-sheet')}>
                <label className="flex flex-1 cursor-pointer gap-2.5 text-[14px]">
                  <input type="radio" name="voice" className="mt-1 accent-cloth" checked={voice === k} onChange={() => chooseVoice(k)} />
                  <span><span className="block font-medium">{VOICES[k].label}</span><span className="text-[12px] text-ink-muted">{VOICES[k].note}</span></span>
                </label>
                <Button size="sm" variant="ghost" onClick={() => (previewing === k ? (audioRef.current?.pause(), setPreviewing(null)) : preview(k))} aria-label={`Listen to ${VOICES[k].label}`}>
                  {previewing === k ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-4 w-4" />}
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-ink-muted">Each sample reads the opening of your first chapter and uses a few AI tokens.</p>
        </div>
        <div className="panel space-y-3 p-4 text-[14px]">
          <div className="flex justify-between"><span>Chapters narrated</span><span>{done} of {written.length}</span></div>
          <Progress value={(done / Math.max(1, written.length)) * 100} label="Chapters narrated" />
          <p className="text-ink-muted">About {minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`} of audio in total.{remaining.length > 0 && ` Narrating the rest uses about ${compact(tokens)} AI tokens.`}</p>
          {run ? (
            <>
              <p aria-live="polite">Narrating chapter {run.i + 1} of {run.n}: {run.current}. Keep this page open.</p>
              <Button variant="secondary" onClick={() => { stopRef.current = true; }}>Stop after this chapter</Button>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={narrateAll} disabled={!remaining.length || !!one}>{!remaining.length ? 'Every chapter is narrated' : done ? `Narrate the ${remaining.length} remaining` : 'Narrate the whole book'}</Button>
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
          {chapters.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="w-6 font-serif text-ink-faint">{c.position}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.title}</p>
                <p className="text-[12px] text-ink-muted">
                  {c.empty ? 'No text yet' : c.track ? `${c.track.minutes} min · ${VOICES[c.track.voice as VoiceId]?.label ?? c.track.voice}` : `About ${c.estMinutes} min · ${formatNumber(c.chars)} characters`}
                </p>
              </div>
              {c.track?.outdated && <Badge tone="gilt">Outdated</Badge>}
              {c.track && !c.track.outdated && <Badge tone="cloth">Narrated</Badge>}
              {c.track?.url && <audio controls preload="none" src={c.track.url} className="h-9 w-full sm:w-72" />}
              {!c.empty && (
                <Button size="sm" variant={c.track ? 'ghost' : 'secondary'} onClick={() => narrateOne(c)} loading={one === c.id} disabled={!!run || (!!one && one !== c.id)}>
                  <Play className="h-3.5 w-3.5" />{c.track ? 'Re-narrate' : 'Narrate'}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-ink-muted">“Outdated” means the chapter text or the voice changed after it was narrated.</p>
      </section>
    </div>
  );
}
