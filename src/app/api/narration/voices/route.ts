import { handle, json, requireUser } from '@/lib/api';
import { elevenLabsReady } from '@/lib/elevenlabs';
import { ensureFreshLibrary, libraryFacets, listLibrary } from '@/lib/voice-library';

export const dynamic = 'force-dynamic';

/** Browse ElevenLabs' voice library: grouped into libraries, with filters and search. */
export const GET = handle(async (req: Request) => {
  await requireUser();
  if (!elevenLabsReady()) return json({ ready: false, voices: [], total: 0, page: 0, pageSize: 24, facets: null, refreshedAt: null });
  const p = new URL(req.url).searchParams;
  const s = (k: string) => p.get(k)?.trim().slice(0, 60) || undefined;
  const refreshedAt = await ensureFreshLibrary();
  const [list, facets] = await Promise.all([
    listLibrary({ q: s('q'), useCase: s('library'), gender: s('gender'), accent: s('accent'), age: s('age'), language: s('language'), page: Number(p.get('page') ?? 0) || 0 }),
    p.get('facets') === '1' ? libraryFacets() : Promise.resolve(null),
  ]);
  return json({ ready: true, ...list, facets, refreshedAt });
});
