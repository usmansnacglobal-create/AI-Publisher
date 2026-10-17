import { requireFeature } from '@/lib/tokens';
import { handle, requireUser, requireBook, HttpError } from '@/lib/api';
import { buildManuscript } from '@/lib/export/build';
import { slug } from '@/lib/export/manuscript';
import { renderPdf } from '@/lib/export/pdf';
import { renderEpub } from '@/lib/export/epub';
import { renderDocx } from '@/lib/export/docx';
import { estimatePages } from '@/lib/spine';
import { countWords } from '@/lib/text';
import { logActivity } from '@/lib/notify';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const TYPES = {
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  md: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
} as const;

/** Downloads the book as a print PDF, EPUB ebook, Word file, Markdown or plain text. */
export const GET = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const format = (new URL(req.url).searchParams.get('format') ?? 'pdf') as keyof typeof TYPES;
  if (!(format in TYPES)) throw new HttpError(400, 'Unknown format.');
  const m = await buildManuscript(supabase, book);
  if (!m.chapters.length) throw new HttpError(400, 'This book has no chapter text yet.');

  let body: Buffer | string;
  const headers: Record<string, string> = {};
  if (format === 'pdf') {
    // The publishing team can always fetch the interior to review a submission.
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') await requireFeature(user.id, 'print');
    const words = m.chapters.reduce((s, c) => s + c.blocks.reduce((n, b) => n + (b.type === 'para' ? countWords(b.runs.map((r) => r.text).join('')) : 0), 0), 0);
    const est = book.page_count ?? estimatePages(words, book.trim_size, m.chapters.length);
    const { buffer, pages } = await renderPdf(m, book.trim_size, est);
    body = buffer;
    headers['X-Page-Count'] = String(pages);
    // The measured page count feeds the cover's spine width.
    await supabase.from('books').update({ page_count: pages }).eq('id', book.id);
  } else if (format === 'epub') {
    let cover: { data: Buffer; type: 'image/png' } | undefined;
    const { data: c } = await supabase.from('covers').select('front_path').eq('book_id', book.id).maybeSingle();
    if (c?.front_path) {
      const { data: file } = await supabase.storage.from('covers').download(c.front_path);
      if (file) cover = { data: Buffer.from(await file.arrayBuffer()), type: 'image/png' };
    }
    body = await renderEpub(m, cover);
  } else if (format === 'docx') {
    body = await renderDocx(m);
  } else {
    const md = format === 'md';
    body =
      `${md ? '# ' : ''}${m.title}\n\n${m.author}\n\n` +
      m.chapters
        .map(
          (c) =>
            `${md ? '## ' : ''}Chapter ${c.number}: ${c.title}\n\n` +
            c.blocks
              .map((b) =>
                b.type === 'break' ? '* * *' : b.type === 'heading' ? `${md ? '### ' : ''}${b.text}` : b.runs.map((r) => (md && r.italic ? `*${r.text}*` : md && r.bold ? `**${r.text}**` : r.text)).join(''),
              )
              .join('\n\n'),
        )
        .join('\n\n');
  }
  await logActivity(user.id, 'book.exported', { bookId: book.id, format });
  return new Response(body as BodyInit, {
    headers: {
      ...headers,
      'Content-Type': TYPES[format],
      'Content-Disposition': `attachment; filename="${slug(book.title)}.${format}"`,
      'Cache-Control': 'no-store',
      'Access-Control-Expose-Headers': 'X-Page-Count',
    },
  });
});
