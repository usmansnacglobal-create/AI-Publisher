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
});

export const POST = handle(async (req: Request) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

  const { data, error } = await supabase
    .from('books')
    .insert({ ...parsed.data, user_id: user.id })
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
  await logActivity(user.id, 'book.created', { bookId: data.id, title: parsed.data.title });
  return json({ id: data.id }, 201);
});
