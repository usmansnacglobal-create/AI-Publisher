import { z } from 'zod';
import { handle, json, requireUser } from '@/lib/api';

type Ctx = { params: { id: string; entryId: string } };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  const body = z
    .object({
      kind: z.enum(['character', 'place', 'item', 'event', 'rule']),
      name: z.string().trim().min(1).max(200),
      details: z.string().max(5000),
    })
    .partial()
    .parse(await req.json());
  const { error } = await supabase.from('bible_entries').update(body).eq('id', params.entryId).eq('book_id', params.id);
  if (error) throw error;
  return json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  await supabase.from('bible_entries').delete().eq('id', params.entryId).eq('book_id', params.id);
  return json({ ok: true });
});
