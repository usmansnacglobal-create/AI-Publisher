import { requireFeature } from '@/lib/tokens';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { complete, FAST_MODEL } from '@/lib/ai/claude';
import { generateCoverArt, generateCoverArtFromImages } from '@/lib/ai/openai';
import { COVER_STYLES, DEFAULT_BRIEF, type CoverBrief } from '@/lib/cover';
import { logActivity } from '@/lib/notify';

export const maxDuration = 300;

/**
 * Cover concepts: Claude turns the brief into precise art direction, then
 * ChatGPT's image model paints the artwork. Lettering is added afterwards in
 * the Design step with real fonts, so the title is always spelled right.
 */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  await requireFeature(user.id, 'cover');
  const { count, tweak } = z
    .object({ count: z.number().int().min(1).max(4).default(3), tweak: z.string().max(1000).default('') })
    .parse(await req.json().catch(() => ({})));
  const { data: cover } = await supabase.from('covers').select('*').eq('book_id', book.id).maybeSingle();
  const brief: CoverBrief = { ...DEFAULT_BRIEF, ...(cover?.brief ?? {}) };
  if (brief.referencePaths.length && !brief.rightsConfirmed) {
    throw new HttpError(400, 'Confirm you own or have the rights to use your reference images.');
  }

  const direction = await complete({
    userId: user.id,
    bookId: book.id,
    feature: 'cover_text',
    model: FAST_MODEL,
    maxTokens: 700,
    system:
      'You are an award-winning book cover art director. Write one image-generation prompt (120–200 words) for front-cover ARTWORK ONLY. Describe subject, composition, lighting, palette, medium and genre conventions. Leave clear, uncluttered space in the top quarter for the title and the bottom eighth for the author name. The image must contain NO text, letters, words, logos or watermarks. Avoid depicting identifiable real people\'s faces; for biographies, prefer evocative scenes, silhouettes, symbols or settings. Output only the prompt.',
    prompt: [
      `Book: ${book.title}${book.subtitle ? ` — ${book.subtitle}` : ''}`,
      `Genre: ${book.genre || (book.book_type === 'fiction' ? 'Fiction' : 'Non-fiction')}`,
      book.summary && `Summary: ${book.summary}`,
      brief.moods.length && `Mood: ${brief.moods.join(', ')}`,
      `Style: ${COVER_STYLES[brief.style]?.label} (${COVER_STYLES[brief.style]?.hint})`,
      brief.imagery && `Imagery and themes the author wants: ${brief.imagery}`,
      brief.palette !== 'auto' && `Colour palette: ${brief.palette === 'custom' ? brief.customColours : brief.palette}`,
      brief.inspiration.length && `Mood inspiration (do not copy): ${brief.inspiration.join('; ')}`,
      brief.avoid && `Avoid: ${brief.avoid}`,
      brief.instructions && `Special instructions: ${brief.instructions}`,
      brief.referencePaths.length && 'The author has supplied reference images; incorporate their subject matter.',
      tweak && `Revision request: ${tweak}`,
    ]
      .filter(Boolean)
      .join('\n'),
  });
  const prompt = `${direction}\n\nPortrait book-cover artwork, 2:3. Absolutely no text, lettering, typography or watermark anywhere.`;

  let images: Buffer[];
  if (brief.referencePaths.length) {
    const refs = await Promise.all(
      brief.referencePaths.slice(0, 3).map(async (p, i) => {
        const { data } = await supabase.storage.from('covers').download(p);
        if (!data) throw new HttpError(400, 'A reference image is missing. Remove it and upload it again.');
        return { data: Buffer.from(await data.arrayBuffer()), name: `ref-${i}.png`, type: data.type || 'image/png' };
      }),
    );
    images = await generateCoverArtFromImages({ userId: user.id, bookId: book.id, prompt, count, images: refs });
  } else {
    images = await generateCoverArt({ userId: user.id, bookId: book.id, prompt, count });
  }
  if (!images.length) throw new HttpError(502, 'No images came back. Try again.');

  const fresh: { path: string; prompt: string; created_at: string }[] = [];
  for (const img of images) {
    const path = `${user.id}/${book.id}/concept-${randomUUID()}.png`;
    const { error } = await supabase.storage.from('covers').upload(path, img, { contentType: 'image/png' });
    if (error) throw error;
    fresh.push({ path, prompt: direction, created_at: new Date().toISOString() });
  }
  // Keep the 12 most recent concepts; delete older files.
  const all = [...fresh, ...((cover?.concepts ?? []) as typeof fresh)];
  const keep = all.slice(0, 12);
  const drop = all.slice(12).map((c) => c.path).filter((p) => p !== cover?.selected_path);
  if (drop.length) await supabase.storage.from('covers').remove(drop);
  await supabase.from('covers').upsert(
    { book_id: book.id, user_id: user.id, concepts: keep, brief, selected_path: cover?.selected_path ?? fresh[0].path },
    { onConflict: 'book_id' },
  );
  await logActivity(user.id, 'cover.generated', { bookId: book.id, count: fresh.length });
  return json({ concepts: fresh });
});
