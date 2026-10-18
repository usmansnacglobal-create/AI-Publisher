import { forAI } from '@/lib/text';
import { requireFeature } from '@/lib/tokens';
import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { completeStructured } from '@/lib/ai/claude';
import { bookBrief, bibleBlock } from '@/lib/ai/prompts';

export const maxDuration = 300;

const SCHEMA = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          quote: { type: 'string', description: 'Exact text from this chapter that has the problem' },
          problem: { type: 'string', description: 'What contradicts what, and where it was established' },
          fix: { type: 'string', description: 'Suggested correction' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['quote', 'problem', 'fix', 'severity'],
      },
    },
  },
  required: ['issues'],
};

/**
 * Checks one chapter against the story bible and summaries of earlier
 * chapters. The page calls this for each chapter to check the whole book.
 */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  await requireFeature(user.id, 'bible');
  const { chapterId } = z.object({ chapterId: z.string().uuid() }).parse(await req.json());
  const { data: chapters } = await supabase.from('chapters').select('id,position,title,synopsis,content').eq('book_id', book.id).order('position');
  const chapter = chapters?.find((c) => c.id === chapterId);
  if (!chapter) throw new HttpError(404, 'Chapter not found.');
  if (!chapter.content.trim()) return json({ issues: [] });
  const { data: bible } = await supabase.from('bible_entries').select('kind,name,details').eq('book_id', book.id);
  const earlier = (chapters ?? [])
    .filter((c) => c.position < chapter.position && c.content.trim())
    .map((c) => `<chapter n="${c.position}">\n${forAI(c.content).length > 9000 ? forAI(c.content).slice(0, 4500) + '\n[…]\n' + forAI(c.content).slice(-4500) : forAI(c.content)}\n</chapter>`)
    .join('\n')
    .slice(-250_000);

  const result = await completeStructured<{ issues: { quote: string; problem: string; fix: string; severity: string }[] }>({
    userId: user.id,
    bookId: book.id,
    feature: 'continuity',
    schema: SCHEMA,
    maxTokens: 5000,
    system: 'You are a sharp continuity editor. Report only genuine contradictions (names, ages, appearance, dates, timeline, geography, established facts, who knows what). Do not report style issues. If there are none, return an empty list.',
    prompt: `${bookBrief(book)}${bibleBlock(bible ?? [])}\n\n<earlier_chapters>\n${earlier}\n</earlier_chapters>\n\n<chapter_to_check n="${chapter.position}" title="${chapter.title.replace(/"/g, "'")}">\n${forAI(chapter.content)}\n</chapter_to_check>`,
  });

  await supabase.from('reports').delete().eq('chapter_id', chapter.id).eq('kind', 'continuity');
  await supabase.from('reports').insert({ book_id: book.id, chapter_id: chapter.id, user_id: user.id, kind: 'continuity', result: result.issues });
  return json({ issues: result.issues });
});

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const { supabase } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const { data } = await supabase.from('reports').select('chapter_id,result,created_at').eq('book_id', book.id).eq('kind', 'continuity');
  return json({ reports: data ?? [] });
});
