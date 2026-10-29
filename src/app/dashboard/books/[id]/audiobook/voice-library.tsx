'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Check, Search, Square, Volume2 } from 'lucide-react';
import { api, errorText } from '@/lib/client';
import { Badge, Button, Modal } from '@/components/ui';
import { useToast } from '@/components/toast';

export type LibraryVoice = {
  voice_id: string; name: string; description: string; use_case: string; gender: string; age: string;
  accent: string; language: string; descriptive: string; featured: boolean; has_preview: boolean;
};
type Facet = { value: string; n: number; label?: string };
type Facets = { libraries: Facet[]; genders: Facet[]; accents: Facet[]; ages: Facet[]; languages: Facet[]; total: number };
type Page = { ready: boolean; voices: LibraryVoice[]; total: number; page: number; pageSize: number; facets: Facets | null; refreshedAt: string | null };

const nice = (s: string) => s.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const LANGS: Record<string, string> = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', pl: 'Polish', hi: 'Hindi', ar: 'Arabic', ja: 'Japanese', zh: 'Chinese', nl: 'Dutch', tr: 'Turkish', sv: 'Swedish', ko: 'Korean' };

/** One shared player, so starting a sample stops the one before it. */
export function useSamplePlayer() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const toast = useToast();
  const stop = useCallback(() => {
    audio.current?.pause();
    setPlaying(null);
  }, []);
  const play = useCallback(
    async (voiceId: string) => {
      audio.current?.pause();
      if (playing === voiceId) return setPlaying(null);
      const a = new Audio(`/api/narration/voices/${encodeURIComponent(voiceId)}/preview`);
      audio.current = a;
      setLoading(voiceId);
      a.onended = () => setPlaying(null);
      try {
        await a.play();
        setPlaying(voiceId);
      } catch {
        toast('That sample couldn’t play. Try another voice.', 'error');
      }
      setLoading(null);
    },
    [playing, toast],
  );
  useEffect(() => () => audio.current?.pause(), []);
  return { play, stop, playing, loading };
}

