import 'server-only';
import { createAdminClient } from './supabase/admin';
import { getBrand } from './brand-server';

type Category = 'books' | 'ai' | 'billing' | 'system';
/** Which notification preference governs each kind of message. */
export type PrefKey =
  | 'ai_complete' | 'book_published' | 'review_ready' | 'token_warnings'
  | 'weekly_summary' | 'marketing' | 'billing';

export async function logActivity(userId: string, action: string, details: Record<string, unknown> = {}) {
  await createAdminClient().from('activity_logs').insert({ user_id: userId, action, details });
}

/**
 * Sends an in-app notification, an email (if RESEND_API_KEY is set) and the
 * user's automation webhook (Agency plan), respecting their preferences.
 */
export async function notify(
  userId: string,
  opts: { pref: PrefKey; category: Category; title: string; body?: string; link?: string; event?: string },
) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('email, notification_prefs, plan, webhook_url')
    .eq('id', userId)
    .single();
  if (!profile) return;
  const prefs = (profile.notification_prefs || {}) as Record<string, unknown>;
  const wanted = prefs[opts.pref] !== false;

  if (prefs.in_app !== false) {
    await admin.from('notifications').insert({
      user_id: userId,
      category: opts.category,
      title: opts.title,
      body: opts.body ?? '',
      link: opts.link ?? null,
    });
  }

  if (wanted && profile.email && process.env.RESEND_API_KEY && prefs.frequency !== 'weekly') {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? `${(await getBrand()).name} <noreply@example.com>`,
        to: profile.email,
        subject: opts.title,
        text: `${opts.body ?? ''}${opts.link ? `\n\nOpen: ${site}${opts.link}` : ''}`,
      }),
    }).catch((e) => console.error('email failed', e));
  }

  if (opts.event && profile.plan === 'agency' && profile.webhook_url?.startsWith('https://')) {
    await fetch(profile.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: opts.event, title: opts.title, body: opts.body, link: opts.link, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }
}
