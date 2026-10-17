'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Field } from '@/components/ui';

export default function ResetPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) return setError('Use at least 10 characters.');
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    location.href = '/dashboard';
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-[1.6rem]">Choose a new password</h1>
      <Field label="New password" htmlFor="pw" error={error}>
        <input id="pw" className="field" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full" loading={busy}>Save password</Button>
    </form>
  );
}
