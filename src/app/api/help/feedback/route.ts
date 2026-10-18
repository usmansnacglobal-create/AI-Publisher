import { z } from 'zod';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { logActivity } from '@/lib/notify';

const Body = z.object({
  kind: z.enum(['article', 'answer', 'unanswered']),
  slug: z.string().max(80).optional(),
  question: z.string().max(500).optional(),
  helpful: z.boolean().optional(),
});

/** Records what the help assistant couldn't answer and which guides helped, so the guides can be improved. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, 'Invalid feedback.');
  await logActivity(user.id, 'help.feedback', parsed.data);
  return json({ ok: true }, 201);
});
