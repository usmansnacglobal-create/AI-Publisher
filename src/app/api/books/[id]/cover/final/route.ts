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
      wrapInches: z.object({ width: z.number().positive(), height: z.number().positive() }).optional(),
    })
    .parse(await req.json());
  const mine = (p: string) => p.startsWith(`${user.id}/${book.id}/`);
  if (!mine(body.frontPath) || (body.wrapPath && !mine(body.wrapPath))) throw new HttpError(400, 'Invalid file.');

  let wrapPdfPath: string | null = null;
  if (body.wrapPath && body.wrapInches) {
    const { data: img } = await supabase.storage.from('covers').download(body.wrapPath);
    if (!img) throw new HttpError(400, 'Upload of the full cover failed. Try again.');
    const w = body.wrapInches.width * 72;
    const h = body.wrapInches.height * 72;
    const doc = new PDFDocument({ size: [w, h], margin: 0, info: { Title: `${book.title} — cover` } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((r) => doc.on('end', () => r(Buffer.concat(chunks))));
    doc.image(Buffer.from(await img.arrayBuffer()), 0, 0, { width: w, height: h });
    doc.end();
    wrapPdfPath = `${user.id}/${book.id}/cover-wrap.pdf`;
    const { error } = await supabase.storage.from('covers').upload(wrapPdfPath, await done, { contentType: 'application/pdf', upsert: true });
    if (error) throw error;
  }
  await supabase
    .from('covers')
    .upsert({ book_id: book.id, user_id: user.id, front_path: body.frontPath, wrap_path: wrapPdfPath }, { onConflict: 'book_id' });
  await logActivity(user.id, 'cover.finalised', { bookId: book.id });
  return json({ ok: true, wrapPdfPath });
});
