import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notify';

/** Publishing team: leave a note on a chapter that the author sees in the editor. */
export const PATCH = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') throw new HttpError(403, 'Only the publishing team can do this.');
  const { note } = z.object({ note: z.string().max(4000) }).parse(await req.json());
  const admin = createAdminClient();
  const { data: ch } = await admin.from('chapters').select('id, book_id, user_id, position, title').eq('id', params.id).single();
  if (!ch) throw new HttpError(404, 'Chapter not found.');
  await admin.from('chapters').update({ admin_note: note }).eq('id', ch.id);
  if (note.trim()) {
    await notify(ch.user_id, {
      pref: 'review_ready',
      category: 'books',
      title: `A note from our team on chapter ${ch.position}`,
      body: note.slice(0, 300),
      link: `/dashboard/books/${ch.book_id}/write?chapter=${ch.id}`,
    });
  }
  return json({ ok: true });
});

export const GET = handle(async (req: Request, { params }: { params: { id: string } }) => {
  // params.id is a book id here: list its chapters for the admin queue.
  const { supabase, user } = await requireUser();
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') throw new HttpError(403, 'Only the publishing team can do this.');
  const { data } = await createAdminClient().from('chapters').select('id, position, title, word_count, admin_note').eq('book_id', params.id).order('position');
  return json({ chapters: data ?? [] });
});
