'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorText } from '@/lib/client';
import { Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';
import { GENRES } from '@/lib/genres';

export function NewBookForm() {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({
    title: '', subtitle: '', book_type: 'fiction' as 'fiction' | 'nonfiction', genre: '', audience: '', style: '', tone: '', summary: '',
    target_words: 60000, target_chapters: 20,
  });
  const [start, setStart] = useState<'plan' | 'import' | 'blank'>('plan');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (start === 'import' && !file) return toast('Choose a manuscript file to import.', 'error');
    try {
      setBusy('Creating your book…');
      const { id } = await api<{ id: string }>('/api/books', { body: f });
      if (start === 'plan') {
        setBusy('Planning your chapters… this takes about a minute.');
        await api(`/api/books/${id}/outline`, { body: {} }).catch((err) => toast(`Book created, but planning failed: ${errorText(err)}`, 'error'));
      } else if (start === 'import' && file) {
        setBusy('Importing your manuscript…');
        const form = new FormData();
        form.set('file', file);
        await api(`/api/books/${id}/import`, { form }).catch((err) => toast(`Book created, but the import failed: ${errorText(err)}`, 'error'));
      } else {
        await api(`/api/books/${id}/chapters`, { body: { title: 'Chapter 1' } });
      }
      router.push(`/dashboard/books/${id}`);
      router.refresh();
    } catch (err) {
      toast(errorText(err), 'error');
      setBusy('');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="panel space-y-4 p-5">
        <Field label="Title" htmlFor="title">
          <input id="title" className="field" required maxLength={200} value={f.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Subtitle (optional)" htmlFor="subtitle">
          <input id="subtitle" className="field" maxLength={300} value={f.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
        </Field>
        <fieldset>
          <legend className="label">Type</legend>
          <div className="flex gap-2">
            {(['fiction', 'nonfiction'] as const).map((t) => (
              <button type="button" key={t} className="chip" aria-pressed={f.book_type === t} onClick={() => { set('book_type', t); set('genre', ''); }}>
                {t === 'fiction' ? 'Fiction' : 'Non-fiction'}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Genre" htmlFor="genre">
            <select id="genre" className="field" required value={f.genre} onChange={(e) => set('genre', e.target.value)}>
              <option value="">Choose a genre</option>
              {GENRES[f.book_type].map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Who is it for?" htmlFor="audience">
            <input id="audience" className="field" placeholder="e.g. Football fans, adults" value={f.audience} onChange={(e) => set('audience', e.target.value)} />
          </Field>
          <Field label="Writing style" htmlFor="style">
            <input id="style" className="field" placeholder="e.g. Storytelling, close third person" value={f.style} onChange={(e) => set('style', e.target.value)} />
          </Field>
          <Field label="Tone" htmlFor="tone">
            <input id="tone" className="field" placeholder="e.g. Inspirational, warm" value={f.tone} onChange={(e) => set('tone', e.target.value)} />
          </Field>
        </div>
        <Field label="What’s it about?" htmlFor="summary" hint="A few sentences: the premise, key people or characters, and what readers come away with.">
          <textarea id="summary" className="field min-h-[120px]" maxLength={5000} value={f.summary} onChange={(e) => set('summary', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Target length (words)" htmlFor="words" hint="Novels are usually 60,000–100,000.">
            <input id="words" className="field" type="number" min={500} max={500000} step={500} value={f.target_words} onChange={(e) => set('target_words', Number(e.target.value))} />
          </Field>
          <Field label="Chapters" htmlFor="chapters">
            <input id="chapters" className="field" type="number" min={1} max={200} value={f.target_chapters} onChange={(e) => set('target_chapters', Number(e.target.value))} />
          </Field>
        </div>
      </section>

      <fieldset className="panel space-y-3 p-5">
        <legend className="sr-only">How do you want to start?</legend>
        <h2 className="text-[1.15rem]">How do you want to start?</h2>
        {[
          ['plan', 'Plan the chapters with AI', 'Claude drafts a chapter-by-chapter outline from your description. You can edit it before writing.'],
          ['import', 'Import a manuscript', 'Upload a Word (.docx), text or Markdown file. We split it into chapters for you.'],
          ['blank', 'Start with a blank page', 'Write it yourself and use AI only when you want it.'],
        ].map(([v, title, text]) => (
          <label key={v} className="flex cursor-pointer gap-3 rounded border border-line p-3 has-[:checked]:border-cloth has-[:checked]:bg-cloth-light/50">
            <input type="radio" name="start" className="mt-1 accent-cloth" checked={start === v} onChange={() => setStart(v as typeof start)} />
            <span>
              <span className="block font-medium">{title}</span>
              <span className="text-[14px] text-ink-muted">{text}</span>
            </span>
          </label>
        ))}
        {start === 'import' && (
          <input type="file" accept=".docx,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block text-[14px]" />
        )}
      </fieldset>

      <div className="flex items-center gap-4">
        <Button type="submit" loading={!!busy}>Create book</Button>
        {busy && <p className="text-[14px] text-ink-muted" aria-live="polite">{busy}</p>}
      </div>
    </form>
  );
}
