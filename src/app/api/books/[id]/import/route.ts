import mammoth from 'mammoth';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { splitIntoChapters } from '@/lib/manuscript';
import { countWords } from '@/lib/text';
import { logActivity } from '@/lib/notify';

export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request limit is 4.5 MB

/** Imports a Word (.docx), text or Markdown manuscript and adds its chapters to the book. */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const form = await req.formData();
  const file = form.get('file');
  const replace = form.get('replace') === 'true';
  if (!(file instanceof File)) throw new HttpError(400, 'Choose a file to import.');
  if (file.size > MAX_BYTES) throw new HttpError(413, 'That file is over 4 MB. Save it without images and try again.');

  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  let text: string;
  if (name.endsWith('.docx')) {
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (name.endsWith('.txt') || name.endsWith('.md')) {
    text = buf.toString('utf8');
  } else {
    throw new HttpError(400, 'Import a .docx, .txt or .md file. For Pages or Google Docs, download as Word first.');
  }

  const parts = splitIntoChapters(text);
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
  return json({ chapters: parts.length, words });
});
