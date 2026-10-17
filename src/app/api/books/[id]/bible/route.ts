import { z } from 'zod';
import { handle, json, requireUser, requireBook } from '@/lib/api';

const Entry = z.object({
  kind: z.enum(['character', 'place', 'item', 'event', 'rule']),
  name: z.string().trim().min(1).max(200),
  details: z.string().max(5000).default(''),
});

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const { supabase } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const { data } = await supabase.from('bible_entries').select('*').eq('book_id', book.id).order('kind').order('name');
  return json({ entries: data ?? [] });
});

export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const entry = Entry.parse(await req.json());
  const { data, error } = await supabase.from('bible_entries').insert({ ...entry, book_id: book.id, user_id: user.id }).select('*').single();
  if (error) throw error;
  return json({ entry: data }, 201);
});
