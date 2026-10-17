'use client';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

/** JSON fetch to our own API with readable errors. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'),
    headers: opts.form ? undefined : { 'Content-Type': 'application/json' },
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? 'Something went wrong. Try again.', res.status, (data as { code?: string }).code);
  return data as T;
}

/** Streams text from an AI route, calling onText with everything received so far. */
export async function stream(path: string, body: unknown, onText: (full: string) => void, signal?: AbortSignal): Promise<string> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError((data as { error?: string }).error ?? 'The AI request failed.', res.status, (data as { code?: string }).code);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onText(full);
  }
  const err = /\n*\[\[ERROR: (.+?)\]\]$/.exec(full);
  if (err) {
    onText(full.slice(0, err.index));
    throw new ApiError(err[1], 500);
  }
  return full;
}

export function errorText(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong. Try again.';
}
