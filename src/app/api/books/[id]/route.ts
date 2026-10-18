import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { logActivity } from '@/lib/notify';
import { TRIM_SIZES } from '@/lib/spine';
import { normaliseLayout } from '@/lib/layout';

const Patch = z
  .object({
    title: z.string().trim().min(1).max(200),
    subtitle: z.string().max(300),
    book_type: z.enum(['fiction', 'nonfiction']),
    genre: z.string().max(100),
    audience: z.string().max(500),
    style: z.string().max(200),
    tone: z.string().max(200),
    summary: z.string().max(5000),
    target_words: z.coerce.number().int().min(500).max(500000),
    target_chapters: z.coerce.number().int().min(1).max(200),
    trim_size: z.string().refine((t) => t in TRIM_SIZES, 'Unknown trim size.'),
    paper: z.enum(['white', 'cream']),
    blurb: z.string().max(4000),
    keywords: z.array(z.string().max(50)).max(7),
    categories: z.array(z.string().max(150)).max(3),
    author_bio: z.string().max(2000),
    dedication: z.string().max(1000),
    copyright_holder: z.string().max(200),
    author_name: z.string().max(200),
    reader_outcome: z.string().max(3000),
    key_message: z.string().max(1000),
    pov: z.string().max(100),
    pacing: z.string().max(100),
    themes: z.array(z.string().max(60)).max(20),
    dialect: z.string().max(60),
    writing_mode: z.enum(['full', 'assist', 'outline']),
    writing_sample: z.string().max(20000),
    language: z.string().max(60),
    edition: z.string().max(60),
    layout: z.record(z.string(), z.unknown()),
    approveLayout: z.boolean(),
  })
  .partial();

type Ctx = { params: { id: string } };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, position, title, synopsis, word_count, status, updated_at')
    .eq('book_id', book.id)
    .order('position');
  return json({ book, chapters: chapters ?? [] });
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  await requireBook(supabase, params.id);
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
  const { approveLayout, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest };
  // Changing the print size or interior design invalidates the measured page count and any approval.
  if ('trim_size' in updates) {
    updates.page_count = null;
    updates.layout_approved_at = null;
  }
  if ('layout' in updates) {
    updates.layout = normaliseLayout(updates.layout);
    // Colour interiors are printed on white paper only.
    if ((updates.layout as { ink: string }).ink !== 'bw') updates.paper = 'white';
    updates.page_count = null;
    updates.layout_approved_at = null;
  }
  if (approveLayout === true) updates.layout_approved_at = new Date().toISOString();
  if (approveLayout === false) updates.layout_approved_at = null;
  const { error } = await supabase.from('books').update(updates).eq('id', params.id);
  if (error) throw error;
  return json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  for (const bucket of ['covers', 'exports', 'manuscripts']) {
    const prefix = `${user.id}/${book.id}`;
    const { data: files } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    if (files?.length) await supabase.storage.from(bucket).remove(files.map((f) => `${prefix}/${f.name}`));
  }
  const { error } = await supabase.from('books').delete().eq('id', params.id);
  if (error) throw error;
  await logActivity(user.id, 'book.deleted', { title: book.title });
  return json({ ok: true });
});
