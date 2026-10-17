import { z } from 'zod';
import { handle, requireUser, HttpError } from '@/lib/api';
import { loadChapter, loadContext, snapshot } from '@/lib/chapters';
import { streamText } from '@/lib/ai/claude';
import { bookBrief, bibleBlock, WRITER_SYSTEM } from '@/lib/ai/prompts';
import { countWords } from '@/lib/text';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 300;

/**
 * Rewrites one whole chapter to an instruction. "Rewrite entire book" calls
 * this for each chapter in turn. The previous text is always saved as a
 * version first, so any rewrite can be undone.
 */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const { instruction } = z.object({ instruction: z.string().trim().min(3).max(3000) }).parse(await req.json());
  const chapter = await loadChapter(supabase, params.id);
  if (!chapter.content.trim()) throw new HttpError(400, 'This chapter has no text to rewrite.');
  const { book, bible } = await loadContext(supabase, chapter);
  await snapshot(supabase, chapter, 'Before book rewrite');

  const stream = await streamText({
    userId: user.id,
    bookId: book.id,
    feature: 'rewrite',
    system: WRITER_SYSTEM,
    maxTokens: Math.min(32000, Math.round(chapter.word_count * 2.2) + 2000),
    prompt: `${bookBrief(book)}${bibleBlock(bible)}

<chapter number="${chapter.position}" title="${chapter.title.replace(/"/g, "'")}">
${chapter.content}
</chapter>

Rewrite this entire chapter following this instruction: ${instruction}
Keep every plot point, fact and character beat unless the instruction says otherwise. Output the complete rewritten chapter only.`,
    onDone: async (text) => {
      if (!text.trim()) return;
      await createAdminClient()
        .from('chapters')
        .update({ content: text, word_count: countWords(text), status: 'drafted' })
        .eq('id', chapter.id)
        .eq('user_id', user.id);
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
});