export function SampleButton({ voice, player, size = 'sm' }: { voice: Pick<LibraryVoice, 'voice_id' | 'name' | 'has_preview'>; player: ReturnType<typeof useSamplePlayer>; size?: 'sm' | 'md' }) {
  if (!voice.has_preview) return null;
  const on = player.playing === voice.voice_id;
  return (
    <Button size={size} variant="secondary" onClick={() => player.play(voice.voice_id)} loading={player.loading === voice.voice_id} aria-label={`${on ? 'Stop' : 'Play'} ${voice.name}'s sample`}>
      {on ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-4 w-4" />}
      {on ? 'Stop' : 'Sample'}
    </Button>
  );
}

export function voiceTags(v: Pick<LibraryVoice, 'gender' | 'age' | 'accent' | 'language' | 'descriptive'>) {
  return [v.accent && nice(v.accent), v.gender && nice(v.gender), v.age && nice(v.age), v.descriptive && nice(v.descriptive), v.language && v.language !== 'en' && (LANGS[v.language] ?? v.language.toUpperCase())].filter(Boolean) as string[];
}

/** Browse ElevenLabs' voice library by group, filter, search and listen to samples, then choose a narrator. */
export function VoiceLibrary({ open, onClose, selected, onChoose }: { open: boolean; onClose: () => void; selected: string | null; onChoose: (v: LibraryVoice) => Promise<void> }) {
  const toast = useToast();
  const player = useSamplePlayer();
  const [filters, setFilters] = useState({ q: '', library: '', gender: '', accent: '', age: '', language: '' });
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Page | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [loading, setLoading] = useState(false);
  const [choosing, setChoosing] = useState('');

  const load = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page: String(page), ...(facets ? {} : { facets: '1' }) });
        const r = await api<Page>(`/api/narration/voices?${qs}`);
        if (r.facets) setFacets(r.facets);
        setData((prev) => (page > 0 && prev ? { ...r, voices: [...prev.voices, ...r.voices] } : r));
      } catch (e) {
        toast(errorText(e), 'error');
      }
      setLoading(false);
    },
    [filters, facets, toast],
  );

  useEffect(() => {
    if (open) load(0);
    else player.stop();
    // Reload when filters change; facets load once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filters]);

  // Search as the author types, after a short pause.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === query ? f : { ...f, q: query })), 350);
    return () => clearTimeout(t);
  }, [query]);

  const set = (k: keyof typeof filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const select = (k: 'gender' | 'accent' | 'age' | 'language', label: string, list: Facet[] | undefined, name = nice) => (
    <label className="text-[13px]">
      <span className="mb-1 block text-ink-muted">{label}</span>
      <select className="field h-9 w-full py-1 text-[14px]" value={filters[k]} onChange={(e) => set(k, e.target.value)}>
        <option value="">Any</option>
        {list?.map((f) => <option key={f.value} value={f.value}>{name(f.value)} ({f.n})</option>)}
      </select>
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} title="Choose a narrator" wide>
      {data && !data.ready ? (
        <p className="text-[14px] text-ink-muted">Premium voices aren’t set up yet. The site owner needs to add the ElevenLabs key.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Voice libraries">
            {[{ value: '', n: facets?.total ?? 0, label: 'All voices' }, ...(facets?.libraries ?? [])].map((l) => (
              <button
                key={l.value || 'all'}
                role="tab"
                aria-selected={filters.library === l.value}
                onClick={() => set('library', l.value)}
                className={clsx('rounded-full border px-3 py-1 text-[13px]', filters.library === l.value ? 'border-cloth bg-cloth text-white' : 'border-line-strong text-ink-soft hover:border-ink-faint')}
              >
                {l.label} <span className="opacity-70">{l.n}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
            <label className="text-[13px]">
              <span className="mb-1 block text-ink-muted">Search</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-faint" aria-hidden />
                <input className="field h-9 w-full py-1 pl-8 text-[14px]" placeholder="Warm, deep, Scottish…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </span>
            </label>
            {select('accent', 'Accent', facets?.accents)}
            {select('gender', 'Gender', facets?.genders)}
            {select('age', 'Age', facets?.ages)}
            {select('language', 'Language', facets?.languages, (v) => LANGS[v] ?? v.toUpperCase())}
          </div>
          <p className="text-[12px] text-ink-muted" aria-live="polite">
            {data ? `${data.total.toLocaleString('en-GB')} voices` : 'Loading voices…'}. Samples are free to play and don’t use credits.
          </p>
          <ul className="grid gap-2 md:grid-cols-2">
            {data?.voices.map((v) => {
              const isSel = selected === v.voice_id;
              return (
                <li key={v.voice_id} className={clsx('flex flex-col gap-2 rounded border p-3', isSel ? 'border-cloth bg-cloth-light/50' : 'border-line bg-sheet')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{v.name} {v.featured && <Badge tone="gilt">Featured</Badge>}</p>
                      <p className="text-[12px] text-ink-muted">{voiceTags(v).join(' · ')}</p>
                    </div>
                    {isSel && <Badge tone="cloth">Chosen</Badge>}
                  </div>
                  {v.description && <p className="line-clamp-2 text-[13px] text-ink-soft">{v.description}</p>}
                  <div className="mt-auto flex gap-2">
                    <SampleButton voice={v} player={player} />
                    <Button
                      size="sm"
                      variant={isSel ? 'ghost' : 'primary'}
                      disabled={isSel || !!choosing}
                      loading={choosing === v.voice_id}
                      onClick={async () => {
                        setChoosing(v.voice_id);
                        try {
                          await onChoose(v);
                          player.stop();
                          onClose();
                        } catch (e) {
                          toast(errorText(e), 'error');
                        }
                        setChoosing('');
                      }}
                    >
                      {isSel ? <><Check className="h-4 w-4" />Your narrator</> : 'Use this voice'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {data && !data.voices.length && !loading && <p className="text-[14px] text-ink-muted">No voices match. Try fewer filters.</p>}
          {data && data.voices.length < data.total && (
            <Button variant="secondary" onClick={() => load(data.page + 1)} loading={loading}>Show more voices</Button>
          )}
        </div>
      )}
    </Modal>
  );
}
