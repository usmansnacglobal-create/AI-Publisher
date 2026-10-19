'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Trash2 } from 'lucide-react';
import { api, errorText } from '@/lib/client';
import type { Brand } from '@/lib/brand';
import { Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

type Img = string | null | undefined; // data URL = new, null = remove, undefined = keep

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return reject(new Error('Use a PNG, JPG, WebP or SVG image.'));
    if (file.size > 2 * 1024 * 1024) return reject(new Error('That image is over 2 MB. Save a smaller copy and try again.'));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('That file couldn’t be read.'));
    r.readAsDataURL(file);
  });
}

function ImagePicker({ id, label, hint, current, value, onChange, dark }: { id: string; label: string; hint: string; current: string | null; value: Img; onChange: (v: Img) => void; dark?: boolean }) {
  const toast = useToast();
  const shown = value === undefined ? current : value;
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className={`grid h-20 w-48 place-items-center rounded-md border border-line p-2 ${dark ? 'bg-[#1D2128]' : 'bg-[#fff]'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {shown ? <img src={shown} alt="" className="max-h-full max-w-full object-contain" /> : <span className={`text-[12px] ${dark ? 'text-[#9BA2AD]' : 'text-ink-muted'}`}>None</span>}
        </div>
        <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 rounded border border-line-strong bg-sheet px-3 py-1.5 text-[14px] hover:border-ink-faint">
          <ImagePlus className="h-4 w-4" aria-hidden />{shown ? 'Replace' : 'Upload'}
          <input id={id} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { onChange(await readFile(f)); } catch (err) { toast(errorText(err), 'error'); } e.target.value = ''; }} />
        </label>
        {shown && <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 text-[14px] text-danger"><Trash2 className="h-4 w-4" aria-hidden />Remove</button>}
      </div>
      <p className="hint">{hint}</p>
    </div>
  );
}

export function BrandingForm({ initial }: { initial: Brand }) {
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [tagline, setTagline] = useState(initial.tagline);
  const [showName, setShowName] = useState(initial.showName);
  const [logo, setLogo] = useState<Img>(undefined);
  const [logoDark, setLogoDark] = useState<Img>(undefined);
  const [icon, setIcon] = useState<Img>(undefined);
  const [busy, setBusy] = useState(false);
  const v = initial.version;
  const cur = { logo: initial.hasLogo ? `/brand/logo?v=${v}` : null, dark: initial.hasDarkLogo ? `/brand/logo-dark?v=${v}` : null, icon: initial.hasIcon ? `/brand/icon?v=${v}` : null };
  const shownLogo = logo === undefined ? cur.logo : logo;
  const shownDark = logoDark === undefined ? cur.dark : logoDark;

  async function save() {
    setBusy(true);
    try {
      await api('/api/admin/branding', { method: 'PUT', body: { name, tagline, showName: showName || !shownLogo, logo, logoDark, icon } });
      toast('Branding saved. It now shows across the site.');
      setLogo(undefined); setLogoDark(undefined); setIcon(undefined);
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy(false);
  }

  const Preview = ({ dark }: { dark?: boolean }) => (
    <div className={`flex h-16 items-center gap-2.5 rounded-md border border-line px-4 ${dark ? 'bg-[#14171C]' : 'bg-[#EEF0EC]'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {(dark ? shownDark || shownLogo : shownLogo) && <img src={(dark ? shownDark || shownLogo : shownLogo)!} alt="" className="h-8 w-auto max-w-[180px] object-contain" />}
      {(showName || !shownLogo) && <span className={`font-serif text-[1.3rem] ${dark ? 'text-[#E6E8EC]' : 'text-[#1C2230]'}`}>{name || 'Your business'}</span>}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="panel space-y-5 p-5">
        <Field label="Business name" htmlFor="b-name" hint="Shown next to your logo, in browser tabs, emails and PayPal checkout.">
          <input id="b-name" className="field" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Tagline (optional)" htmlFor="b-tag" hint="A short line under your name on the sign-in pages, and the site’s description for search engines.">
          <input id="b-tag" className="field" maxLength={120} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Write, design and publish your book" />
        </Field>
        <ImagePicker id="b-logo" label="Logo" hint="PNG with a transparent background works best. Wide or square logos both work; it’s shown about 32 pixels tall." current={cur.logo} value={logo} onChange={setLogo} />
        <label className="flex items-start gap-2.5 text-[14px]">
          <input type="checkbox" className="mt-1 accent-cloth" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
          <span>Show the business name next to the logo<span className="block text-[12px] text-ink-muted">Turn off if your logo already includes the name.</span></span>
        </label>
        <ImagePicker id="b-dark" label="Logo for dark mode (optional)" hint="A light-coloured version for the dark theme. Without it, the normal logo is used." current={cur.dark} value={logoDark} onChange={setLogoDark} dark />
        <ImagePicker id="b-icon" label="Browser tab icon (optional)" hint="A square image. Without it, the icon is made from your logo." current={cur.icon} value={icon} onChange={setIcon} />
        <Button onClick={save} loading={busy} disabled={!name.trim()}>Save branding</Button>
      </div>
      <aside className="space-y-3">
        <p className="label">Preview</p>
        <Preview />
        <Preview dark />
      </aside>
    </div>
  );
}
