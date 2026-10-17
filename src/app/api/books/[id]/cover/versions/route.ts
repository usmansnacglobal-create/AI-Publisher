import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { DEFAULT_BRIEF, DEFAULT_DESIGN } from '@/lib/cover';

type Ctx = { params: { id: string } };

/**
 * Cover versions. Every save is kept; one can be marked final.
 * POST { action: 'save', name, pages }            save the current design as a new version
 * POST { action: 'open', versionId }              load a version back into the designer
 * POST { action: 'duplicate', versionId }
 * POST { action: 'rename', versionId, name }
 * POST { action: 'final', versionId }             mark as the book's final cover
 * POST { action: 'delete', versionId }
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const body = z
    .object({
      action: z.enum(['save', 'open', 'duplicate', 'rename', 'final', 'delete']),
      versionId: z.string().uuid().optional(),
      name: z.string().trim().max(100).optional(),
      pages: z.number().int().positive().optional(),
    })
    .parse(await req.json());

  const getVersion = async () => {
    if (!body.versionId) throw new HttpError(400, 'Choose a version.');
    const { data } = await supabase.from('cover_versions').select('*').eq('id', body.versionId).eq('book_id', book.id).single();
    if (!data) throw new HttpError(404, 'Version not found.');
    return data;
  };

  if (body.action === 'save') {
    const { data: cover } = await supabase.from('covers').select('brief, design, selected_path').eq('book_id', book.id).maybeSingle();
    if (!cover?.selected_path) throw new HttpError(400, 'Choose artwork first.');
    const { count } = await supabase.from('cover_versions').select('id', { count: 'exact', head: true }).eq('book_id', book.id);
    const { data, error } = await supabase
      .from('cover_versions')
      .insert({
        book_id: book.id,
        user_id: user.id,
        name: body.name || `Version ${(count ?? 0) + 1}`,
        brief: cover.brief,
        design: cover.design,
        selected_path: cover.selected_path,
        pages: body.pages ?? null,
        trim_size: book.trim_size,
        paper: book.paper,
      })
      .select('id')
      .single();
    if (error) throw error;
    return json({ id: data.id });
  }

  const v = await getVersion();
  if (body.action === 'open') {
    await supabase
      .from('covers')
      .upsert(
        { book_id: book.id, user_id: user.id, brief: { ...DEFAULT_BRIEF, ...v.brief }, design: { ...DEFAULT_DESIGN, ...v.design }, selected_path: v.selected_path },
        { onConflict: 'book_id' },
      );
    return json({ ok: true });
  }
  if (body.action === 'duplicate') {
    const { id: _id, created_at: _c, updated_at: _u, status: _s, ...rest } = v;
    const { data, error } = await supabase.from('cover_versions').insert({ ...rest, name: `${v.name} (copy)`, status: 'draft' }).select('id').single();
    if (error) throw error;
    return json({ id: data.id });
  }
  if (body.action === 'rename') {
    if (!body.name) throw new HttpError(400, 'Give the version a name.');
    await supabase.from('cover_versions').update({ name: body.name }).eq('id', v.id);
    return json({ ok: true });
  }
  if (body.action === 'final') {
    await supabase.from('cover_versions').update({ status: 'draft' }).eq('book_id', book.id).neq('id', v.id);
    await supabase.from('cover_versions').update({ status: 'final' }).eq('id', v.id);
    return json({ ok: true });
  }
  await supabase.from('cover_versions').delete().eq('id', v.id);
  return json({ ok: true });
});
