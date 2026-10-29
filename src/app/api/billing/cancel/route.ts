import { z } from 'zod';
import { handle, json, requireUser } from '@/lib/api';
import { cancelRenewal, resumeRenewal } from '@/lib/billing';

const Body = z.object({ what: z.enum(['plan', 'narration']), resume: z.boolean().optional() });

/** Cancels (or, for card subscriptions, resumes) renewal of the main plan or the narration add-on. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireUser();
  const { what, resume } = Body.parse(await req.json());
  if (resume) {
    await resumeRenewal(user.id, what);
    return json({ ok: true });
  }
  const r = await cancelRenewal(user.id, what);
  return json({ ok: true, until: r.until });
});
