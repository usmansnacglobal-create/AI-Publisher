'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Field } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(params.get('error') === 'link' ? 'That link has expired. Sign in, or request a new one.' : '');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError(/confirm/i.test(error.message) ? 'Confirm your email first. Check your inbox for the link.' : 'That email and password don’t match.');
      setBusy(false);
      return;
    }
    router.replace(params.get('next') || '/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-[1.6rem]">Sign in</h1>
      <Field label="Email" htmlFor="email">
        <input id="email" className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" className="field" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p className="text-[14px] text-danger" role="alert">{error}</p>}
      <Button type="submit" className="w-full" loading={busy}>
        Sign in
      </Button>
      <div className="flex justify-between text-[14px]">
        <Link href="/forgot-password" className="text-ink-muted underline">Forgot password?</Link>
        <Link href="/signup" className="text-cloth underline">Create an account</Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
