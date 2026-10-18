import { requireFeature } from '@/lib/tokens';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { logActivity } from '@/lib/notify';

export const maxDuration = 120;

/**
 * Called after the browser uploads the finished front cover and full wrap.
 * Builds the print-ready wrap PDF (exact size with bleed) that KDP and
 * IngramSpark ask for.
 */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  await requireFeature(user.id, 'cover');
  const body = z
    .object({
      frontPath: z.string(),
      wrapPath: z.string().optional(),
      socialPath: z.string().optional(),
      wrapInches: z.object({ width: z.number().positive(), height: z.number().positive() }).optional(),
      hardcoverPath: z.string().optional(),
      hardcoverInches: z.object({ width: z.number().positive(), height: z.number().positive() }).optional(),
    })
    .parse(await req.json());
  const mine = (p: string) => p.startsWith(`${user.id}/${book.id}/`);
  if ([body.frontPath, body.wrapPath, body.socialPath, body.hardcoverPath].some((p) => p && !mine(p))) throw new HttpError(400, 'Invalid file.');

  // Wraps a 300 dpi cover image in a PDF of the exact printed size.
  async function toPdf(imagePath: string, inches: { width: number; height: number }, name: string, title: string) {
    const { data: img } = await supabase.storage.from('covers').download(imagePath);
    if (!img) throw new HttpError(400, 'Upload of the full cover failed. Try again.');
    const w = inches.width * 72;
    const h = inches.height * 72;
    const doc = new PDFDocument({ size: [w, h], margin: 0, info: { Title: title } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((r) => doc.on('end', () => r(Buffer.concat(chunks))));
    doc.image(Buffer.from(await img.arrayBuffer()), 0, 0, { width: w, height: h });
    doc.end();
    const path = `${user.id}/${book.id}/${name}`;
    const { error } = await supabase.storage.from('covers').upload(path, await done, { contentType: 'application/pdf', upsert: true });
    if (error) throw error;
    return path;
  }

  const wrapPdfPath = body.wrapPath && body.wrapInches ? await toPdf(body.wrapPath, body.wrapInches, 'cover-wrap.pdf', `${book.title} — paperback cover`) : null;
  if (body.hardcoverPath && body.hardcoverInches) await toPdf(body.hardcoverPath, body.hardcoverInches, 'cover-hardcover.pdf', `${book.title} — hardcover cover`);
  await supabase
    .from('covers')
    .upsert({ book_id: book.id, user_id: user.id, front_path: body.frontPath, wrap_path: wrapPdfPath, social_path: body.socialPath ?? null }, { onConflict: 'book_id' });
  await logActivity(user.id, 'cover.finalised', { bookId: book.id });
  return json({ ok: true, wrapPdfPath });
});
