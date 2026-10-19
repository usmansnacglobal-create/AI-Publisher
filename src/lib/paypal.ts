import 'server-only';
import type { PlanId } from './plans';
import { getBrand } from './brand-server';

// PAYPAL_API_BASE is only for automated tests against a stand-in PayPal.
const BASE = process.env.PAYPAL_API_BASE || (process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');

async function token() {
  const id = process.env.PAYPAL_CLIENT_ID ?? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PayPal is not configured.');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok && res.status !== 204) throw new Error(`PayPal ${path} failed (${res.status}): ${await res.text()}`);
  return (res.status === 204 ? {} : await res.json()) as T;
}

export interface PayPalSubscription {
  id: string;
  status: 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  plan_id: string;
  custom_id?: string;
  start_time?: string;
  billing_info?: { next_billing_time?: string; last_payment?: { time?: string; amount?: { value: string; currency_code: string } } };
}

export const getSubscription = (id: string) => call<PayPalSubscription>(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);

export const cancelSubscription = (id: string, reason: string) =>
  call(`/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });

export function planForPayPalPlan(planId: string): PlanId | null {
  if (planId && planId === process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO) return 'pro';
  if (planId && planId === process.env.NEXT_PUBLIC_PAYPAL_PLAN_AGENCY) return 'agency';
  return null;
}

/** Confirms a webhook really came from PayPal. */
export async function verifyWebhook(headers: Headers, rawBody: string) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const result = await call<{ verification_status: string }>('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  return result.verification_status === 'SUCCESS';
}

// ───────────── One-off payments (print orders) ─────────────

/** Whether one-off PayPal payments can be taken (client id and secret are set). */
export const paypalReady = () => !!((process.env.PAYPAL_CLIENT_ID ?? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID) && process.env.PAYPAL_CLIENT_SECRET);

export interface PayPalOrder {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  purchase_units?: { custom_id?: string; amount?: { value: string; currency_code: string }; payments?: { captures?: { id: string; status: string; amount: { value: string; currency_code: string } }[] } }[];
}

export const createPayPalOrder = async (o: { total: number; currency: string; customId: string; description: string }) =>
  call<PayPalOrder>('/v2/checkout/orders', {
    method: 'POST',
    headers: { 'PayPal-Request-Id': `print-${o.customId}` },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ custom_id: o.customId, description: o.description.slice(0, 127), amount: { currency_code: o.currency, value: o.total.toFixed(2) } }],
      application_context: { shipping_preference: 'NO_SHIPPING', brand_name: (await getBrand()).name.slice(0, 127), user_action: 'PAY_NOW' },
    }),
  });

export const capturePayPalOrder = (id: string) =>
  call<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, { method: 'POST', body: '{}', headers: { 'PayPal-Request-Id': `capture-${id}` } });

export const getPayPalOrder = (id: string) => call<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(id)}`);
