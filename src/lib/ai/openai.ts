import 'server-only';
import OpenAI, { toFile } from 'openai';
import { assertQuota, recordUsage } from '../tokens';
import { HttpError } from '../api';
import { IMAGE_TOKEN_WEIGHT } from '../plans';

/** Typical output tokens for one high-quality portrait image. */
const TOKENS_PER_IMAGE = 6300;

// ChatGPT's image model designs cover artwork. Set OPENAI_IMAGE_MODEL in Vercel
// to switch to a newer model when OpenAI releases one.
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';

let client: OpenAI | null = null;
function openai() {
  if (!process.env.OPENAI_API_KEY) throw new HttpError(503, 'AI cover artwork isn’t switched on yet. The site owner needs to add the OpenAI API key in Vercel.', 'AI_NOT_CONFIGURED');
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 2 });
  return client;
}

/**
 * Generates portrait cover artwork (no lettering: titles are set later with
 * real fonts so they're always spelled correctly and sharp in print).
 * Returns PNG bytes for each image.
 */
export async function generateCoverArt(o: {
  userId: string;
  bookId: string;
  prompt: string;
  count: number;
  quality?: 'medium' | 'high';
}): Promise<Buffer[]> {
  await assertQuota(o.userId, o.count * TOKENS_PER_IMAGE * IMAGE_TOKEN_WEIGHT);
  const res = await openai().images.generate({
    model: IMAGE_MODEL,
    prompt: o.prompt,
    n: o.count,
    size: '1024x1536',
    quality: o.quality ?? 'high',
    output_format: 'png',
  });
  const usage = (res as unknown as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  await recordUsage({
    userId: o.userId,
    bookId: o.bookId,
    feature: 'cover_image',
    provider: 'openai',
    model: IMAGE_MODEL,
    inputTokens: usage?.input_tokens ?? 0,
    // Fallback estimate if the model doesn't report usage.
    outputTokens: usage?.output_tokens ?? TOKENS_PER_IMAGE * o.count,
  });
  return (res.data ?? []).filter((d) => d.b64_json).map((d) => Buffer.from(d.b64_json!, 'base64'));
}

/** Same as generateCoverArt, but guided by the author's own reference images. */
export async function generateCoverArtFromImages(o: {
  userId: string;
  bookId: string;
  prompt: string;
  count: number;
  images: { data: Buffer; name: string; type: string }[];
}): Promise<Buffer[]> {
  await assertQuota(o.userId, o.count * TOKENS_PER_IMAGE * IMAGE_TOKEN_WEIGHT);
  const files = await Promise.all(o.images.map((img) => toFile(img.data, img.name, { type: img.type })));
  const res = await openai().images.edit({
    model: IMAGE_MODEL,
    image: files,
    prompt: o.prompt,
    n: o.count,
    size: '1024x1536',
    quality: 'high',
    output_format: 'png',
  });
  const usage = (res as unknown as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  await recordUsage({
    userId: o.userId,
    bookId: o.bookId,
    feature: 'cover_image',
    provider: 'openai',
    model: IMAGE_MODEL,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? TOKENS_PER_IMAGE * o.count,
  });
  return (res.data ?? []).filter((d) => d.b64_json).map((d) => Buffer.from(d.b64_json!, 'base64'));
}

export const TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
/** Each narrated character counts as this many tokens against the monthly allowance (about 4 characters per token). */
const AUDIO_TOKEN_WEIGHT = Number(process.env.AUDIO_TOKEN_WEIGHT ?? 2);

export function audioTokenCost(chars: number) {
  return Math.ceil((chars / 4) * AUDIO_TOKEN_WEIGHT);
}

/**
 * Narrates text as MP3 with one of OpenAI's voices. Long text is narrated in
 * pieces (three at a time) and joined in order.
 */
export async function narrate(o: { userId: string; bookId: string; chunks: string[]; voice: string; instructions: string; feature?: string }): Promise<Buffer> {
  const chars = o.chunks.reduce((s, c) => s + c.length, 0);
  await assertQuota(o.userId, audioTokenCost(chars));
  const parts: Buffer[] = new Array(o.chunks.length);
  let next = 0;
  const worker = async () => {
    while (next < o.chunks.length) {
      const i = next++;
      const res = await openai().audio.speech.create({
        model: TTS_MODEL,
        voice: o.voice,
        input: o.chunks[i],
        instructions: TTS_MODEL.startsWith('tts-1') ? undefined : o.instructions,
        response_format: 'mp3',
      });
      parts[i] = Buffer.from(await res.arrayBuffer());
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  await recordUsage({
    userId: o.userId,
    bookId: o.bookId,
    feature: o.feature ?? 'audiobook',
    provider: 'openai',
    model: TTS_MODEL,
    inputTokens: Math.ceil(chars / 4),
    outputTokens: 0,
    weight: AUDIO_TOKEN_WEIGHT,
  });
  // MP3 frames can simply be joined.
  return Buffer.concat(parts);
}
