import { requireFeature } from '@/lib/tokens';
import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { readiness } from '@/lib/readiness';
import { createAdminClient } from '@/lib/supabase/admin';
import { logActivity, notify } from '@/lib/notify';

type Ctx = { params: { id: string } };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const formats = (new URL(req.url).searchParams.get('formats') ?? 'ebook,paperback').split(',');
  const { data: submissions } = await supabase.from('submissions').select('*').eq('book_id', book.id).order('created_at', { ascending: false });
  return json({ checks: await readiness(supabase, book, formats), submissions: submissions ?? [] });
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  await requireFeature(user.id, 'publish');
  const body = z
    .object({
      platforms: z.array(z.enum(['amazon_kdp', 'apple_books', 'kobo', 'barnes_noble', 'google_play', 'ingramspark'])).min(1, 'Choose at least one store.'),
      formats: z.array(z.enum(['ebook', 'paperback'])).min(1, 'Choose at least one format.'),
      price: z.number().min(0.99).max(250),
    })
    .safeParse(await req.json());
  if (!body.success) throw new HttpError(400, body.error.issues[0].message);

  const { data: open } = await supabase.from('submissions').select('id,status').eq('book_id', book.id).not('status', 'in', '(live,changes_requested)');
  if (open?.length) throw new HttpError(409, 'This book already has a submission in progress.');
  const checks = await readiness(supabase, book, body.data.formats);
  const missing = checks.filter((c) => !c.ok);
  if (missing.length) throw new HttpError(400, `Finish these first: ${missing.map((m) => m.label.toLowerCase()).join('; ')}.`);

  const now = new Date().toISOString();
  const { data: sub, error } = await supabase
    .from('submissions')
    .insert({ ...body.data, book_id: book.id, user_id: user.id, history: [{ status: 'submitted', at: now }] })
    .select('*')
    .single();
  if (error) throw error;
  const admin = createAdminClient();
  await admin.from('books').update({ status: 'in_review' }).eq('id', book.id);
  await logActivity(user.id, 'book.submitted', { bookId: book.id, submissionId: sub.id });
  await notify(user.id, { pref: 'review_ready', category: 'books', title: `${book.title} was submitted`, body: "We'll review it and keep you posted at each step.", link: `/dashboard/books/${book.id}/publish`, event: 'book.submitted' });
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  for (const a of admins ?? []) {
    await notify(a.id, { pref: 'review_ready', category: 'books', title: `New submission: ${book.title}`, link: '/admin' });
  }
  return json({ submission: sub }, 201);
});
