import { requireFeature } from '@/lib/tokens';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { completeStructured } from '@/lib/ai/claude';
import { bookBrief } from '@/lib/ai/prompts';

export const maxDuration = 300;

const SCHEMA = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['character', 'place', 'item', 'event', 'rule'] },
          name: { type: 'string' },
          details: { type: 'string', description: 'Key facts: appearance, age, relationships, traits, dates, rules. Note the chapter where each fact is established.' },
        },
        required: ['kind', 'name', 'details'],
      },
    },
  },
  required: ['entries'],
};

/** Reads the manuscript and fills the story bible with its characters, places and facts. */
export const POST = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  await requireFeature(user.id, 'bible');
  const { data: chapters } = await supabase.from('chapters').select('position,title,content').eq('book_id', book.id).order('position');
  const text = (chapters ?? []).filter((c) => c.content.trim());
  if (!text.length) throw new HttpError(400, 'Write or import some chapters first, then build the story bible from them.');
  const { data: existing } = await supabase.from('bible_entries').select('name').eq('book_id', book.id);
  const known = new Set((existing ?? []).map((e) => e.name.toLowerCase()));

  // Very long books are read in the first ~150k words, which covers almost every novel.
  let budget = 600_000;
  const manuscript = text
    .map((c) => `<chapter n="${c.position}" title="${c.title.replace(/"/g, "'")}">\n${c.content}\n</chapter>`)
    .filter((c) => (budget -= c.length) > 0)
    .join('\n');

  const result = await completeStructured<{ entries: { kind: string; name: string; details: string }[] }>({
    userId: user.id,
    bookId: book.id,
    feature: 'bible',
    schema: SCHEMA,
    maxTokens: 12000,
    system: 'You are a continuity editor building a story bible (series bible) for a book.',
    prompt: `${bookBrief(book)}\n\n${manuscript}\n\nList the important characters, places, items, events and world rules, with the concrete facts a continuity editor would check. ${known.size ? `Skip these, already recorded: ${[...known].join(', ')}.` : ''}`,
  });
  const fresh = result.entries.filter((e) => !known.has(e.name.toLowerCase()));
  if (fresh.length) {
    await supabase.from('bible_entries').insert(fresh.map((e) => ({ ...e, book_id: book.id, user_id: user.id })));
  }
  return json({ added: fresh.length });
});
