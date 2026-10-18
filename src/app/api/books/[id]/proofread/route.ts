import { requireFeature } from '@/lib/tokens';
import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { completeStructured, FAST_MODEL } from '@/lib/ai/claude';
import { locate, applyReplacement } from '@/lib/apply';
import { snapshot } from '@/lib/chapters';
import { countWords, forAI } from '@/lib/text';

export const maxDuration = 300;

const SCHEMA = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['spelling', 'grammar', 'punctuation', 'consistency', 'typography', 'word choice'] },
          original: { type: 'string', description: 'Exact text from the chapter, just long enough to be unique (usually the sentence fragment)' },
          replacement: { type: 'string' },
          explanation: { type: 'string', description: 'Short reason' },
        },
        required: ['type', 'original', 'replacement', 'explanation'],
      },
    },
  },
  required: ['issues'],
};

/** Proofreads one chapter. The page calls this per chapter to build the full-book report. */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  await requireFeature(user.id, 'proofread');
  const { chapterId, dialect } = z
    .object({ chapterId: z.string().uuid(), dialect: z.enum(['US', 'UK']).default('US') })
    .parse(await req.json());
  const { data: chapter } = await supabase.from('chapters').select('*').eq('id', chapterId).eq('book_id', book.id).single();
  if (!chapter) throw new HttpError(404, 'Chapter not found.');
  if (!chapter.content.trim()) return json({ issues: [] });

  const result = await completeStructured<{ issues: { type: string; original: string; replacement: string; explanation: string }[] }>({
    userId: user.id,
    bookId: book.id,
    feature: 'proofread',
    schema: SCHEMA,
    model: FAST_MODEL,
    maxTokens: 8000,
    system: `You are a professional proofreader using ${dialect === 'UK' ? 'British' : 'American'} English conventions. Find objective errors only: spelling, grammar, punctuation, inconsistent spelling or capitalisation of names, doubled words, wrong homophones, quote and dash typography. Do not rewrite for style. Leave deliberate dialect in dialogue alone.`,
    prompt: `<chapter title="${chapter.title.replace(/"/g, "'")}">\n${forAI(chapter.content)}\n</chapter>`,
  });
  const issues = result.issues.filter((i) => i.original !== i.replacement && locate(chapter.content, i.original));
  await supabase.from('reports').delete().eq('chapter_id', chapter.id).eq('kind', 'proofread');
  await supabase.from('reports').insert({ book_id: book.id, chapter_id: chapter.id, user_id: user.id, kind: 'proofread', result: issues });
  return json({ issues });
});

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const { supabase } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const { data } = await supabase.from('reports').select('chapter_id,result,created_at').eq('book_id', book.id).eq('kind', 'proofread');
  return json({ reports: data ?? [] });
});

/** Applies one or more fixes from the report straight to the chapter text. */
export const PUT = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  await requireFeature(user.id, 'proofread');
  const book = await requireBook(supabase, params.id);
  const { chapterId, fixes } = z
    .object({
      chapterId: z.string().uuid(),
      fixes: z.array(z.object({ original: z.string().min(1), replacement: z.string() })).min(1).max(500),
    })
    .parse(await req.json());
  const { data: chapter } = await supabase.from('chapters').select('*').eq('id', chapterId).eq('book_id', book.id).single();
  if (!chapter) throw new HttpError(404, 'Chapter not found.');
  await snapshot(supabase, chapter, 'Before proofreading fixes');
  let content: string = chapter.content;
  const applied: string[] = [];
  for (const f of fixes) {
    const next = applyReplacement(content, f.original, f.replacement);
    if (next !== null) {
      content = next;
      applied.push(f.original);
    }
  }
  await supabase.from('chapters').update({ content, word_count: countWords(content) }).eq('id', chapter.id);
  // Remove the applied items from the saved report.
  const { data: rep } = await supabase.from('reports').select('id,result').eq('chapter_id', chapter.id).eq('kind', 'proofread').single();
  if (rep) {
    const remaining = (rep.result as { original: string }[]).filter((i) => !applied.includes(i.original));
    await supabase.from('reports').update({ result: remaining }).eq('id', rep.id);
  }
  return json({ applied: applied.length, skipped: fixes.length - applied.length });
});

/** Dismisses one issue from the report without changing the text. */
export const PATCH = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase } = await requireUser();
  await requireBook(supabase, params.id);
  const { chapterId, original } = z.object({ chapterId: z.string().uuid(), original: z.string() }).parse(await req.json());
  const { data: rep } = await supabase.from('reports').select('id,result').eq('chapter_id', chapterId).eq('kind', 'proofread').single();
  if (rep) {
    const remaining = (rep.result as { original: string }[]).filter((i) => i.original !== original);
    await supabase.from('reports').update({ result: remaining }).eq('id', rep.id);
  }
  return json({ ok: true });
});
