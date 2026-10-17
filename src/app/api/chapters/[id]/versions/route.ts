import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { loadChapter, snapshot } from '@/lib/chapters';
import { countWords } from '@/lib/text';

type Ctx = { params: { id: string } };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  const chapter = await loadChapter(supabase, params.id);
  const versionId = new URL(req.url).searchParams.get('version');
  if (versionId) {
    const { data } = await supabase.from('chapter_versions').select('*').eq('id', versionId).eq('chapter_id', chapter.id).single();
    if (!data) throw new HttpError(404, 'Version not found.');
    return json({ version: data });
  }
  const { data } = await supabase
    .from('chapter_versions')
    .select('id, label, word_count, created_at')
    .eq('chapter_id', chapter.id)
    .order('created_at', { ascending: false })
    .limit(100);
  return json({ versions: data ?? [] });
});

/** { label } saves a named version; { restore: versionId } restores one (saving the current text first). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { supabase } = await requireUser();
  const chapter = await loadChapter(supabase, params.id);
  const body = z.object({ label: z.string().max(100).optional(), restore: z.string().uuid().optional() }).parse(await req.json());
  if (body.restore) {
    const { data: v } = await supabase.from('chapter_versions').select('*').eq('id', body.restore).eq('chapter_id', chapter.id).single();
    if (!v) throw new HttpError(404, 'Version not found.');
    await snapshot(supabase, chapter, 'Before restore');
    const { data, error } = await supabase
      .from('chapters')
      .update({ content: v.content, word_count: countWords(v.content), status: v.content.trim() ? 'drafted' : 'planned' })
      .eq('id', chapter.id)
      .select('*')
      .single();
    if (error) throw error;
    return json({ chapter: data });
  }
  await snapshot(supabase, chapter, body.label || 'Saved version');
  return json({ ok: true });
});
