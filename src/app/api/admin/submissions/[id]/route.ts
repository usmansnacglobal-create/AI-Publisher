import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { logActivity, notify } from '@/lib/notify';

const LABELS: Record<string, string> = {
  in_review: 'is being reviewed',
  changes_requested: 'needs a few changes',
  formatting: 'passed review and is being prepared for the stores',
  publishing: 'is being sent to the stores',
  live: 'is live',
  rejected: 'couldn’t be accepted for publishing',
  failed: 'hit a problem at the stores; our team is on it',
};

/** Publishing team only: move a submission to its next stage. */
export const PATCH = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') throw new HttpError(403, 'Only the publishing team can do this.');
  const body = z
    .object({
      status: z.enum(['in_review', 'changes_requested', 'formatting', 'publishing', 'live', 'rejected', 'failed']),
      isbn: z.string().max(20).optional(),
      notes: z.string().max(4000).optional(),
    })
    .parse(await req.json());

  const admin = createAdminClient();
  const { data: sub } = await admin.from('submissions').select('*, books(title)').eq('id', params.id).single();
  if (!sub) throw new HttpError(404, 'Submission not found.');
  const history = [...(sub.history ?? []), { status: body.status, at: new Date().toISOString(), note: body.notes ?? '' }];
  await admin
    .from('submissions')
    .update({ status: body.status, history, isbn: body.isbn ?? sub.isbn, reviewer_notes: body.notes ?? sub.reviewer_notes })
    .eq('id', sub.id);
  if (body.status === 'live') await admin.from('books').update({ status: 'published' }).eq('id', sub.book_id);
  if (['changes_requested', 'rejected'].includes(body.status)) await admin.from('books').update({ status: 'draft' }).eq('id', sub.book_id);

  const title = (sub.books as { title: string } | null)?.title ?? 'Your book';
  await notify(sub.user_id, {
    pref: body.status === 'live' ? 'book_published' : 'review_ready',
    category: 'books',
    title: `${title} ${LABELS[body.status]}`,
    body: body.notes || '',
    link: `/dashboard/books/${sub.book_id}/publish`,
    event: body.status === 'live' ? 'book.published' : 'book.status_changed',
  });
  await logActivity(sub.user_id, 'submission.status', { submissionId: sub.id, status: body.status });
  return json({ ok: true });
});
