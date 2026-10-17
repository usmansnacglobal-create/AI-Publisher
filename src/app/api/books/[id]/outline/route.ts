import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { completeStructured, WRITING_MODEL } from '@/lib/ai/claude';
import { bookBrief, bibleBlock, OUTLINE_SCHEMA, WRITER_SYSTEM } from '@/lib/ai/prompts';
import { logActivity } from '@/lib/notify';

export const maxDuration = 120;

/** Plans the chapters. Replaces chapters that haven't been written yet; never touches written ones. */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  const { guidance = '', chapter_length, chapter_words } = await req.json().catch(() => ({}));

  const { data: existing } = await supabase.from('chapters').select('*').eq('book_id', book.id).order('position');
  const written = (existing ?? []).filter((c) => c.word_count > 0);
  const remaining = book.target_chapters - written.length;
  if (remaining <= 0) throw new HttpError(400, 'Every chapter already has text. Add a chapter, or raise the chapter count in the book details.');
  const { data: bible } = await supabase.from('bible_entries').select('kind,name,details').eq('book_id', book.id);

  const result = await completeStructured<{ chapters: { title: string; synopsis: string }[] }>({
    userId: user.id,
    bookId: book.id,
    feature: 'outline',
    model: WRITING_MODEL,
    system: WRITER_SYSTEM,
    maxTokens: 6000,
    schema: OUTLINE_SCHEMA,
    prompt: `${bookBrief(book)}${bibleBlock(bible ?? [])}
${written.length ? `\nChapters already written (keep these, plan what follows):\n${written.map((c) => `${c.position}. ${c.title} — ${c.synopsis || c.content.slice(0, 300)}`).join('\n')}\n` : ''}
${guidance ? `\nAuthor's guidance: ${guidance}\n` : ''}
Plan exactly ${remaining} ${written.length ? 'further ' : ''}chapters with a strong overall arc.`,
  });

  const planned = result.chapters.slice(0, remaining);
  await supabase.from('chapters').delete().eq('book_id', book.id).eq('word_count', 0);
  const start = written.length;
  // Renumber written chapters first so positions stay contiguous.
  for (const [i, c] of written.entries()) {
    if (c.position !== i + 1) await supabase.from('chapters').update({ position: i + 1 }).eq('id', c.id);
  }
  const { error } = await supabase.from('chapters').insert(
    planned.map((c, i) => ({
      book_id: book.id,
      user_id: user.id,
      position: start + i + 1,
      title: c.title,
      synopsis: c.synopsis,
      settings: {
        mode: book.writing_mode ?? 'full',
        ...(['short', 'standard', 'long', 'custom'].includes(chapter_length) ? { length: chapter_length } : {}),
        ...(typeof chapter_words === 'number' ? { words: chapter_words } : {}),
      },
    })),
  );
  if (error) throw error;
  await logActivity(user.id, 'book.outlined', { bookId: book.id, chapters: planned.length });
  return json({ ok: true, count: planned.length });
});
