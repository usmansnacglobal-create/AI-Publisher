import { forAI } from '@/lib/text';
import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { loadChapter, loadContext } from '@/lib/chapters';
import { completeStructured, FAST_MODEL, WRITING_MODEL } from '@/lib/ai/claude';
import { bookBrief, bibleBlock, EDIT_ACTIONS, EDITOR_SYSTEM, SUGGESTIONS_SCHEMA } from '@/lib/ai/prompts';
import { locate } from '@/lib/apply';

export const maxDuration = 300;

/**
 * Produces tracked-change suggestions for a chapter. Nothing in the text
 * changes until the author accepts a suggestion.
 */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const body = z
    .object({
      action: z.string(),
      selection: z.string().max(20000).optional(),
      instruction: z.string().max(2000).optional(),
    })
    .parse(await req.json());
  const chapter = await loadChapter(supabase, params.id);
  if (!chapter.content.trim()) throw new HttpError(400, 'This chapter has no text to edit yet.');
  const { book, bible } = await loadContext(supabase, chapter);

  let instruction: string;
  if (body.action === 'custom') {
    if (!body.instruction?.trim()) throw new HttpError(400, 'Describe the change you want.');
    instruction = `${body.instruction}\nReturn the changes as suggestions.${body.selection ? ' Limit changes to the selected passage.' : ''}`;
  } else {
    const a = EDIT_ACTIONS[body.action];
    if (!a) throw new HttpError(400, 'Unknown edit.');
    if ((['expand', 'shorten'].includes(body.action) || a.group === 'selection') && !body.selection?.trim()) {
      throw new HttpError(400, 'Select a passage in the chapter first.');
    }
    instruction = a.instruction + (body.instruction?.trim() ? `\nThe author adds: ${body.instruction.trim()}` : '');
  }

  const deep = EDIT_ACTIONS[body.action]?.group === 'deep' || body.action === 'custom';
  const result = await completeStructured<{ suggestions: { original: string; replacement: string; reason: string }[] }>({
    userId: user.id,
    bookId: book.id,
    feature: deep ? 'deep_edit' : 'assist',
    model: ['grammar', 'sel_fix'].includes(body.action) ? FAST_MODEL : WRITING_MODEL,
    system: EDITOR_SYSTEM,
    maxTokens: deep ? 12000 : 5000,
    schema: SUGGESTIONS_SCHEMA,
    prompt: `${bookBrief(book)}${bibleBlock(bible)}

<chapter title="${chapter.title.replace(/"/g, "'")}">
${forAI(chapter.content)}
</chapter>
${body.selection ? `\n<selected_passage>\n${body.selection}\n</selected_passage>\n` : ''}
Task: ${instruction}`,
  });

  // Keep only suggestions whose original text really exists in the chapter.
  const valid = result.suggestions.filter(
    (s) => s.original.trim() && s.original !== s.replacement && locate(chapter.content, s.original),
  );
  if (!valid.length) return json({ suggestions: [], message: 'No changes needed here.' });
  const { data, error } = await supabase
    .from('suggestions')
    .insert(valid.map((s) => ({ ...s, chapter_id: chapter.id, user_id: user.id, kind: body.action })))
    .select('*');
  if (error) throw error;
  return json({ suggestions: data });
});
