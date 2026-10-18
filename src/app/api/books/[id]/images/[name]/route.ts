import { NextResponse } from 'next/server';
import { handle, requireUser, requireBook, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { imagePath, validImageName } from '@/lib/images';

/** Shows a book image to its author (or the publishing team) through a short-lived private link. */
export const GET = handle(async (_req: Request, { params }: { params: { id: string; name: string } }) => {
  const { supabase } = await requireUser();
  const book = await requireBook(supabase, params.id);
  if (!validImageName(params.name)) throw new HttpError(404, 'Image not found.');
  const { data } = await createAdminClient().storage.from('manuscripts').createSignedUrl(imagePath(book.user_id, book.id, params.name), 3600);
  if (!data?.signedUrl) throw new HttpError(404, 'Image not found.');
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { 'Cache-Control': 'private, max-age=600' } });
});
