'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { createClient } from '@/lib/supabase/client';
import { api, errorText } from '@/lib/client';
import { Badge, Button, Field, Modal, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';
import { ThemePicker } from '@/components/theme-picker';

type Profile = Record<string, unknown> & {
  id: string; full_name: string; pen_name: string; bio: string; website: string; twitter: string; linkedin: string; location: string; language: string;
  avatar_path: string | null; notification_prefs: Record<string, unknown>; webhook_url: string | null; plan: string;
};
const TABS = [['profile', 'Profile'], ['appearance', 'Appearance'], ['notifications', 'Notifications'], ['security', 'Security'], ['integrations', 'Automations'], ['danger', 'Delete account']] as const;

export function Settings({ tab, profile, email, avatarUrl }: { tab: string; profile: Profile; email: string; avatarUrl: string | null }) {
  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader title="Settings" />
      <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Settings sections">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/dashboard/settings?tab=${k}`} aria-current={tab === k ? 'page' : undefined} className={clsx('chip', tab === k && 'border-cloth bg-cloth-light text-cloth-dark')}>{l}</Link>
        ))}
      </nav>
      {tab === 'profile' && <ProfileTab profile={profile} email={email} avatarUrl={avatarUrl} />}
      {tab === 'appearance' && (
        <section className="panel space-y-3 p-5">
          <h2 className="text-[1.15rem]">Theme</h2>
          <p className="text-[14px] text-ink-muted">Choose how AI Publisher looks on this device. Your book files, covers and exports aren’t affected.</p>
          <ThemePicker />
        </section>
      )}
      {tab === 'notifications' && <NotificationsTab profile={profile} />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'integrations' && <IntegrationsTab profile={profile} />}
      {tab === 'danger' && <DangerTab />}
    </div>
  );
}

