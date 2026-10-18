import 'server-only';
import { createAdminClient } from './supabase/admin';
import { normalisePricing, type PrintPricing } from './print-orders';
import { normaliseLayout } from './layout';
import type { Book } from './api';
import type { Binding, Ink, Paper } from './spine';

export async function getPricing(): Promise<PrintPricing> {
  const { data } = await createAdminClient().from('app_settings').select('value').eq('key', 'print_pricing').maybeSingle();
  return normalisePricing(data?.value);
}

export interface PrintReadiness {
  pages: number;
  trim: string;
  ink: Ink;
  paper: Paper;
  /** What's still needed before each binding can be ordered. */
  missing: Record<Binding, string[]>;
}

/** Whether the book's final print files exist, for each binding. */
export async function printReadiness(book: Book): Promise<PrintReadiness> {
  const admin = createAdminClient();
  const layout = normaliseLayout(book.layout);
  const [{ data: cover }, { data: files }] = await Promise.all([
    admin.from('covers').select('wrap_path').eq('book_id', book.id).maybeSingle(),
    admin.storage.from('covers').list(`${book.user_id}/${book.id}`, { search: 'cover-hardcover.pdf' }),
  ]);
  const base: string[] = [];
  const approved = !!book.layout_approved_at && new Date(book.content_updated_at) <= new Date(book.layout_approved_at);
  if (!approved) base.push(book.layout_approved_at ? 'Your text changed after you approved the layout. Approve it again on the Layout tab.' : 'Approve the layout on the Layout tab.');
  if (!book.page_count) base.push('Download the print interior (PDF) on the Layout tab, so the exact page count is known.');
  return {
    pages: book.page_count ?? 0,
    trim: book.trim_size,
    ink: layout.ink,
    paper: (book.paper as Paper) ?? 'white',
    missing: {
      paperback: [...base, ...(cover?.wrap_path ? [] : ['Export the full paperback cover on the Cover tab.'])],
      hardcover: [...base, ...(files?.some((f) => f.name === 'cover-hardcover.pdf') ? [] : ['Tick “Also make a hardcover cover” in the cover brief, then export your cover files.'])],
    },
  };
}
