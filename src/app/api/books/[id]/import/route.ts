import mammoth from 'mammoth';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import TurndownService from 'turndown';
import sharp from 'sharp';
import { pdfLinesToText, splitIntoChapters, splitMarkdownChapters } from '@/lib/manuscript';
import { createAdminClient } from '@/lib/supabase/admin';
import { imagePath } from '@/lib/images';
import { countWords } from '@/lib/text';
import { logActivity } from '@/lib/notify';

export const maxDuration = 120;
const MAX_FORM_BYTES = 4 * 1024 * 1024; // Vercel's request limit is 4.5 MB; bigger files come through storage
const MAX_STORED_BYTES = 40 * 1024 * 1024;

/** Word → Markdown that keeps headings, bold, italic, underline, lists, quotes and pictures. */
function wordToMarkdown(html: string) {
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*', strongDelimiter: '**', hr: '---' });
  td.keep(['u']);
  td.addRule('image', {
    filter: 'img',
    replacement: (_c, node) => {
      const el = node as unknown as { getAttribute: (n: string) => string | null };
      const src = el.getAttribute('src');
      if (!src || !src.startsWith('/api/books/')) return '';
      const alt = (el.getAttribute('alt') ?? '').replace(/[\[\]\n]/g, ' ').trim();
      return `\n\n![${alt}](${src} "full")\n\n`;
    },
  });
  return td.turndown(html).replace(/\\([-*_#.!])/g, '$1');
}

/**
 * Imports a Word (.docx), PDF, text or Markdown manuscript and adds its chapters to the book.
 * The file is either uploaded to storage first ({ path }) or sent directly as a small form upload.
 */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  let name: string;
  let buf: Buffer;
  let replace: boolean;
  let storedPath: string | null = null;
  if ((req.headers.get('content-type') ?? '').includes('application/json')) {
    const body = (await req.json()) as { path?: string; replace?: boolean };
    if (!body.path || !body.path.startsWith(`${user.id}/${book.id}/imports/`)) throw new HttpError(400, 'Choose a file to import.');
    const { data } = await supabase.storage.from('manuscripts').download(body.path);
    if (!data) throw new HttpError(400, 'The upload didn’t finish. Try again.');
    if (data.size > MAX_STORED_BYTES) throw new HttpError(413, 'That file is over 40 MB. Save a copy with smaller pictures and try again.');
    storedPath = body.path;
    name = body.path.toLowerCase();
    buf = Buffer.from(await data.arrayBuffer());
    replace = !!body.replace;
  } else {
    const form = await req.formData();
    const file = form.get('file');
    replace = form.get('replace') === 'true';
    if (!(file instanceof File)) throw new HttpError(400, 'Choose a file to import.');
    if (file.size > MAX_FORM_BYTES) throw new HttpError(413, 'That file is over 4 MB. Refresh the page and try again.');
    name = file.name.toLowerCase();
    buf = Buffer.from(await file.arrayBuffer());
  }

  let text = '';
  let markdown: string | null = null;
  let images = 0;
  if (name.endsWith('.docx')) {
    const admin = createAdminClient();
    const result = await mammoth.convertToHtml(
      { buffer: buf },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const type = image.contentType;
          if (!/^image\/(png|jpe?g|gif|webp)$/.test(type)) return { src: '' };
          let data = (await image.read()) as unknown as Buffer;
          if (type.includes('gif')) data = await sharp(data).png().toBuffer();
          const file = `${crypto.randomUUID()}.${type.includes('png') || type.includes('gif') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'}`;
          const { error } = await admin.storage.from('manuscripts').upload(imagePath(book.user_id, book.id, file), data, { contentType: type.includes('gif') ? 'image/png' : type });
          if (error) return { src: '' };
          images++;
          return { src: `/api/books/${book.id}/images/${file}` };
        }),
      },
    );
    markdown = wordToMarkdown(result.value);
  } else if (name.endsWith('.pdf')) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text: pages } = await extractText(pdf, { mergePages: false });
    text = pdfLinesToText(pages as string[]);
    if (!text.trim()) throw new HttpError(400, 'That PDF has no selectable text (it may be scanned images). Export it from Word as .docx instead.');
  } else if (name.endsWith('.txt') || name.endsWith('.md')) {
    text = buf.toString('utf8');
  } else {
    throw new HttpError(400, 'Import a .docx, .pdf, .txt or .md file. For Pages or Google Docs, download as Word first.');
  }

  if (storedPath) await supabase.storage.from('manuscripts').remove([storedPath]);
  const parts = markdown !== null ? splitMarkdownChapters(markdown) : splitIntoChapters(text);
  if (!parts.length) throw new HttpError(400, 'No text found in that file.');

  if (replace) await supabase.from('chapters').delete().eq('book_id', book.id);
  const { data: last } = await supabase
    .from('chapters').select('position').eq('book_id', book.id).order('position', { ascending: false }).limit(1);
  const start = last?.[0]?.position ?? 0;
  const { error } = await supabase.from('chapters').insert(
    parts.map((p, i) => ({
      book_id: book.id,
      user_id: user.id,
      position: start + i + 1,
      title: p.title,
      content: p.content,
      word_count: countWords(p.content),
      status: 'drafted',
    })),
  );
  if (error) throw error;
  const total = start + parts.length;
  const words = parts.reduce((s, p) => s + countWords(p.content), 0);
  await supabase
    .from('books')
    .update({ target_chapters: Math.max(book.target_chapters, total), target_words: Math.max(book.target_words, words) })
    .eq('id', book.id);
  await logActivity(user.id, 'book.imported', { bookId: book.id, chapters: parts.length, words });
  return json({ chapters: parts.length, words, images });
});
