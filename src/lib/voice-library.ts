import 'server-only';
import { createAdminClient } from './supabase/admin';
import { addSharedVoice, elevenLabsReady, fetchSharedVoices, type SharedVoice } from './elevenlabs';
import { HttpError } from './api';

/**
 * The ElevenLabs voice library, cached in our database. It refreshes itself at
 * most once a day, so browsing is fast and doesn't call ElevenLabs every time.
 */
const REFRESH_HOURS = 24;
const PAGES = 5; // 5 × 100 most-used voices, plus ElevenLabs' featured voices
const SETTINGS_KEY = 'elevenlabs_voices';

export interface LibraryVoice {
  voice_id: string;
  name: string;
  description: string;
  category: string;
  use_case: string;
  gender: string;
  age: string;
  accent: string;
  language: string;
  descriptive: string;
  featured: boolean;
  has_preview: boolean;
}

const clean = (s: string | null | undefined) => (s ?? '').trim();

function toRow(v: SharedVoice, featured: boolean, now: string) {
  return {
    voice_id: v.voice_id,
    public_owner_id: v.public_owner_id,
    name: clean(v.name) || 'Unnamed voice',
    description: clean(v.description).slice(0, 600),
    category: clean(v.category),
    use_case: clean(v.use_case),
    gender: clean(v.gender),
    age: clean(v.age),
    accent: clean(v.accent),
    language: clean(v.language),
    descriptive: clean(v.descriptive),
    preview_url: v.preview_url?.startsWith('https://') ? v.preview_url : null,
    featured: featured || !!v.featured,
    usage_1y: Math.round(v.usage_character_count_1y ?? 0),
    active: true,
    fetched_at: now,
  };
}

/** Pulls the current library from ElevenLabs. Voices that left the library stay usable for books that chose them. */
export async function refreshVoiceLibrary() {
  if (!elevenLabsReady()) throw new HttpError(503, 'Add the ElevenLabs key first.', 'AI_NOT_CONFIGURED');
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const seen = new Map<string, ReturnType<typeof toRow>>();
  const keep = (v: SharedVoice, featured: boolean) => {
    // Skip voices that charge extra per character, so our prices hold.
    if ((v.rate ?? 1) > 1 || v.fiat_rate) return;
    if (!seen.has(v.voice_id)) seen.set(v.voice_id, toRow(v, featured, now));
    else if (featured) seen.get(v.voice_id)!.featured = true;
  };
  const featured = await fetchSharedVoices({ page: 0, featured: true });
  featured.voices.forEach((v) => keep(v, true));
  for (let page = 0; page < PAGES; page++) {
    const r = await fetchSharedVoices({ page });
    r.voices.forEach((v) => keep(v, false));
    if (!r.has_more) break;
  }
  const rows = [...seen.values()];
  if (!rows.length) throw new Error('ElevenLabs returned no voices.');
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await admin.from('elevenlabs_voices').upsert(rows.slice(i, i + 200), { onConflict: 'voice_id' });
    if (error) throw error;
  }
  await admin.from('elevenlabs_voices').update({ active: false }).lt('fetched_at', now);
  await admin.from('app_settings').upsert({ key: SETTINGS_KEY, value: { refreshed_at: now, count: rows.length }, updated_at: now }, { onConflict: 'key' });
  return { count: rows.length, refreshedAt: now };
}

/** Refreshes the cache if it's more than a day old. Never fails the page: old voices are better than none. */
export async function ensureFreshLibrary() {
  if (!elevenLabsReady()) return null;
  const admin = createAdminClient();
  const { data } = await admin.from('app_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
  const at = (data?.value as { refreshed_at?: string } | null)?.refreshed_at;
  if (at && Date.now() - new Date(at).getTime() < REFRESH_HOURS * 3600_000) return at;
  try {
    return (await refreshVoiceLibrary()).refreshedAt;
  } catch (e) {
    console.error('Voice library refresh failed', e);
    return at ?? null;
  }
}

/** Friendly names for ElevenLabs' use-case groups; anything new is shown in title case. */
export const USE_CASE_LABELS: Record<string, string> = {
  narrative_story: 'Narration & stories',
  informative_educational: 'Informative & educational',
  conversational: 'Conversational',
  characters_animation: 'Characters & animation',
  social_media: 'Social media',
  entertainment_tv: 'Entertainment & TV',
  advertisement: 'Advertising',
};
export function useCaseLabel(u: string) {
  if (!u) return 'Other voices';
  return USE_CASE_LABELS[u] ?? u.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export async function listLibrary(f: { q?: string; useCase?: string; gender?: string; accent?: string; age?: string; language?: string; page?: number }) {
  const admin = createAdminClient();
  const size = 24;
  const page = Math.max(0, f.page ?? 0);
  let query = admin
    .from('elevenlabs_voices')
    .select('voice_id,name,description,category,use_case,gender,age,accent,language,descriptive,featured,preview_url', { count: 'exact' })
    .eq('active', true);
  if (f.useCase) query = query.eq('use_case', f.useCase);
  if (f.gender) query = query.eq('gender', f.gender);
  if (f.accent) query = query.eq('accent', f.accent);
  if (f.age) query = query.eq('age', f.age);
  if (f.language) query = query.eq('language', f.language);
  if (f.q) {
    const q = f.q.replace(/[%,()*\\"'.:]/g, ' ').trim().slice(0, 60);
    if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,descriptive.ilike.%${q}%,accent.ilike.%${q}%`);
  }
  const { data, count, error } = await query
    .order('featured', { ascending: false })
    .order('usage_1y', { ascending: false })
    .range(page * size, page * size + size - 1);
  if (error) throw error;
  const voices: LibraryVoice[] = (data ?? []).map(({ preview_url, ...v }) => ({ ...v, has_preview: !!preview_url }));
  return { voices, total: count ?? 0, page, pageSize: size };
}

/** The groups ("libraries") and filter choices that exist in the cache, with how many voices each has. */
export async function libraryFacets() {
  const admin = createAdminClient();
  const { data } = await admin.from('elevenlabs_voices').select('use_case,gender,accent,age,language').eq('active', true).limit(5000);
  const count = (key: 'use_case' | 'gender' | 'accent' | 'age' | 'language') => {
    const m = new Map<string, number>();
    for (const r of data ?? []) if (r[key]) m.set(r[key], (m.get(r[key]) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => ({ value, n }));
  };
  return {
    libraries: count('use_case').map((x) => ({ ...x, label: useCaseLabel(x.value) })),
    genders: count('gender'),
    accents: count('accent'),
    ages: count('age'),
    languages: count('language'),
    total: data?.length ?? 0,
  };
}

export async function getVoice(voiceId: string) {
  const { data } = await createAdminClient().from('elevenlabs_voices').select('*').eq('voice_id', voiceId).maybeSingle();
  return data as (ReturnType<typeof toRow> & { account_voice_id: string | null }) | null;
}

/** The id to narrate with: adds the voice to our ElevenLabs account the first time it's used. */
export async function narrationVoiceId(voiceId: string) {
  const v = await getVoice(voiceId);
  if (!v) throw new HttpError(400, 'Choose a narrator from the voice library first.', 'VOICE_UNAVAILABLE');
  if (v.account_voice_id) return v.account_voice_id;
  const id = await addSharedVoice(v.public_owner_id, v.voice_id, v.name);
  await createAdminClient().from('elevenlabs_voices').update({ account_voice_id: id }).eq('voice_id', voiceId);
  return id;
}
