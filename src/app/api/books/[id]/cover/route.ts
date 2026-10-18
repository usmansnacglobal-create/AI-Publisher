import { handle, json, requireUser, requireBook } from '@/lib/api';
import { DEFAULT_BRIEF, DEFAULT_DESIGN } from '@/lib/cover';
import { coverGeometry, estimatePages, pageCountIssues, spineTextAllowed, TRIM_SIZES } from '@/lib/spine';
import { normaliseLayout } from '@/lib/layout';
import { getPlan } from '@/lib/plans';

type Ctx = { params: { id: string } };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const [{ data: cover }, { data: chapters }, { data: profile }, { data: versions }] = await Promise.all([
    supabase.from('covers').select('*').eq('book_id', book.id).maybeSingle(),
    supabase.from('chapters').select('word_count').eq('book_id', book.id),
    supabase.from('profiles').select('full_name,pen_name,plan').eq('id', book.user_id).single(),
    supabase.from('cover_versions').select('id,name,status,selected_path,pages,trim_size,paper,created_at,updated_at').eq('book_id', book.id).order('created_at', { ascending: false }),
  ]);
  const words = (chapters ?? []).reduce((s, c) => s + c.word_count, 0);
  const brief = { ...DEFAULT_BRIEF, ...(cover?.brief ?? {}) };
  const pagesSource = brief.pageCountOverride ? 'yours' : book.page_count ? 'measured' : 'estimated';
  const pages = brief.pageCountOverride ?? book.page_count ?? estimatePages(Math.max(words, book.target_words), book.trim_size, book.target_chapters);

  const design = { ...DEFAULT_DESIGN, ...(cover?.design ?? {}) };
  const ink = normaliseLayout(book.layout).ink;
  const paths: string[] = [
    ...((cover?.concepts ?? []) as { path: string }[]).map((c) => c.path),
    ...brief.referencePaths,
    cover?.front_path,
    cover?.front_path?.replace('cover-front.png', 'cover-ebook.jpg'),
    cover?.wrap_path,
    cover?.social_path,
    design.backImagePath,
    design.authorPhotoPath,
    design.logoPath,
    ...(versions ?? []).map((v) => v.selected_path),
    `${book.user_id}/${book.id}/cover-hardcover.pdf`,
  ].filter(Boolean) as string[];
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data } = await supabase.storage.from('covers').createSignedUrls([...new Set(paths)], 3600);
    data?.forEach((d) => d.signedUrl && d.path && (urls[d.path] = d.signedUrl));
  }

  return json({
    book: { id: book.id, title: book.title, subtitle: book.subtitle, genre: book.genre, summary: book.summary, blurb: book.blurb, author_bio: book.author_bio, trim_size: book.trim_size, paper: book.paper },
    author: book.author_name || profile?.pen_name || profile?.full_name || '',
    cover: {
      brief,
      design,
      concepts: cover?.concepts ?? [],
      selected_path: cover?.selected_path ?? null,
      front_path: cover?.front_path ?? null,
      wrap_path: cover?.wrap_path ?? null,
      social_path: cover?.social_path ?? null,
      generations: cover?.generations ?? 0,
      runLimit: getPlan(profile?.plan).coverRunsPerBook,
    },
    versions: versions ?? [],
    urls,
    geometry: {
      pages,
      pagesSource,
      words,
      ink,
      ...coverGeometry(book.trim_size, pages, book.paper, ink, 'paperback'),
      spineText: spineTextAllowed(pages),
      issues: pageCountIssues(pages, book.trim_size, ink, book.paper),
      hardcover: { ...coverGeometry(book.trim_size, pages, book.paper, ink, 'hardcover'), issues: pageCountIssues(pages, book.trim_size, ink, book.paper, 'hardcover') },
    },
    hardcoverUrl: urls[`${book.user_id}/${book.id}/cover-hardcover.pdf`] ?? null,
    trims: TRIM_SIZES,
  });
});

/** Saves the brief and/or design. Trim size and paper are stored on the book so the interior matches. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const body = (await req.json()) as {
    brief?: Record<string, unknown>;
    design?: Record<string, unknown>;
    selected_path?: string | null;
    trim_size?: string;
    paper?: 'white' | 'cream';
    subtitle?: string;
    blurb?: string;
    author_bio?: string;
  };
  const bookUpdates: Record<string, unknown> = {};
  if (body.trim_size && body.trim_size in TRIM_SIZES && body.trim_size !== book.trim_size) {
    bookUpdates.trim_size = body.trim_size;
    bookUpdates.page_count = null;
  }
  if (body.paper === 'white' || body.paper === 'cream') bookUpdates.paper = body.paper;
  if (typeof body.subtitle === 'string') bookUpdates.subtitle = body.subtitle.slice(0, 300);
  if (typeof body.blurb === 'string') bookUpdates.blurb = body.blurb.slice(0, 4000);
  if (typeof body.author_bio === 'string') bookUpdates.author_bio = body.author_bio.slice(0, 2000);
  if (Object.keys(bookUpdates).length) await supabase.from('books').update(bookUpdates).eq('id', book.id);

  const row: Record<string, unknown> = { book_id: book.id, user_id: user.id };
  if (body.brief) row.brief = { ...DEFAULT_BRIEF, ...body.brief };
  if (body.design) row.design = { ...DEFAULT_DESIGN, ...body.design };
  if (body.selected_path !== undefined) row.selected_path = body.selected_path;
  const { error } = await supabase.from('covers').upsert(row, { onConflict: 'book_id' });
  if (error) throw error;
  return json({ ok: true });
});
