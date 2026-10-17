import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';

type Ctx = { params: { id: string } };

/** Add a chapter at the end. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const body = z
    .object({ title: z.string().max(200).default(''), synopsis: z.string().max(2000).default('') })
    .parse(await req.json().catch(() => ({})));
  const { data: last } = await supabase
    .from('chapters').select('position').eq('book_id', book.id).order('position', { ascending: false }).limit(1);
  const position = (last?.[0]?.position ?? 0) + 1;
  const { data, error } = await supabase
    .from('chapters')
    .insert({ book_id: book.id, user_id: user.id, position, title: body.title || `Chapter ${position}`, synopsis: body.synopsis })
    .select('id')
    .single();
  if (error) throw error;
  if (position > book.target_chapters) await supabase.from('books').update({ target_chapters: position }).eq('id', book.id);
  return json({ id: data.id }, 201);
});

/** Reorder: body is the full list of chapter ids in the new order. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const { order } = z.object({ order: z.array(z.string().uuid()) }).parse(await req.json());
  const { data: chapters } = await supabase.from('chapters').select('id').eq('book_id', book.id);
  const ids = new Set((chapters ?? []).map((c) => c.id));
  if (order.length !== ids.size || !order.every((id) => ids.has(id))) throw new HttpError(400, 'Chapter list is out of date. Reload and try again.');
  // Two passes avoid clashing positions mid-update.
  for (const [i, id] of order.entries()) await supabase.from('chapters').update({ position: 10000 + i }).eq('id', id);
  for (const [i, id] of order.entries()) await supabase.from('chapters').update({ position: i + 1 }).eq('id', id);
  return json({ ok: true });
});
