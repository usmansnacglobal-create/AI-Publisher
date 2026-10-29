'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorText } from '@/lib/client';
import { Button } from '@/components/ui';
import { useToast } from '@/components/toast';

type SetupResult = { done: string[]; skipped: string[]; errors: string[] };

export function AdminBillingActions({ missing, anyProvider, elevenLabs, voices, refreshedAt }: { missing: number; anyProvider: boolean; elevenLabs: boolean; voices: number; refreshedAt: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<SetupResult | null>(null);

  async function setup() {
    setBusy('setup');
    try {
      const r = await api<SetupResult>('/api/admin/billing', { body: { action: 'setup' } });
      setResult(r);
      toast(r.errors.length ? `${r.errors.length} item${r.errors.length === 1 ? '' : 's'} couldn’t be created` : `${r.done.length} price${r.done.length === 1 ? '' : 's'} created`, r.errors.length ? 'error' : undefined);
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  async function refreshVoices() {
    setBusy('voices');
    try {
      const r = await api<{ count: number }>('/api/admin/billing', { body: { action: 'refresh-voices' } });
      toast(`${r.count} voices loaded from ElevenLabs`);
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={setup} loading={busy === 'setup'} disabled={!anyProvider}>{missing ? `Set up ${missing} missing price${missing === 1 ? '' : 's'}` : 'Check prices again'}</Button>
        {!anyProvider && <span className="text-[13px] text-ink-muted">Connect Stripe or PayPal first.</span>}
      </div>
      {result && (
        <div className="panel space-y-2 p-4 text-[13px]">
          {result.done.length > 0 && <p><span className="font-medium">Created:</span> {result.done.join('; ')}</p>}
          {result.skipped.length > 0 && <p className="text-ink-muted">Already there: {result.skipped.length}</p>}
          {result.errors.map((e) => <p key={e} className="text-danger">{e}</p>)}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4 text-[14px]">
        <Button variant="secondary" onClick={refreshVoices} loading={busy === 'voices'} disabled={!elevenLabs}>Refresh voice library now</Button>
        <span className="text-ink-muted">
          {voices ? `${voices} voices, updated ${new Date(refreshedAt!).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}. It also refreshes itself daily.` : 'Not loaded yet. It loads the first time an author opens the voice library.'}
        </span>
      </div>
    </div>
  );
}
