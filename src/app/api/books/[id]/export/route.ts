import { requireFeature } from '@/lib/tokens';
import { handle, requireUser, requireBook, HttpError } from '@/lib/api';
import { buildManuscript } from '@/lib/export/build';
import { slug, type Run } from '@/lib/export/manuscript';
import { renderPdf } from '@/lib/export/pdf';
import { renderEpub } from '@/lib/export/epub';
import { renderDocx } from '@/lib/export/docx';
import { estimatePages } from '@/lib/spine';
import { countWords } from '@/lib/text';
import { normaliseLayout } from '@/lib/layout';
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

const fmt = (runs: Run[], md: boolean) =>
  runs.map((r) => (md && r.bold && r.italic ? `***${r.text}***` : md && r.bold ? `**${r.text}**` : md && r.italic ? `*${r.text}*` : r.text)).join('');

/** Downloads the book as a print PDF, EPUB ebook, Word file, Markdown or plain text. */
export const GET = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const format = (new URL(req.url).searchParams.get('format') ?? 'pdf') as keyof typeof TYPES;
  if (!(format in TYPES)) throw new HttpError(400, 'Unknown format.');
  // Print uses full-resolution pictures (greyscale for black-and-white books); ebooks and Word use smaller copies.
  const ink = normaliseLayout(book.layout).ink;
  const imageOpts = format === 'pdf' ? { greyscale: ink === 'bw', maxWidth: 3000 } : format === 'epub' ? { maxWidth: 1600 } : format === 'docx' ? { maxWidth: 2000 } : undefined;
  const m = await buildManuscript(supabase, book, { images: imageOpts });
  if (!m.chapters.length) throw new HttpError(400, 'This book has no chapter text yet.');

  let body: Buffer | string;
  const headers: Record<string, string> = {};
  if (format === 'pdf') {
    // The publishing team can always fetch the interior to review a submission.
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') await requireFeature(user.id, 'print');
    const words = m.chapters.reduce((s, c) => s + c.blocks.reduce((n, b) => n + (b.type === 'para' ? countWords(b.runs.map((r) => r.text).join('')) : 0), 0), 0);
    const est = book.page_count ?? estimatePages(words, book.trim_size, m.chapters.length);
    const preview = new URL(req.url).searchParams.get('preview') === '1';
    const layout = normaliseLayout(book.layout);
    const { buffer, pages } = await renderPdf(m, book.trim_size, est, { layout, preview });
    body = buffer;
    if (!preview) {
      headers['X-Page-Count'] = String(pages);
      // The measured page count feeds the cover's spine width.
      await supabase.from('books').update({ page_count: pages }).eq('id', book.id);
    }
  } else if (format === 'epub') {
    let cover: { data: Buffer; type: 'image/png' } | undefined;
    const { data: c } = await supabase.from('covers').select('front_path').eq('book_id', book.id).maybeSingle();
    if (c?.front_path) {
      const { data: file } = await supabase.storage.from('covers').download(c.front_path);
      if (file) cover = { data: Buffer.from(await file.arrayBuffer()), type: 'image/png' };
    }
    body = await renderEpub(m, cover, normaliseLayout(book.layout));
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
                b.type === 'break'
                  ? '* * *'
                  : b.type === 'image'
                    ? md
                      ? `![${b.caption}](${b.src} "${b.size}")`
                      : `[Image${b.caption ? `: ${b.caption}` : ''}]`
                  : b.type === 'heading'
                    ? `${md ? '### ' : ''}${b.text}`
                    : b.type === 'list'
                      ? b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : '-'} ${fmt(it, md)}`).join('\n')
                      : b.type === 'quote'
                        ? `${md ? '> ' : '    '}${fmt(b.runs, md)}`
                        : fmt(b.runs, md),
              )
              .join('\n\n'),
        )
        .join('\n\n');
  }
  if (new URL(req.url).searchParams.get('preview') !== '1') await logActivity(user.id, 'book.exported', { bookId: book.id, format });
  return new Response(body as BodyInit, {
    headers: {
      ...headers,
      'Content-Type': TYPES[format],
      'Content-Disposition': `${new URL(req.url).searchParams.get('preview') === '1' ? 'inline' : 'attachment'}; filename="${slug(book.title)}.${format}"`,
      'Cache-Control': 'no-store',
      'Access-Control-Expose-Headers': 'X-Page-Count',
    },
  });
});
