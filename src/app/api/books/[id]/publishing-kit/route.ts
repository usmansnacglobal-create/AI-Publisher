import { requireFeature } from '@/lib/tokens';
import { z } from 'zod';
import { handle, json, requireUser, requireBook, HttpError } from '@/lib/api';
import { completeStructured } from '@/lib/ai/claude';
import { bookBrief } from '@/lib/ai/prompts';

export const maxDuration = 120;

const FIELDS = ['blurb', 'tagline', 'keywords', 'categories', 'author_bio', 'social_posts'] as const;

const SCHEMA = {
  type: 'object',
  properties: {
    blurb: { type: 'string', description: 'Back-cover / store description, 150–250 words, with a hook opening line. Plain text paragraphs.' },
    tagline: { type: 'string', description: 'One-line hook for the front cover, under 12 words' },
    keywords: { type: 'array', items: { type: 'string' }, description: 'Exactly 7 Amazon KDP keyword phrases readers actually search, each under 50 characters, not repeating the title' },
    categories: { type: 'array', items: { type: 'string' }, description: '3 specific BISAC-style category paths, e.g. "Biography & Autobiography / Sports"' },
    author_bio: { type: 'string', description: 'Third-person author bio, 60–100 words' },
    social_posts: { type: 'array', items: { type: 'string' }, description: '4 launch posts for social media, each under 280 characters, varied angles' },
  },
};

/** Generates store-ready marketing copy. Saves blurb, keywords, categories and bio to the book. */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const book = await requireBook(supabase, params.id);
  await requireFeature(user.id, 'publish');
  const { fields, notes } = z
    .object({ fields: z.array(z.enum(FIELDS)).min(1), notes: z.string().max(2000).default('') })
    .parse(await req.json());
  const [{ data: chapters }, { data: profile }] = await Promise.all([
    supabase.from('chapters').select('position,title,synopsis,content').eq('book_id', book.id).order('position'),
    supabase.from('profiles').select('full_name,pen_name,bio,website').eq('id', user.id).single(),
  ]);
  const sample = (chapters ?? [])
    .map((c) => `${c.position}. ${c.title}: ${c.synopsis || c.content.slice(0, 600)}`)
    .join('\n')
    .slice(0, 40000);
  if (!sample && !book.summary) throw new HttpError(400, 'Add a summary or some chapters first, so the copy reflects your book.');

  const schema = {
    ...SCHEMA,
    properties: Object.fromEntries(fields.map((f) => [f, SCHEMA.properties[f]])),
    required: [...fields],
  };
  const result = await completeStructured<Record<string, string | string[]>>({
    userId: user.id,
    bookId: book.id,
    feature: 'publishing_kit',
    maxTokens: 3000,
    schema,
    system:
      'You are a book marketing specialist who writes high-converting, honest copy for Amazon, Apple Books and social media. Never make claims the book does not support, never invent reviews, awards or sales figures.',
    prompt: `${bookBrief(book)}\n\nAuthor: ${profile?.pen_name || profile?.full_name || 'the author'}${profile?.bio ? `\nAuthor's own notes about themselves: ${profile.bio}` : ''}\n\n<chapters>\n${sample}\n</chapters>${notes ? `\n\nAuthor's notes: ${notes}` : ''}`,
  });

  const updates: Record<string, unknown> = {};
  if (typeof result.blurb === 'string') updates.blurb = result.blurb;
  if (Array.isArray(result.keywords)) updates.keywords = result.keywords.slice(0, 7).map((k) => k.slice(0, 50));
  if (Array.isArray(result.categories)) updates.categories = result.categories.slice(0, 3);
  if (typeof result.author_bio === 'string') updates.author_bio = result.author_bio;
  if (Object.keys(updates).length) await supabase.from('books').update(updates).eq('id', book.id);
  return json(result);
});
