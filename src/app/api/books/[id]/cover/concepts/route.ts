import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { requireFeature } from '@/lib/tokens';

type Concept = { path: string; prompt: string; created_at: string; kind: string };

/** Adds artwork that didn't come from AI (an upload, an imported cover or a template) to the concepts. */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  await requireFeature(user.id, 'cover');
  const body = z
    .object({ path: z.string(), kind: z.enum(['upload', 'template', 'import']), label: z.string().max(100).default(''), select: z.boolean().default(true) })
    .parse(await req.json());
  if (!body.path.startsWith(`${user.id}/${book.id}/`)) throw new HttpError(400, 'Invalid file.');
  const { data: cover } = await supabase.from('covers').select('concepts, selected_path').eq('book_id', book.id).maybeSingle();
  const concepts = [{ path: body.path, prompt: body.label, created_at: new Date().toISOString(), kind: body.kind }, ...((cover?.concepts ?? []) as Concept[])];
  const { error } = await supabase
    .from('covers')
    .upsert({ book_id: book.id, user_id: user.id, concepts, selected_path: body.select ? body.path : cover?.selected_path ?? body.path }, { onConflict: 'book_id' });
  if (error) throw error;
  return json({ ok: true });
});

/** Removes a concept and its file. */
export const DELETE = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const { path } = z.object({ path: z.string() }).parse(await req.json());
  const { data: cover } = await supabase.from('covers').select('concepts, selected_path').eq('book_id', book.id).maybeSingle();
  const { data: vers } = await supabase.from('cover_versions').select('selected_path').eq('book_id', book.id);
  if ((vers ?? []).some((v) => v.selected_path === path)) throw new HttpError(409, 'A saved cover version uses this artwork. Delete that version first.');
  const concepts = ((cover?.concepts ?? []) as Concept[]).filter((c) => c.path !== path);
  await supabase.from('covers').update({ concepts, selected_path: cover?.selected_path === path ? concepts[0]?.path ?? null : cover?.selected_path }).eq('book_id', book.id);
  if (path.startsWith(`${user.id}/${book.id}/`)) await supabase.storage.from('covers').remove([path]);
  return json({ ok: true });
});
