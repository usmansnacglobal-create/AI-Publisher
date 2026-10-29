import 'server-only';
import { createAdminClient } from './supabase/admin';

export interface CheckResult {
  group: string;
  label: string;
  ok: boolean;
  /** 'warn' items are optional: the site works without them, with a feature switched off. */
  level: 'required' | 'optional';
  detail: string;
  fix?: string;
}

/** Checks that a table (and optionally some of its columns) exists. */
async function hasColumns(table: string, columns = 'id') {
  const { error } = await createAdminClient().from(table).select(columns, { head: true, count: 'exact' }).limit(0);
  return !error;
}

const MIGRATIONS: { file: string; checks: [string, string][] }[] = [
  { file: '0001_init.sql', checks: [['profiles', 'id,plan,role'], ['books', 'id,trim_size'], ['chapters', 'id,content'], ['submissions', 'id,status'], ['token_usage', 'id,total_tokens']] },
  { file: '0002_old_tool_features.sql', checks: [['books', 'author_name,layout,layout_approved_at'], ['cover_versions', 'id'], ['audiobooks', 'id,tracks'], ['chapters', 'settings,admin_note']] },
  { file: '0003_print_options.sql', checks: [['submissions', 'hardcover_price']] },
  { file: '0004_print_orders_and_analytics.sql', checks: [['print_orders', 'id,total,status'], ['sales', 'id,royalty'], ['app_settings', 'key,value'], ['submissions', 'store_links']] },
  { file: '0005_narration_and_billing.sql', checks: [['profiles', 'currency,stripe_customer_id'], ['narration_accounts', 'user_id,topup_credits'], ['narration_usage', 'id,credits'], ['elevenlabs_voices', 'voice_id'], ['billing_catalog', 'item'], ['payments', 'provider,external_id'], ['audiobooks', 'engine,quality']] },
];

const env = (k: string) => !!process.env[k]?.trim();

