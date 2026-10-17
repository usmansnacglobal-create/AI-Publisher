import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { getPlan } from '@/lib/plans';
import { logActivity } from '@/lib/notify';

const Body = z.object({
  title: z.string().trim().min(1, 'Give your book a title.').max(200),
  subtitle: z.string().max(300).optional().default(''),
  book_type: z.enum(['fiction', 'nonfiction']),
  genre: z.string().max(100).optional().default(''),
  audience: z.string().max(500).optional().default(''),
  style: z.string().max(200).optional().default(''),
  tone: z.string().max(200).optional().default(''),
  summary: z.string().max(5000).optional().default(''),
  target_words: z.coerce.number().int().min(500).max(500000),
  target_chapters: z.coerce.number().int().min(1).max(200),
  author_name: z.string().max(200).optional().default(''),
  reader_outcome: z.string().max(3000).optional().default(''),
  key_message: z.string().max(1000).optional().default(''),
  pov: z.string().max(100).optional().default(''),
  pacing: z.string().max(100).optional().default(''),
  themes: z.array(z.string().max(60)).max(20).optional().default([]),
  dialect: z.string().max(60).optional().default('US English'),
  writing_mode: z.enum(['full', 'assist', 'outline']).optional().default('assist'),
  characters: z
    .array(z.object({ name: z.string().trim().min(1).max(200), role: z.string().max(200).default(''), traits: z.string().max(1000).default(''), goals: z.string().max(1000).default('') }))
    .max(40)
    .optional()
    .default([]),
  plan: z.array(z.object({ title: z.string().max(200).default(''), synopsis: z.string().max(3000).default('') })).max(200).optional().default([]),
  chapter_length: z.enum(['short', 'standard', 'long', 'custom']).optional(),
  chapter_words: z.number().int().min(200).max(15000).optional(),
});

export const POST = handle(async (req: Request) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

  const { characters, plan, chapter_length, chapter_words, ...fields } = parsed.data;
  const { data, error } = await supabase
    .from('books')
    .insert({ ...fields, user_id: user.id })
    .select('id')
    .single();

  if (error) {
    const m = /BOOK_LIMIT:(\w+):(\d+)/.exec(error.message);
    if (m) {
      const plan = getPlan(m[1]);
      const next = plan.id === 'free' ? 'Pro for up to 10 books' : 'Agency for unlimited books';
      throw new HttpError(
        403,
        `Your ${plan.name} plan allows ${m[2]} book${m[2] === '1' ? '' : 's'}, and you've reached that. Upgrade to ${next}, or delete a book you no longer need.`,
        'BOOK_LIMIT',
      );
    }
    throw error;
  }
  // Characters go straight into the story bible.
  if (characters.length) {
    await supabase.from('bible_entries').insert(
      characters.map((c) => ({
        book_id: data.id,
        user_id: user.id,
        kind: 'character',
        name: c.name,
        details: [c.role && `Role: ${c.role}`, c.traits && `Traits and flaws: ${c.traits}`, c.goals && `Goals: ${c.goals}`].filter(Boolean).join('. '),
      })),
    );
  }
  // A chapter plan from the wizard becomes the book's chapters straight away.
  // Rows the author left blank still become chapters, so the book keeps the chapter count they chose.
  const planned = plan.some((c) => c.title.trim() || c.synopsis.trim()) ? plan : [];
  if (planned.length) {
    const settings = { mode: fields.writing_mode, ...(chapter_length ? { length: chapter_length } : {}), ...(chapter_words ? { words: chapter_words } : {}) };
    await supabase.from('chapters').insert(
      planned.map((c, i) => ({ book_id: data.id, user_id: user.id, position: i + 1, title: c.title.trim() || `Chapter ${i + 1}`, synopsis: c.synopsis, settings })),
    );
  }
  await logActivity(user.id, 'book.created', { bookId: data.id, title: parsed.data.title });
  return json({ id: data.id, planned: planned.length }, 201);
});
