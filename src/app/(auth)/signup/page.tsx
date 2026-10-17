'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button, Field } from '@/components/ui';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) return setError('Use at least 10 characters for your password.');
    setBusy(true);
    setError('');
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard` },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) location.href = '/dashboard';
    else setSent(true);
  }

  if (sent)
    return (
      <div className="space-y-3">
        <h1 className="text-[1.6rem]">Check your email</h1>
        <p className="text-ink-muted">We sent a confirmation link to {email}. Open it to finish creating your account.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-[1.6rem]">Create your account</h1>
      <p className="text-ink-muted">Start free with one book. Upgrade any time.</p>
      <Field label="Your name" htmlFor="name">
        <input id="name" className="field" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Email" htmlFor="email">
        <input id="email" className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters.">
        <input id="password" className="field" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p className="text-[14px] text-danger" role="alert">{error}</p>}
      <Button type="submit" className="w-full" loading={busy}>
        Create account
      </Button>
      <p className="text-[13px] text-ink-muted">
        Your manuscripts stay private to you and are never used to train AI models.
      </p>
      <p className="text-[14px]">
        Already have an account? <Link href="/login" className="text-cloth underline">Sign in</Link>
      </p>
    </form>
  );
}
