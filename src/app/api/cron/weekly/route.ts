import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Sunday progress digest (Vercel Cron, see vercel.json). */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new Response('unauthorised', { status: 401 });
  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: people } = await admin.from('profiles').select('id, notification_prefs');
  let sent = 0;
  for (const p of people ?? []) {
    if ((p.notification_prefs as Record<string, unknown>)?.weekly_summary !== true) continue;
    const { data: chapters } = await admin.from('chapters').select('word_count, books(title)').eq('user_id', p.id).gte('updated_at', since);
    if (!chapters?.length) continue;
    const words = chapters.reduce((s, c) => s + c.word_count, 0);
    const books = new Set(chapters.map((c) => (c.books as { title?: string } | null)?.title).filter(Boolean));
    await notify(p.id, {
      pref: 'weekly_summary',
      category: 'books',
      title: 'Your writing week',
      body: `You worked on ${chapters.length} chapter${chapters.length === 1 ? '' : 's'} across ${[...books].join(', ')}. Those chapters now total ${words.toLocaleString('en-GB')} words.`,
      link: '/dashboard',
    });
    sent++;
  }
  return Response.json({ sent });
}
