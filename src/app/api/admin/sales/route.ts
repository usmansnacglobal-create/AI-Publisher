import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notify';

async function requireAdmin() {
  const { supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) throw new HttpError(403, 'Admins only.');
}

const Row = z.object({
  book_id: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Use a month like 2026-09.'),
  store: z.string().trim().min(1).max(60),
  format: z.enum(['ebook', 'paperback', 'hardcover', 'audiobook']),
  units: z.number().int().min(0).max(10_000_000),
  pages_read: z.number().int().min(0).max(1_000_000_000).default(0),
  revenue: z.number().min(0).max(100_000_000),
  royalty: z.number().min(0).max(100_000_000),
});

/** Adds monthly sales figures (one row or many from a pasted report). */
export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const body = z.object({ rows: z.array(Row).min(1).max(2000) }).safeParse(await req.json());
  if (!body.success) throw new HttpError(400, `Row ${Number(body.error.issues[0].path[1] ?? 0) + 1}: ${body.error.issues[0].message}`);
  const admin = createAdminClient();
  const ids = [...new Set(body.data.rows.map((r) => r.book_id))];
  const { data: books } = await admin.from('books').select('id,user_id,title').in('id', ids);
  const missing = ids.filter((id) => !books?.some((b) => b.id === id));
  if (missing.length) throw new HttpError(400, 'One of the books wasn’t found.');
  const rows = body.data.rows.map((r) => ({ ...r, period: `${r.period}-01`, user_id: books!.find((b) => b.id === r.book_id)!.user_id }));
  const { error } = await admin.from('sales').insert(rows);
  if (error) throw error;
  for (const b of books ?? []) {
    await notify(b.user_id, { pref: 'book_published', category: 'books', title: `New sales figures for ${b.title}`, body: 'Your latest sales and royalties are in Performance Analytics.', link: `/dashboard/analytics?book=${b.id}` });
  }
  return json({ added: rows.length }, 201);
});

export const DELETE = handle(async (req: Request) => {
  await requireAdmin();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) throw new HttpError(400, 'Missing id.');
  await createAdminClient().from('sales').delete().eq('id', id);
  return json({ ok: true });
});
