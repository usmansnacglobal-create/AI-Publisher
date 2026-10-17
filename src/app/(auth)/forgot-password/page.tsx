'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Field } from '@/components/ui';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/reset-password` });
    setBusy(false);
    setSent(true);
  }
  return sent ? (
    <div className="space-y-3">
      <h1 className="text-[1.6rem]">Check your email</h1>
      <p className="text-ink-muted">If an account exists for {email}, a reset link is on its way.</p>
    </div>
  ) : (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-[1.6rem]">Reset your password</h1>
      <Field label="Email" htmlFor="email">
        <input id="email" className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full" loading={busy}>Send reset link</Button>
    </form>
  );
}
