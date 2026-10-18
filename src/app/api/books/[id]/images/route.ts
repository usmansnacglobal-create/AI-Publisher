import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { requireFeature } from '@/lib/tokens';
import { generateIllustration } from '@/lib/ai/openai';
import { createAdminClient } from '@/lib/supabase/admin';
import { imageName, imagePath, imagesIn, imageSizes, SIZE_FRACTION } from '@/lib/images';
import { normaliseLayout } from '@/lib/layout';
import { TRIM_SIZES } from '@/lib/spine';

export const maxDuration = 180;
type Ctx = { params: { id: string } };

const STYLES: Record<string, string> = {
  photo: 'a realistic, natural-light photograph',
  illustration: 'a clean, modern editorial illustration',
  watercolour: 'a soft watercolour painting',
  line: 'a simple black ink line drawing on a white background',
  diagram: 'a clear, minimal explanatory diagram with no words or labels',
};

/** Print-quality check: how sharp each image will be at its printed size. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const { data: chapters } = await supabase.from('chapters').select('title, content').eq('book_id', book.id).order('position');
  const used = imagesIn(chapters ?? []);
  const sizes = await imageSizes(book.user_id, book.id, used.map((u) => u.src));
  const layout = normaliseLayout(book.layout);
  const trim = TRIM_SIZES[book.trim_size] ?? TRIM_SIZES['6x9'];
  const textWidth = trim.w - layout.margins.outside - 0.8;
  const images = used.map((u) => {
    const own = !!imageName(u.src, book.id);
    const px = sizes.get(u.src);
    const inches = textWidth * SIZE_FRACTION[u.size];
    const dpi = px ? Math.round(px.width / inches) : null;
    const status = !own ? 'fail' : !px ? 'fail' : dpi! >= 300 ? 'ok' : dpi! >= 200 ? 'warn' : 'fail';
    const note = !own
      ? 'This image comes from another website, so it can’t be printed. Download it and upload it instead.'
      : !px
        ? 'This image file is missing. Remove it and add it again.'
        : dpi! >= 300
          ? `${dpi} dpi at ${inches.toFixed(1)}″ wide: sharp in print.`
          : dpi! >= 200
            ? `${dpi} dpi at ${inches.toFixed(1)}″ wide: acceptable, but may look slightly soft. Print looks best at 300 dpi.`
            : `${dpi} dpi at ${inches.toFixed(1)}″ wide: too low for print and will look blurry. Use a larger image or a smaller size.`;
    return { ...u, width: px?.width ?? null, height: px?.height ?? null, dpi, status, note };
  });
  return json({ images, ink: layout.ink });
});

/** Creates an image for the book with ChatGPT (Pro and Agency). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  await requireFeature(user.id, 'cover');
  const body = z
    .object({ prompt: z.string().trim().min(5, 'Describe the image in a few words.').max(1500), style: z.enum(['photo', 'illustration', 'watercolour', 'line', 'diagram']), shape: z.enum(['square', 'landscape', 'portrait']) })
    .safeParse(await req.json());
  if (!body.success) throw new HttpError(400, body.error.issues[0].message);
  const ink = normaliseLayout(book.layout).ink;
  const prompt = `Create ${STYLES[body.data.style]} for the inside of a ${book.genre || ''} book titled "${book.title}". Subject: ${body.data.prompt}.
No text, letters, numbers, captions, watermarks or logos anywhere in the image. ${ink === 'bw' ? 'It will be printed in black and white, so use strong contrast and clear shapes.' : 'It will be printed in colour.'}`;
  const png = await generateIllustration({ userId: user.id, bookId: book.id, prompt, shape: body.data.shape });
  const name = `${crypto.randomUUID()}.png`;
  const { error } = await createAdminClient().storage.from('manuscripts').upload(imagePath(book.user_id, book.id, name), png, { contentType: 'image/png' });
  if (error) throw error;
  return json({ src: `/api/books/${book.id}/images/${name}` }, 201);
});
