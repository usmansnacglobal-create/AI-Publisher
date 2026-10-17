'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { api, errorText } from '@/lib/client';
import { Button, Empty, Field, Modal, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';

type Entry = { id: string; kind: 'character' | 'place' | 'item' | 'event' | 'rule'; name: string; details: string };
const KINDS: Record<Entry['kind'], string> = { character: 'Characters and people', place: 'Places', item: 'Objects', event: 'Key events and dates', rule: 'World rules and facts' };

export function Bible({ bookId, entries, hasText }: { bookId: string; entries: Entry[]; hasText: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Partial<Entry> | null>(null);
  const [building, setBuilding] = useState(false);

  async function build() {
    setBuilding(true);
    try {
      const r = await api<{ added: number }>(`/api/books/${bookId}/bible/extract`, { body: {} });
      toast(r.added ? `Added ${r.added} entries from your manuscript` : 'Nothing new found');
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBuilding(false);
  }
  async function remove(e: Entry) {
    if (!confirm(`Remove “${e.name}” from the story bible?`)) return;
    await api(`/api/books/${bookId}/bible/${e.id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Story bible"
        actions={
          <>
            <Button variant="secondary" onClick={build} loading={building} disabled={!hasText}>{building ? 'Reading your manuscript…' : 'Build from manuscript'}</Button>
            <Button onClick={() => setEditing({ kind: 'character', name: '', details: '' })}>Add entry</Button>
          </>
        }
      >
        The facts of your book: who people are, what places look like, when things happen. The AI follows these whenever it writes, and the continuity check flags anything that contradicts them.
      </PageHeader>

      {entries.length ? (
        <div className="grid gap-8 lg:grid-cols-2">
          {(Object.keys(KINDS) as Entry['kind'][]).map((k) => {
            const list = entries.filter((e) => e.kind === k);
            if (!list.length) return null;
            return (
              <section key={k}>
                <h2 className="mb-3 text-[1.15rem]">{KINDS[k]}</h2>
                <ul className="panel divide-y divide-line">
                  {list.map((e) => (
                    <li key={e.id} className="flex gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{e.name}</p>
                        <p className="whitespace-pre-wrap text-[14px] text-ink-muted">{e.details}</p>
                      </div>
                      <div className="flex shrink-0 items-start">
                        <button onClick={() => setEditing(e)} className="rounded p-1.5 text-ink-muted hover:bg-ink/5" aria-label={`Edit ${e.name}`}><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(e)} className="rounded p-1.5 text-ink-muted hover:bg-ink/5" aria-label={`Remove ${e.name}`}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Your story bible is empty"
          action={hasText ? <Button onClick={build} loading={building}>Build from manuscript</Button> : <Button onClick={() => setEditing({ kind: 'character', name: '', details: '' })}>Add the first entry</Button>}
        >
          {hasText ? 'Claude can read your chapters and record every character, place and key fact for you.' : 'Add your main characters and settings now, so the AI gets them right from the first chapter.'}
        </Empty>
      )}
      <EntryModal bookId={bookId} entry={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />
    </div>
  );
}

function EntryModal({ bookId, entry, onClose, onSaved }: { bookId: string; entry: Partial<Entry> | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Entry>>({});
  const [key, setKey] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  if (entry !== key) {
    setKey(entry);
    setF(entry ?? {});
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { kind: f.kind, name: f.name, details: f.details ?? '' };
      if (f.id) await api(`/api/books/${bookId}/bible/${f.id}`, { method: 'PATCH', body });
      else await api(`/api/books/${bookId}/bible`, { body });
      onSaved();
    } catch (err) {
      toast(errorText(err), 'error');
    }
    setBusy(false);
  }
  return (
    <Modal open={!!entry} onClose={onClose} title={f.id ? 'Edit entry' : 'Add to the story bible'}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Type" htmlFor="k">
          <select id="k" className="field" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Entry['kind'] })}>
            {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Name" htmlFor="n"><input id="n" className="field" required value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Details" htmlFor="d" hint="Appearance, age, relationships, dates, rules. Anything the book must keep consistent.">
          <textarea id="d" className="field min-h-[140px]" value={f.details ?? ''} onChange={(e) => setF({ ...f, details: e.target.value })} />
        </Field>
        <Button type="submit" loading={busy}>Save</Button>
      </form>
    </Modal>
  );
}
