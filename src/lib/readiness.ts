import { normaliseLayout } from './layout';
import { pageCountIssues } from './spine';
import 'server-only';
import { isTrackOutdated, type NarratorSettings, type StoredTrack } from './audiobook';
import type { Book } from './api';
import type { createClient } from './supabase/server';

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  fix: string;
  link: string;
}

/** What must be done before a book can be submitted for publishing. */
export async function readiness(supabase: ReturnType<typeof createClient>, book: Book, formats: string[]): Promise<Check[]> {
  const [{ data: chapters }, { data: cover }, { data: proof }] = await Promise.all([
    supabase.from('chapters').select('word_count,status').eq('book_id', book.id),
    supabase.from('covers').select('front_path,wrap_path').eq('book_id', book.id).maybeSingle(),
    supabase.from('reports').select('result').eq('book_id', book.id).eq('kind', 'proofread'),
  ]);
  const list = chapters ?? [];
  const empty = list.filter((c) => !c.word_count).length;
  const openIssues = (proof ?? []).reduce((s, r) => s + ((r.result as unknown[])?.length ?? 0), 0);
  const base = `/dashboard/books/${book.id}`;
  const checks: Check[] = [
    { id: 'chapters', label: 'Every chapter has text', ok: list.length > 0 && empty === 0, fix: empty ? `${empty} chapter${empty === 1 ? ' is' : 's are'} still empty.` : 'Add your chapters.', link: `${base}/write` },
    { id: 'proofread', label: 'Proofreading run, no open issues', ok: (proof ?? []).length > 0 && openIssues === 0, fix: (proof ?? []).length ? `${openIssues} proofreading issue${openIssues === 1 ? '' : 's'} still open.` : 'Run the proofreading check.', link: `${base}/proofread` },
    { id: 'cover', label: 'Front cover finished', ok: !!cover?.front_path, fix: 'Finish and export your cover.', link: `${base}/cover` },
    { id: 'blurb', label: 'Book description written', ok: !!book.blurb?.trim(), fix: 'Write or generate the description.', link: `${base}/publish` },
    { id: 'keywords', label: 'Keywords and categories chosen', ok: (book.keywords?.length ?? 0) > 0 && (book.categories?.length ?? 0) > 0, fix: 'Generate or enter keywords and categories.', link: `${base}/publish` },
  ];
  const print = formats.includes('paperback') || formats.includes('hardcover');
  const ink = normaliseLayout(book.layout).ink;
  const pages = book.page_count ?? 0;
  if (print) {
    checks.push(
      { id: 'layout', label: 'Interior layout approved', ok: !!book.layout_approved_at && new Date(book.content_updated_at) <= new Date(book.layout_approved_at), fix: book.layout_approved_at ? 'Your text changed since you approved the layout. Approve it again.' : 'Approve the layout.', link: `${base}/format` },
      { id: 'interior', label: 'Print interior created', ok: !!book.page_count, fix: 'Download the print PDF on the Layout tab.', link: `${base}/format` },
    );
  }
  if (formats.includes('paperback')) {
    const issues = pages ? pageCountIssues(pages, book.trim_size, ink, book.paper) : [];
    checks.push(
      { id: 'pages', label: 'Page count within Amazon’s paperback limits', ok: !issues.length, fix: issues[0] ?? '', link: `${base}/format` },
      { id: 'wrap', label: 'Full print cover (with spine) exported', ok: !!cover?.wrap_path, fix: 'Export the full paperback cover.', link: `${base}/cover` },
    );
  }
  if (formats.includes('hardcover')) {
    const issues = pages ? pageCountIssues(pages, book.trim_size, ink, book.paper, 'hardcover') : [];
    const { data: files } = await supabase.storage.from('covers').list(`${book.user_id}/${book.id}`, { search: 'cover-hardcover.pdf' });
    checks.push(
      { id: 'hc-pages', label: 'Size and page count suit a hardcover', ok: !issues.length, fix: issues[0] ?? '', link: `${base}/format` },
      { id: 'hc-cover', label: 'Hardcover cover exported', ok: !!files?.some((f) => f.name === 'cover-hardcover.pdf'), fix: 'Tick “Also make a hardcover cover” in the cover brief, then export.', link: `${base}/cover` },
    );
  }
  if (formats.includes('audiobook')) {
    const [{ data: ab }, { data: chs }] = await Promise.all([
      supabase.from('audiobooks').select('tracks, voice, engine, premium_voice_id, quality').eq('book_id', book.id).maybeSingle(),
      supabase.from('chapters').select('id, updated_at, word_count').eq('book_id', book.id),
    ]);
    const tracks = (ab?.tracks ?? {}) as Record<string, StoredTrack>;
    const settings: NarratorSettings = {
      engine: ab?.engine === 'premium' ? 'premium' : 'basic',
      voice: ab?.voice ?? '',
      premium_voice_id: ab?.premium_voice_id ?? null,
      quality: ab?.quality === 'standard' ? 'standard' : 'turbo',
    };
    const missing = (chs ?? []).filter((c) => c.word_count > 0 && (!tracks[c.id] || isTrackOutdated(tracks[c.id], c.updated_at, settings))).length;
    checks.push({ id: 'audio', label: 'Every chapter narrated', ok: !!ab && missing === 0, fix: `${missing || 'All'} chapter${missing === 1 ? '' : 's'} still to narrate.`, link: `${base}/audiobook` });
  }
  return checks;
}
