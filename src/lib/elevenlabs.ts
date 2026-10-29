import 'server-only';
import { HttpError } from './api';
import type { Quality } from './pricing';

/**
 * ElevenLabs (premium narration). Called from the server only, so the API key
 * never reaches the browser. Uses Ordwick's one ElevenLabs account on pay as you go.
 */
const BASE = process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io';

export const elevenLabsReady = () => !!process.env.ELEVENLABS_API_KEY?.trim();

/** The model behind each quality. Change these in Vercel to switch models without touching code. */
export const NARRATION_MODELS: Record<Quality, string> = {
  turbo: process.env.ELEVENLABS_TURBO_MODEL || 'eleven_v4_turbo',
  standard: process.env.ELEVENLABS_STANDARD_MODEL || 'eleven_v4',
};

/** What ElevenLabs charges us per 1,000 characters (API rates), used to track margins. */
export const USD_PER_1K_CHARS: Record<Quality, number> = {
  turbo: Number(process.env.ELEVENLABS_TURBO_PRICE ?? 0.04),
  standard: Number(process.env.ELEVENLABS_STANDARD_PRICE ?? 0.08),
};

export function costUsd(chars: number, quality: Quality) {
  return +((chars / 1000) * USD_PER_1K_CHARS[quality]).toFixed(4);
}

/** Characters per request, kept under each model's limit with room to spare. */
const CHUNK_LIMITS: Record<string, number> = {
  eleven_v4: 9000,
  eleven_multilingual_v2: 9000,
  eleven_flash_v2_5: 30000,
  eleven_flash_v2: 25000,
  eleven_turbo_v2_5: 30000,
  eleven_v3: 4500,
};
export const chunkLimitFor = (model: string) => CHUNK_LIMITS[model] ?? 4500;

/** Models that can't link requests together for a seamless voice across pieces. */
const NO_STITCHING = new Set(['eleven_v3', 'eleven_v3_conversational']);

class ElevenLabsError extends Error {
  constructor(public status: number, public detail: string) {
    super(`ElevenLabs ${status}: ${detail}`);
  }
}

async function call(path: string, init: RequestInit & { raw?: boolean } = {}) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new HttpError(503, 'Premium narration isn’t set up yet. The site owner needs to add the ElevenLabs key.', 'AI_NOT_CONFIGURED');
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'xi-api-key': key, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
      cache: 'no-store',
    });
    if (res.ok) return res;
    const text = await res.text().catch(() => '');
    // Busy or a hiccup at ElevenLabs: wait and try again, up to twice.
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    throw new ElevenLabsError(res.status, detailOf(text));
  }
}

function detailOf(text: string) {
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    const d = j.detail;
    if (typeof d === 'string') return d;
    if (d && typeof d === 'object') {
      const o = d as { message?: string; status?: string };
      if (o.message) return `${o.status ? `${o.status}: ` : ''}${o.message}`;
      if (Array.isArray(d)) return d.map((x) => (x as { msg?: string }).msg ?? '').join('; ');
    }
  } catch {
    /* not JSON */
  }
  return text.slice(0, 300) || 'no details';
}

/** Turns an ElevenLabs failure into a message an author can act on. */
export function friendlyElevenLabsError(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  if (e instanceof ElevenLabsError) {
    const d = e.detail.toLowerCase();
    // Out of ElevenLabs balance (sometimes sent as 401 "quota_exceeded"): check this before treating 401 as a bad key.
    if (e.status === 402 || d.includes('quota') || d.includes('credits') || d.includes('payment'))
      return new HttpError(503, 'Premium narration is paused while we top up our narration service. Your credits weren’t used; please try again later.', 'NARRATION_PROVIDER');
    if (e.status === 401) return new HttpError(503, 'Premium narration isn’t available right now. Your credits weren’t used, and the site owner has been told.', 'NARRATION_PROVIDER');
    if (e.status === 429) return new HttpError(503, 'The narration service is busy. Your credits weren’t used; try again in a minute.', 'NARRATION_BUSY');
    if (d.includes('voice') && (e.status === 400 || e.status === 404))
      return new HttpError(400, 'This voice is no longer available. Choose another narrator; your credits weren’t used.', 'VOICE_UNAVAILABLE');
    return new HttpError(502, 'The narration service couldn’t finish this chapter. Your credits weren’t used; please try again.', 'NARRATION_FAILED');
  }
  return new HttpError(502, 'Narration failed. Your credits weren’t used; please try again.', 'NARRATION_FAILED');
}

