import { handle, json, requireUser, HttpError } from '@/lib/api';

/** Sends a sample event to the author's automation webhook (Agency plan). */
export const POST = handle(async () => {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('plan, webhook_url').eq('id', user.id).single();
  if (p?.plan !== 'agency') throw new HttpError(403, 'Automations are part of the Agency plan.');
  if (!p.webhook_url?.startsWith('https://')) throw new HttpError(400, 'Add an https:// webhook address first.');
  const res = await fetch(p.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'test', title: 'Test event from AI Publisher', at: new Date().toISOString() }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) throw new HttpError(502, `The webhook didn’t accept the test${res ? ` (status ${res.status})` : ''}. Check the address.`);
  return json({ ok: true });
});
