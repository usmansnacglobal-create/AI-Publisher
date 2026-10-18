import { forAI } from '@/lib/text';
import { z } from 'zod';
import { handle, requireUser } from '@/lib/api';
import { loadChapter, loadContext } from '@/lib/chapters';
import { streamText } from '@/lib/ai/claude';
import { bookBrief, bibleBlock } from '@/lib/ai/prompts';

export const maxDuration = 300;

/** "Ask AI anything" about the book: brainstorming, research questions, advice. */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const { question, history } = z
    .object({
      question: z.string().trim().min(1).max(4000),
      history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(8000) })).max(20).default([]),
    })
    .parse(await req.json());
  const chapter = await loadChapter(supabase, params.id);
  const { book, chapters, bible } = await loadContext(supabase, chapter);
  const outline = chapters.map((c) => `${c.position}. ${c.title}${c.synopsis ? ` — ${c.synopsis}` : ''}`).join('\n');
  const convo = history.map((h) => `${h.role === 'user' ? 'Author' : 'You'}: ${h.text}`).join('\n\n');

  const stream = await streamText({
    userId: user.id,
    bookId: book.id,
    feature: 'assist',
    maxTokens: 3000,
    system: `You are a friendly, expert writing partner helping an author with their book. Be concise and practical. Use short paragraphs or lists. If you draft text, keep it clearly separate so the author can copy it. For real people and events, be accurate and say when you're unsure.`,
    prompt: `${bookBrief(book)}${bibleBlock(bible)}

<outline>
${outline}
</outline>

<current_chapter number="${chapter.position}" title="${chapter.title.replace(/"/g, "'")}">
${forAI(chapter.content).slice(0, 30000)}
</current_chapter>
${convo ? `\n<conversation>\n${convo}\n</conversation>\n` : ''}
Author: ${question}`,
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
});
