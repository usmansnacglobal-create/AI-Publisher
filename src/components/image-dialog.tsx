'use client';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, ImagePlus, Sparkles, Trash2, Upload } from 'lucide-react';
import { api, errorText } from '@/lib/client';
import { createClient } from '@/lib/supabase/client';
import { Button, Field, Modal } from '@/components/ui';
import type { ImageAttrs, ImageSize } from './book-image';

const SIZES: Record<ImageSize, string> = { small: 'Small (half width)', medium: 'Medium (three quarters)', full: 'Full width' };
const FRACTION: Record<ImageSize, number> = { small: 0.5, medium: 0.75, full: 1 };
const STYLES = [
  ['photo', 'Photo'],
  ['illustration', 'Illustration'],
  ['watercolour', 'Watercolour'],
  ['line', 'Line drawing'],
  ['diagram', 'Diagram (no words)'],
] as const;

/** Uploads an image file for a book and returns the address the editor uses. */
export async function uploadBookImage(bookId: string, file: Blob, type: string) {
  const sb = createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error('Please sign in again.');
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const name = `${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('manuscripts').upload(`${u.user.id}/${bookId}/images/${name}`, file, { contentType: type });
  if (error) throw error;
  return `/api/books/${bookId}/images/${name}`;
}

export function ImageDialog({
  open, bookId, current, canGenerate, textWidth, ink, onClose, onApply,
}: {
  open: boolean;
  bookId: string;
  current: ImageAttrs | null;
  canGenerate: boolean;
  /** Width of the text block in inches, for the print-quality hint. */
  textWidth: number;
  ink: 'bw' | 'standard' | 'premium';
  onClose: () => void;
  onApply: (attrs: ImageAttrs | null) => void;
}) {
  const [tab, setTab] = useState<'upload' | 'ai'>('upload');
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  const [size, setSize] = useState<ImageSize>('full');
  const [px, setPx] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<(typeof STYLES)[number][0]>('illustration');
  const [shape, setShape] = useState<'square' | 'landscape' | 'portrait'>('landscape');

  useEffect(() => {
    if (!open) return;
    setSrc(current?.src ?? '');
    setAlt(current?.alt ?? '');
    setSize(current?.title ?? 'full');
    setPx(null);
    setError('');
    setBusy('');
    setTab('upload');
  }, [open, current]);

  async function pick(file?: File) {
    if (!file) return;
    setError('');
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError('Use a JPG, PNG or WebP image.');
    if (file.size > 20 * 1024 * 1024) return setError('That image is over 20 MB. Save a smaller copy and try again.');
    setBusy('upload');
    try {
      setSrc(await uploadBookImage(bookId, file, file.type));
    } catch (e) {
      setError(errorText(e));
    }
    setBusy('');
  }

  async function generate() {
    setError('');
    setBusy('ai');
    try {
      const r = await api<{ src: string }>(`/api/books/${bookId}/images`, { body: { prompt, style, shape } });
      setSrc(r.src);
    } catch (e) {
      setError(errorText(e));
    }
    setBusy('');
  }

  const dpi = px ? Math.round(px.w / (textWidth * FRACTION[size])) : null;

  return (
    <Modal open={open} onClose={onClose} title={current ? 'Edit image' : 'Add an image'} wide>
      <div className="grid gap-5 sm:grid-cols-[1fr_280px]">
        <div className="space-y-4 text-[14px]">
          {!current && (
            <div className="flex rounded-md border border-line bg-ground p-1" role="tablist">
              <button role="tab" aria-selected={tab === 'upload'} onClick={() => setTab('upload')} className={clsx('flex flex-1 items-center justify-center gap-2 rounded px-3 py-1.5', tab === 'upload' ? 'bg-sheet shadow-sm' : 'text-ink-soft')}><Upload className="h-4 w-4" />Upload</button>
              <button role="tab" aria-selected={tab === 'ai'} onClick={() => setTab('ai')} className={clsx('flex flex-1 items-center justify-center gap-2 rounded px-3 py-1.5', tab === 'ai' ? 'bg-sheet shadow-sm' : 'text-ink-soft')}><Sparkles className="h-4 w-4" />Create with AI</button>
            </div>
          )}

          {(tab === 'upload' || current) && (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-line px-4 py-6 text-center hover:border-cloth">
              <ImagePlus className="h-6 w-6 text-ink-faint" aria-hidden />
              <span className="font-medium">{busy === 'upload' ? 'Uploading…' : current ? 'Replace with another image' : 'Choose a photo or picture'}</span>
              <span className="text-[12px] text-ink-muted">JPG, PNG or WebP. For print, use at least 1,800 pixels wide for a full-width image.</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          )}

          {tab === 'ai' && !current && (
            canGenerate ? (
              <div className="space-y-3">
                <Field label="What should the image show?" htmlFor="ai-prompt">
                  <textarea id="ai-prompt" className="field min-h-[90px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. A misty harbour at dawn with fishing boats" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Style" htmlFor="ai-style">
                    <select id="ai-style" className="field" value={style} onChange={(e) => setStyle(e.target.value as typeof style)}>
                      {STYLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Shape" htmlFor="ai-shape">
                    <select id="ai-shape" className="field" value={shape} onChange={(e) => setShape(e.target.value as typeof shape)}>
                      <option value="landscape">Landscape</option><option value="square">Square</option><option value="portrait">Portrait</option>
                    </select>
                  </Field>
                </div>
                <Button onClick={generate} loading={busy === 'ai'} disabled={prompt.trim().length < 5}>{busy === 'ai' ? 'Creating… about a minute' : 'Create image'}</Button>
                <p className="text-[12px] text-ink-muted">ChatGPT creates the image. It uses AI tokens, like cover artwork, and contains no words, so captions stay sharp and spelled right.</p>
              </div>
            ) : (
              <p className="rounded-md bg-ground px-3 py-2">Creating images with AI is part of the Pro and Agency plans. You can still upload your own.</p>
            )
          )}

          <Field label="Caption (optional)" htmlFor="img-alt" hint="Printed under the image, and read out by screen readers.">
            <input id="img-alt" className="field" value={alt} maxLength={300} onChange={(e) => setAlt(e.target.value)} />
          </Field>
          <fieldset>
            <legend className="label">Size on the page</legend>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SIZES) as ImageSize[]).map((k) => (
                <button key={k} type="button" className="chip" aria-pressed={size === k} onClick={() => setSize(k)}>{SIZES[k]}</button>
              ))}
            </div>
          </fieldset>
          {error && <p className="text-danger" role="alert">{error}</p>}
        </div>

        <div className="space-y-2">
          <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-md border border-line bg-ground">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt} onLoad={(e) => setPx({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} className={clsx('max-h-full max-w-full object-contain', ink === 'bw' && 'grayscale')} />
            ) : (
              <span className="px-4 text-center text-[13px] text-ink-muted">Your image will appear here</span>
            )}
          </div>
          {src && alt && <p className="text-center text-[13px] italic text-ink-muted">{alt}</p>}
          {px && dpi !== null && (
            <p className={clsx('flex gap-1.5 text-[12px]', dpi >= 300 ? 'text-cloth' : 'text-gilt-ink')}>
              {dpi < 300 && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
              {px.w} × {px.h} px · about {dpi} dpi at this size. {dpi >= 300 ? 'Sharp in print.' : dpi >= 200 ? 'May look slightly soft in print; a smaller size helps.' : 'Too low for print; choose a smaller size or a larger image.'}
            </p>
          )}
          {ink === 'bw' && src && <p className="text-[12px] text-ink-muted">Your book prints in black and white, so this shows it in greyscale. Change to colour on the Layout tab.</p>}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-line pt-4">
        {current ? <Button variant="ghost" onClick={() => onApply(null)}><Trash2 className="h-4 w-4" />Remove image</Button> : <span />}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onApply({ src, alt: alt.trim(), title: size })} disabled={!src || !!busy}>{current ? 'Save changes' : 'Insert image'}</Button>
        </div>
      </div>
    </Modal>
  );
}