function ProfileTab({ profile, email, avatarUrl }: { profile: Profile; email: string; avatarUrl: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ full_name: profile.full_name, pen_name: profile.pen_name, bio: profile.bio, website: profile.website, twitter: profile.twitter, linkedin: profile.linkedin, location: profile.location, language: profile.language });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.full_name.trim()) return toast('Add your full name.', 'error');
    setBusy(true);
    const { error } = await createClient().from('profiles').update(f).eq('id', profile.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Profile saved');
    router.refresh();
  }
  async function photo(file?: File) {
    if (!file) return;
    if (!/image\/(png|jpeg)/.test(file.type) || file.size > 2 * 1024 * 1024) return toast('Use a JPG or PNG up to 2 MB.', 'error');
    const sb = createClient();
    const path = `${profile.id}/avatar-${Date.now()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
    const { error } = await sb.storage.from('avatars').upload(path, file, { contentType: file.type });
    if (error) return toast(error.message, 'error');
    if (profile.avatar_path) await sb.storage.from('avatars').remove([profile.avatar_path]);
    await sb.from('profiles').update({ avatar_path: path }).eq('id', profile.id);
    toast('Photo updated');
    router.refresh();
  }

  return (
    <form onSubmit={save} className="panel space-y-4 p-5">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {avatarUrl ? <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-full bg-cloth font-serif text-[1.4rem] text-white">{(f.full_name || email)[0]?.toUpperCase()}</div>}
        <label className="cursor-pointer text-[14px] text-cloth underline">
          Change photo<input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => photo(e.target.files?.[0])} />
        </label>
        <span className="text-[13px] text-ink-muted">JPG or PNG, up to 2 MB</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="fn"><input id="fn" className="field" required value={f.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
        <Field label="Pen name" htmlFor="pn" hint="Shown on your covers and title pages instead of your full name."><input id="pn" className="field" value={f.pen_name} onChange={(e) => set('pen_name', e.target.value)} /></Field>
        <Field label="Email" htmlFor="em" hint="Contact support to change your email address."><input id="em" className="field" disabled value={email} /></Field>
        <Field label="Location" htmlFor="loc"><input id="loc" className="field" value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
      </div>
      <Field label="Bio" htmlFor="bio" hint="Used as a starting point when AI writes your author bio."><textarea id="bio" className="field min-h-[100px]" value={f.bio} onChange={(e) => set('bio', e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Website" htmlFor="web"><input id="web" className="field" type="url" placeholder="https://" value={f.website} onChange={(e) => set('website', e.target.value)} /></Field>
        <Field label="X (Twitter) handle" htmlFor="tw"><input id="tw" className="field" placeholder="@" value={f.twitter} onChange={(e) => set('twitter', e.target.value)} /></Field>
        <Field label="LinkedIn" htmlFor="li"><input id="li" className="field" type="url" value={f.linkedin} onChange={(e) => set('linkedin', e.target.value)} /></Field>
      </div>
      <Field label="Writing language" htmlFor="lang" hint="Sets spelling for proofreading and the language tag on your ebooks.">
        <select id="lang" className="field sm:w-64" value={f.language} onChange={(e) => set('language', e.target.value)}>
          <option value="en">English (US)</option><option value="en-GB">English (UK)</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="pt">Portuguese</option><option value="it">Italian</option>
        </select>
      </Field>
      <Button type="submit" loading={busy}>Save changes</Button>
    </form>
  );
}

const PREFS: [string, string, string][] = [
  ['ai_complete', 'AI writing finished', 'When a chapter finishes generating'],
  ['book_published', 'Book published', 'When your book goes live in the stores'],
  ['review_ready', 'Publishing updates', 'When our team reviews your submission or it moves to the next step'],
  ['token_warnings', 'AI token warnings', 'At 80% and 100% of your monthly allowance'],
  ['weekly_summary', 'Weekly progress', 'A summary of your writing every Sunday'],
  ['billing', 'Billing', 'Plan changes, renewals and payment problems'],
  ['marketing', 'Tips and news', 'Publishing advice and product updates'],
];

function NotificationsTab({ profile }: { profile: Profile }) {
  const toast = useToast();
  const [p, setP] = useState<Record<string, unknown>>(profile.notification_prefs ?? {});
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const { error } = await createClient().from('profiles').update({ notification_prefs: p }).eq('id', profile.id);
    setBusy(false);
    toast(error ? error.message : 'Preferences saved', error ? 'error' : 'ok');
  }
  return (
    <div className="panel space-y-5 p-5">
      <section>
        <h2 className="text-[1.15rem]">Email me about</h2>
        <ul className="mt-3 divide-y divide-line">
          {PREFS.map(([k, l, d]) => (
            <li key={k} className="flex items-center justify-between gap-4 py-3">
              <label htmlFor={`p-${k}`} className="text-[14px]"><span className="block font-medium">{l}</span><span className="text-ink-muted">{d}</span></label>
              <input id={`p-${k}`} type="checkbox" className="h-5 w-5 accent-cloth" checked={p[k] !== false && !(p[k] === undefined && ['weekly_summary', 'marketing'].includes(k))} onChange={(e) => setP({ ...p, [k]: e.target.checked })} />
            </li>
          ))}
        </ul>
      </section>
      <label className="flex items-center gap-3 text-[14px]">
        <input type="checkbox" className="h-5 w-5 accent-cloth" checked={p.in_app !== false} onChange={(e) => setP({ ...p, in_app: e.target.checked })} />
        Show notifications inside the app
      </label>
      <Field label="Email frequency" htmlFor="freq">
        <select id="freq" className="field sm:w-64" value={String(p.frequency ?? 'realtime')} onChange={(e) => setP({ ...p, frequency: e.target.value })}>
          <option value="realtime">As it happens</option><option value="weekly">Weekly summary only</option>
        </select>
      </Field>
      <Button onClick={save} loading={busy}>Save preferences</Button>
    </div>
  );
}

function SecurityTab() {
  const toast = useToast();
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [busy, setBusy] = useState('');
  const [factor, setFactor] = useState<{ id: string } | null | undefined>(undefined);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');

  const refresh = async () => {
    const { data } = await createClient().auth.mfa.listFactors();
    setFactor(data?.totp.find((f) => f.status === 'verified') ?? null);
  };
  useEffect(() => { refresh(); }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next.length < 10) return toast('Use at least 10 characters.', 'error');
    if (pw.next !== pw.confirm) return toast('The two passwords don’t match.', 'error');
    setBusy('pw');
    const { error } = await createClient().auth.updateUser({ password: pw.next });
    setBusy('');
    if (error) return toast(error.message, 'error');
    await api('/api/account/log', { body: { action: 'security.password' } });
    setPw({ next: '', confirm: '' });
    toast('Password changed');
  }
  async function startEnroll() {
    setBusy('mfa');
    const sb = createClient();
    // Clear any half-finished setup first.
    const { data: list } = await sb.auth.mfa.listFactors();
    for (const f of list?.all ?? []) if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${Date.now()}` });
    setBusy('');
    if (error || !data) return toast(error?.message ?? 'Could not start setup.', 'error');
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }
  async function verify() {
    if (!enroll) return;
    setBusy('verify');
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enroll.id, code });
    setBusy('');
    if (error) return toast('That code didn’t work. Try the newest code in your app.', 'error');
    await api('/api/account/log', { body: { action: 'security.2fa_on' } });
    setEnroll(null);
    setCode('');
    toast('Two-factor sign-in is on');
    refresh();
  }
  async function disable() {
    if (!factor || !confirm('Turn off two-factor sign-in? Your account will only be protected by your password.')) return;
    const { error } = await createClient().auth.mfa.unenroll({ factorId: factor.id });
    if (error) return toast(error.message, 'error');
    await api('/api/account/log', { body: { action: 'security.2fa_off' } });
    toast('Two-factor sign-in is off');
    refresh();
  }
  async function signOutOthers() {
    const { error } = await createClient().auth.signOut({ scope: 'others' });
    toast(error ? error.message : 'Signed out on every other device', error ? 'error' : 'ok');
  }

  return (
    <div className="space-y-6">
      <form onSubmit={changePassword} className="panel space-y-4 p-5">
        <h2 className="text-[1.15rem]">Change password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" htmlFor="np"><input id="np" type="password" autoComplete="new-password" className="field" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <Field label="Confirm new password" htmlFor="cp"><input id="cp" type="password" autoComplete="new-password" className="field" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
        </div>
        <Button type="submit" loading={busy === 'pw'}>Update password</Button>
      </form>

      <section className="panel space-y-3 p-5">
        <div className="flex items-center gap-3">
          <h2 className="text-[1.15rem]">Two-factor sign-in</h2>
          {factor === undefined ? null : factor ? <Badge tone="cloth">On</Badge> : <Badge>Off</Badge>}
        </div>
        <p className="text-[14px] text-ink-muted">After your password, you’ll enter a code from an authenticator app such as Google Authenticator, 1Password or Authy.</p>
        {factor ? (
          <Button variant="secondary" onClick={disable}>Turn off</Button>
        ) : (
          <Button onClick={startEnroll} loading={busy === 'mfa'} disabled={factor === undefined}>Set up two-factor sign-in</Button>
        )}
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="text-[1.15rem]">Devices</h2>
        <p className="text-[14px] text-ink-muted">Signed in somewhere you don’t recognise? Sign out everywhere except this browser, then change your password.</p>
        <Button variant="secondary" onClick={signOutOthers}>Sign out other devices</Button>
      </section>

      <Modal open={!!enroll} onClose={() => setEnroll(null)} title="Set up two-factor sign-in">
        {enroll && (
          <div className="space-y-4 text-[14px]">
            <p>1. Scan this code with your authenticator app.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enroll.qr} alt="QR code for your authenticator app" className="mx-auto h-48 w-48 rounded bg-[#fff] p-2" />
            <p className="text-ink-muted">Can’t scan? Enter this key: <code className="break-all rounded bg-ground px-1">{enroll.secret}</code></p>
            <Field label="2. Enter the 6-digit code it shows" htmlFor="code">
              <input id="code" className="field tracking-[0.3em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Button onClick={verify} loading={busy === 'verify'} disabled={code.length !== 6}>Turn on</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function IntegrationsTab({ profile }: { profile: Profile }) {
  const toast = useToast();
  const [url, setUrl] = useState(profile.webhook_url ?? '');
  const [busy, setBusy] = useState('');
  if (profile.plan !== 'agency')
    return (
      <div className="panel space-y-3 p-5">
        <h2 className="text-[1.15rem]">Automations</h2>
        <p className="text-[14px] text-ink-muted">On the Agency plan, AI Publisher can notify Zapier, Make or your own systems when chapters finish, books are submitted or go live, so you can update a spreadsheet, message your team, or back up to Google Drive, Dropbox or Notion automatically.</p>
        <Link href="/dashboard/billing" className="inline-block text-[14px] font-medium text-cloth underline">See the Agency plan</Link>
      </div>
    );
  async function save() {
    if (url && !url.startsWith('https://')) return toast('The address must start with https://', 'error');
    setBusy('save');
    const { error } = await createClient().from('profiles').update({ webhook_url: url || null }).eq('id', profile.id);
    setBusy('');
    toast(error ? error.message : 'Saved', error ? 'error' : 'ok');
  }
  async function test() {
    setBusy('test');
    try {
      await save();
      await api('/api/account/webhook-test', { body: {} });
      toast('Test event delivered');
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy('');
  }
  return (
    <div className="panel space-y-4 p-5">
      <h2 className="text-[1.15rem]">Automations</h2>
      <p className="text-[14px] text-ink-muted">
        Paste a webhook address from Zapier (“Webhooks by Zapier → Catch Hook”), Make, or your own server. We send an event when a chapter finishes writing, a book is submitted, its publishing status changes, and when it goes live. From there you can connect Google Drive, Dropbox, Notion, Slack and thousands of other apps.
      </p>
      <Field label="Webhook address" htmlFor="wh"><input id="wh" className="field" type="url" placeholder="https://hooks.zapier.com/…" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
      <div className="flex gap-2">
        <Button onClick={save} loading={busy === 'save'}>Save</Button>
        <Button variant="secondary" onClick={test} loading={busy === 'test'} disabled={!url}>Send a test event</Button>
      </div>
    </div>
  );
}

function DangerTab() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await api('/api/account/delete', { body: { confirm: typed } });
      location.href = '/';
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy(false);
    }
  }
  return (
    <div className="rounded-md border border-danger/30 bg-sheet p-5">
      <h2 className="text-[1.15rem] text-danger">Delete your account</h2>
      <p className="mt-2 text-[14px] text-ink-muted">Permanently deletes your account, every book, chapter, cover and file, and cancels any paid plan. Download anything you want to keep first. This can’t be undone.</p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>Delete account</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <div className="space-y-4">
          <Field label="Type DELETE to confirm" htmlFor="del"><input id="del" className="field" value={typed} onChange={(e) => setTyped(e.target.value)} /></Field>
          <Button variant="danger" onClick={go} loading={busy} disabled={typed !== 'DELETE'}>Delete everything permanently</Button>
        </div>
      </Modal>
    </div>
  );
}
