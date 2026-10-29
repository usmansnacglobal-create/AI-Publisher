import { handle, json, requireUser } from '@/lib/api';
import { getNarrationStatus } from '@/lib/narration';

export const dynamic = 'force-dynamic';

/** The author's narration credits: monthly allowance, what's left, and top-ups. */
export const GET = handle(async () => {
  const { user } = await requireUser();
  const { warned80: _a, warned100: _b, ...s } = await getNarrationStatus(user.id);
  return json(s);
});