// ───────────── Voice library ─────────────

export interface SharedVoice {
  public_owner_id: string;
  voice_id: string;
  name: string;
  description?: string | null;
  category?: string;
  use_case?: string;
  gender?: string;
  age?: string;
  accent?: string;
  language?: string | null;
  descriptive?: string;
  preview_url?: string | null;
  featured?: boolean;
  usage_character_count_1y?: number;
  rate?: number | null;
  fiat_rate?: number | null;
}

/** One page of ElevenLabs' public voice library, most-used first, without voices that cost extra. */
export async function fetchSharedVoices(o: { page: number; pageSize?: number; featured?: boolean }) {
  const q = new URLSearchParams({
    page_size: String(o.pageSize ?? 100),
    page: String(o.page),
    sort: 'usage_character_count_1y',
    include_custom_rates: 'false',
    include_live_moderated: 'false',
  });
  if (o.featured) q.set('featured', 'true');
  const res = await call(`/v1/shared-voices?${q}`);
  return (await res.json()) as { voices: SharedVoice[]; has_more: boolean };
}

/**
 * Adds a library voice to our ElevenLabs account so it can narrate.
 * Library voices don't use up the account's custom voice slots.
 */
export async function addSharedVoice(publicOwnerId: string, voiceId: string, name: string) {
  try {
    const res = await call(`/v1/voices/add/${encodeURIComponent(publicOwnerId)}/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      body: JSON.stringify({ new_name: `${name} (library)`.slice(0, 100), bookmarked: false }),
    });
    const j = (await res.json()) as { voice_id?: string };
    return j.voice_id || voiceId;
  } catch (e) {
    // Already in the account: the library id works as it is.
    if (e instanceof ElevenLabsError && /already/i.test(e.detail)) return voiceId;
    throw e;
  }
}

// ───────────── Narration ─────────────

/**
 * Narrates text as one MP3. Long text goes in pieces, one after another, each
 * linked to the pieces before it so the voice and pacing stay seamless.
 */
export async function synthesize(o: { voiceId: string; quality: Quality; chunks: string[] }): Promise<Buffer> {
  const model = NARRATION_MODELS[o.quality];
  let stitch = !NO_STITCHING.has(model);
  const ids: string[] = [];
  const parts: Buffer[] = [];
  for (const text of o.chunks) {
    const body = (withIds: boolean) =>
      JSON.stringify({
        text,
        model_id: model,
        apply_text_normalization: 'auto',
        ...(withIds && ids.length ? { previous_request_ids: ids.slice(-3) } : {}),
      });
    const path = `/v1/text-to-speech/${encodeURIComponent(o.voiceId)}?output_format=mp3_44100_128`;
    let res: Response;
    try {
      res = await call(path, { method: 'POST', body: body(stitch) });
    } catch (e) {
      // If this model won't link requests, carry on without linking.
      if (stitch && ids.length && e instanceof ElevenLabsError && (e.status === 400 || e.status === 422) && /previous_request|stitch/i.test(e.detail)) {
        stitch = false;
        res = await call(path, { method: 'POST', body: body(false) });
      } else throw e;
    }
    parts.push(Buffer.from(await res.arrayBuffer()));
    const rid = res.headers.get('request-id');
    if (rid) ids.push(rid);
  }
  // MP3 frames can simply be joined.
  return Buffer.concat(parts);
}

/** A quick check that the key works, for the admin pages. */
export async function checkElevenLabs(): Promise<{ ok: boolean; detail: string }> {
  if (!elevenLabsReady()) return { ok: false, detail: 'ELEVENLABS_API_KEY is not set.' };
  try {
    await call('/v1/shared-voices?page_size=1');
    return { ok: true, detail: 'Connected.' };
  } catch (e) {
    return { ok: false, detail: e instanceof ElevenLabsError ? `ElevenLabs said: ${e.detail}` : String(e) };
  }
}
