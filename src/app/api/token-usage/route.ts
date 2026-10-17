import { handle, json, requireUser } from '@/lib/api';
import { getUsage } from '@/lib/tokens';
import { FEATURE_LABELS } from '@/lib/plans';

export const dynamic = 'force-dynamic';

/** Usage this billing cycle, plus a breakdown by book and by feature. */
export const GET = handle(async () => {
  const { supabase, user } = await requireUser();
  const usage = await getUsage(user.id);
  const { data: rows } = await supabase
    .from('token_usage')
    .select('book_id, feature, provider, total_tokens, created_at')
    .gte('created_at', usage.periodStart)
    .order('created_at');
  const { data: books } = await supabase.from('books').select('id,title');
  const titles = new Map((books ?? []).map((b) => [b.id, b.title]));
  const byFeature: Record<string, number> = {};
  const byBook: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  for (const r of rows ?? []) {
    const f = FEATURE_LABELS[r.feature] ?? r.feature;
    byFeature[f] = (byFeature[f] ?? 0) + r.total_tokens;
    const b = r.book_id ? titles.get(r.book_id) ?? 'Deleted book' : 'Other';
    byBook[b] = (byBook[b] ?? 0) + r.total_tokens;
    const d = r.created_at.slice(0, 10);
    byDay[d] = (byDay[d] ?? 0) + r.total_tokens;
  }
  const { warned80: _a, warned100: _b, ...rest } = usage;
  return json({ data: rest, byFeature, byBook, byDay });
});
