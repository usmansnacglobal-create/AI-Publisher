'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Field } from '@/components/ui';

function Verify() {
  const params = useSearchParams();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const sb = createClient();
    const { data } = await sb.auth.mfa.listFactors();
    const factor = data?.totp.find((f) => f.status === 'verified');
    if (!factor) return setError('No authenticator is set up on this account.');
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (error) return setError('That code didn’t work. Check your authenticator app and try again.');
    location.href = params.get('next') || '/dashboard';
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-[1.6rem]">Enter your code</h1>
      <p className="text-ink-muted">Open your authenticator app and enter the 6-digit code for AI Publisher.</p>
      <Field label="Code" htmlFor="code" error={error}>
        <input id="code" className="field tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      </Field>
      <Button type="submit" className="w-full" loading={busy}>Verify</Button>
    </form>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
