import { z } from 'zod';
import { handle, requireUser } from '@/lib/api';
import { loadChapter, loadContext, snapshot } from '@/lib/chapters';
import { streamText } from '@/lib/ai/claude';
import { chapterPrompt, WRITER_SYSTEM } from '@/lib/ai/prompts';
import { countWords, forAI, restoreImages } from '@/lib/text';
import { createAdminClient } from '@/lib/supabase/admin';
import { logActivity, notify } from '@/lib/notify';

export const maxDuration = 300;

/** Writes (or continues) a chapter, streaming the text as it's written. */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const { mode, guidance } = z
    .object({ mode: z.enum(['write', 'continue']).default('write'), guidance: z.string().max(2000).default('') })
    .parse(await req.json().catch(() => ({})));
  const chapter = await loadChapter(supabase, params.id);
  const { book, chapters, bible } = await loadContext(supabase, chapter);
  // "Outline only": write a detailed beat-by-beat plan into the chapter brief, not the text.
  if (mode === 'write' && chapter.settings?.mode === 'outline') {
    const stream = await streamText({
      userId: user.id,
      bookId: book.id,
      feature: 'outline',
      system: WRITER_SYSTEM,
      maxTokens: 2500,
      prompt: `${chapterPrompt(book, chapter, chapters, bible)}\n\nInstead of writing the chapter, write a detailed plan for the author to write from: 6–12 numbered beats, each 1–3 sentences, covering what happens or what is explained, key details to include, and how the chapter should end.${guidance ? `\nAuthor's notes: ${guidance}` : ''}`,
      onDone: async (text) => {
        await createAdminClient().from('chapters').update({ synopsis: text.slice(0, 6000) }).eq('id', chapter.id).eq('user_id', user.id);
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Target': 'synopsis' } });
  }

  await snapshot(supabase, chapter, mode === 'write' ? 'Before AI rewrite' : 'Before AI continue');

  let prompt = chapterPrompt(book, chapter, chapters, bible);
  if (mode === 'continue' && chapter.content.trim()) {
    prompt += `\n\nThe chapter so far:\n<chapter_so_far>\n${forAI(chapter.content).slice(-12000)}\n</chapter_so_far>\nContinue the chapter from exactly where it stops, about 800–1,200 words. Output only the new text.`;
  }
  if (guidance) prompt += `\n\nAuthor's notes for this chapter: ${guidance}`;

  const base = mode === 'continue' ? chapter.content.trimEnd() + '\n\n' : '';
  const stream = await streamText({
    userId: user.id,
    bookId: book.id,
    feature: 'chapter',
    system: WRITER_SYSTEM,
    prompt,
    maxTokens: mode === 'continue' ? 3000 : 16000,
    onDone: async (text) => {
      // A redraft keeps the author's images (added at the end if the new text doesn't place them).
      const content = mode === 'write' ? restoreImages(chapter.content, text) : base + text;
      // Admin client: the request may have ended, but the chapter must still be saved.
      await createAdminClient()
        .from('chapters')
        .update({ content, word_count: countWords(content), status: 'drafted', generated_at: new Date().toISOString() })
        .eq('id', chapter.id)
        .eq('user_id', user.id);
      await logActivity(user.id, 'chapter.generated', { bookId: book.id, chapter: chapter.position });
      await notify(user.id, {
        pref: 'ai_complete',
        category: 'ai',
        title: `Chapter ${chapter.position} is ready`,
        body: `"${chapter.title}" in ${book.title} has finished writing.`,
        link: `/dashboard/books/${book.id}/write?chapter=${chapter.id}`,
        event: 'chapter.generated',
      });
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
});