export async function runSystemCheck(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];

  // Database changes
  for (const m of MIGRATIONS) {
    const results = await Promise.all(m.checks.map(([t, c]) => hasColumns(t, c)));
    const missing = m.checks.filter((_, i) => !results[i]).map(([t]) => t);
    out.push({
      group: 'Database', label: m.file, level: 'required', ok: !missing.length,
      detail: missing.length ? `Not applied yet (missing: ${[...new Set(missing)].join(', ')}).` : 'Applied.',
      fix: missing.length ? `In Supabase, open SQL Editor → New query, paste everything from supabase/migrations/${m.file} and click Run.` : undefined,
    });
  }

  // File storage
  const storage = createAdminClient().storage;
  const { data: buckets, error } = await storage.listBuckets();
  const names = new Set((buckets ?? []).map((b) => b.name));
  for (const b of ['covers', 'manuscripts', 'exports', 'avatars', 'audio']) {
    // If listing all storage isn't possible, try the area itself.
    const present = !error ? names.has(b) : !(await storage.from(b).list('', { limit: 1 })).error;
    out.push({
      group: 'File storage', label: `“${b}” storage`, level: 'required', ok: present,
      detail: present ? 'Present.' : 'Missing.',
      fix: present ? undefined : b === 'audio' ? 'Run 0002_old_tool_features.sql, which creates it.' : 'Run 0001_init.sql, which creates it.',
    });
  }

  // Keys and settings in Vercel
  const key = (group: string, label: string, names: string[], level: CheckResult['level'], what: string, fix: string) => {
    const missing = names.filter((n) => !env(n));
    out.push({ group, label, level, ok: !missing.length, detail: missing.length ? `Not set: ${missing.join(', ')}. ${what}` : 'Set.', fix: missing.length ? fix : undefined });
  };
  key('Core', 'Supabase connection', ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'], 'required', 'The site can’t work without these.', 'Add them in Vercel → Settings → Environment Variables, then redeploy.');
  key('Core', 'Site address', ['NEXT_PUBLIC_SITE_URL'], 'optional', 'Links in emails use it.', 'Add NEXT_PUBLIC_SITE_URL (e.g. https://ai-publisher-delta.vercel.app) in Vercel, then redeploy.');
  key('AI', 'Claude (writing, editing, proofreading)', ['ANTHROPIC_API_KEY'], 'required', 'All AI writing and editing is switched off until it’s added.', 'Create a key at console.anthropic.com, add ANTHROPIC_API_KEY in Vercel, then redeploy.');
  key('AI', 'ChatGPT (covers, illustrations, basic narration)', ['OPENAI_API_KEY'], 'required', 'AI covers, AI images and basic audiobook voices are switched off until it’s added.', 'Create a key at platform.openai.com, add OPENAI_API_KEY in Vercel, then redeploy.');
  key('AI', 'ElevenLabs (premium narration)', ['ELEVENLABS_API_KEY'], 'optional', 'Premium narration is switched off; basic voices still work.', 'Create an API key at elevenlabs.io (Developers → API keys), add ELEVENLABS_API_KEY in Vercel, then redeploy. Use a paid ElevenLabs plan (Starter or above): library voices aren’t available through the API on the free plan.');
  key('Payments', 'Stripe (card payments)', ['STRIPE_SECRET_KEY'], 'optional', 'Authors can’t pay by card yet.', 'In Stripe → Developers → API keys, copy the secret key into STRIPE_SECRET_KEY in Vercel, then open Admin → Billing setup.');
  key('Payments', 'Stripe webhook', ['STRIPE_WEBHOOK_SECRET'], 'optional', 'Card renewals, failed payments and cancellations won’t update subscriptions automatically.', 'See Admin → Billing setup for the webhook address and events, then put its signing secret in STRIPE_WEBHOOK_SECRET.');
  key('Payments', 'PayPal (plans and print orders)', ['NEXT_PUBLIC_PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'], 'optional', 'Authors can’t pay for plans or print orders online yet.', 'Create a PayPal REST app, add its client ID and secret in Vercel, then redeploy.');
  key('Payments', 'PayPal webhook', ['PAYPAL_WEBHOOK_ID'], 'optional', 'Renewals, failed payments and cancellations made in PayPal won’t update plans automatically.', 'Add a webhook in your PayPal app pointing to /api/billing/paypal/webhook and put its ID in PAYPAL_WEBHOOK_ID.');
  out.push({
    group: 'Payments', label: 'PayPal mode', level: 'optional', ok: process.env.PAYPAL_ENV === 'live' || !env('PAYPAL_CLIENT_SECRET'),
    detail: process.env.PAYPAL_ENV === 'live' ? 'Live: real payments.' : env('PAYPAL_CLIENT_SECRET') ? 'Sandbox: test payments only, no real money is taken.' : 'Not in use.',
    fix: process.env.PAYPAL_ENV === 'live' || !env('PAYPAL_CLIENT_SECRET') ? undefined : 'When you’re ready for real payments, set PAYPAL_ENV=live with your live PayPal keys.',
  });
  key('Email', 'Email sending (Resend)', ['RESEND_API_KEY', 'EMAIL_FROM'], 'optional', 'Notifications appear in the app only, not by email.', 'Create a Resend account, verify your domain, add RESEND_API_KEY and EMAIL_FROM in Vercel.');
  key('Automation', 'Scheduled jobs', ['CRON_SECRET'], 'optional', 'The weekly progress email can’t run.', 'Add any long random text as CRON_SECRET in Vercel.');

  // Prices created in Stripe and PayPal (Admin → Billing setup)
  if (out.find((r) => r.label === '0005_narration_and_billing.sql')?.ok && (env('STRIPE_SECRET_KEY') || env('PAYPAL_CLIENT_SECRET'))) {
    const { count } = await createAdminClient().from('billing_catalog').select('item', { count: 'exact', head: true });
    out.push({
      group: 'Payments', label: 'Plan prices in Stripe and PayPal', level: 'optional', ok: (count ?? 0) > 0,
      detail: count ? `${count} prices set up.` : 'Not set up yet, so the pay buttons can’t start a payment.',
      fix: count ? undefined : 'Open Admin → Billing setup and click “Set up missing prices”.',
    });
  }

  // Settings stored in the database
  if (out.find((r) => r.label === '0004_print_orders_and_analytics.sql')?.ok) {
    const { data } = await createAdminClient().from('app_settings').select('updated_at').eq('key', 'print_pricing').maybeSingle();
    out.push({
      group: 'Print orders', label: 'Print pricing', level: 'optional', ok: !!data,
      detail: data ? `Saved ${new Date(data.updated_at).toLocaleDateString('en-GB')}.` : 'Using the starting estimates.',
      fix: data ? undefined : 'Open Admin → Print orders, check the IngramSpark rates and shipping prices, and click Save print pricing.',
    });
  }
  const { count: admins } = await createAdminClient().from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
  out.push({ group: 'Accounts', label: 'Admin accounts', level: 'required', ok: (admins ?? 0) > 0, detail: `${admins ?? 0} admin account${admins === 1 ? '' : 's'}.` });
  return out;
}
