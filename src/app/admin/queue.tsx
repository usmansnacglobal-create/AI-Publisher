'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorText } from '@/lib/client';
import { Badge, Button, Field, Modal } from '@/components/ui';
import { useToast } from '@/components/toast';

type Row = {
  id: string; book_id: string; status: string; platforms: string[]; formats: string[]; price: number; isbn: string | null; reviewer_notes: string; created_at: string;
  books: { id: string; title: string; genre: string; trim_size: string; page_count: number | null } | null;
  profiles: { email: string; full_name: string; pen_name: string } | null;
  frontUrl?: string; wrapUrl?: string;
};
const NEXT: Record<string, string[]> = {
  submitted: ['in_review', 'changes_requested', 'rejected'],
  in_review: ['formatting', 'changes_requested', 'rejected'],
  formatting: ['publishing', 'changes_requested', 'failed'],
  publishing: ['live', 'failed'],
  failed: ['publishing'],
  changes_requested: [],
  rejected: [],
  live: [],
};
const LABEL: Record<string, string> = { submitted: 'Submitted', in_review: 'In review', changes_requested: 'Changes requested', formatting: 'Formatting', publishing: 'Publishing', live: 'Live', rejected: 'Rejected', failed: 'Failed' };

export function Queue({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [action, setAction] = useState<{ row: Row; status: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [isbn, setIsbn] = useState('');
  const [busy, setBusy] = useState(false);
  const [notesFor, setNotesFor] = useState<Row | null>(null);
  const list = rows.filter((r) => filter === 'all' || !['live', 'changes_requested', 'rejected'].includes(r.status));

  async function apply() {
    if (!action) return;
    setBusy(true);
    try {
      await api(`/api/admin/submissions/${action.row.id}`, { method: 'PATCH', body: { status: action.status, notes: notes || undefined, isbn: isbn || undefined } });
      toast('Updated, and the author was notified');
      setAction(null);
      router.refresh();
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy(false);
  }

  return (
    <>
      <div className="mb-4 flex gap-2">
        <button className="chip" aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>Open</button>
        <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
      </div>
      {!list.length ? (
        <p className="text-ink-muted">Nothing waiting.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className="panel flex flex-wrap gap-4 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.frontUrl ? <img src={r.frontUrl} alt="" className="h-28 w-[75px] rounded-sm object-cover" /> : <div className="h-28 w-[75px] rounded-sm bg-ground" />}
              <div className="min-w-0 flex-1 text-[14px]">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-serif text-[1.15rem]">{r.books?.title}</p>
                  <Badge tone={r.status === 'live' ? 'cloth' : ['changes_requested', 'rejected', 'failed'].includes(r.status) ? 'danger' : 'gilt'}>{LABEL[r.status]}</Badge>
                </div>
                <p className="text-ink-muted">{r.profiles?.pen_name || r.profiles?.full_name} · {r.profiles?.email}</p>
                <p className="text-ink-muted">{r.formats.join(', ')} · {r.platforms.join(', ')} · ${Number(r.price).toFixed(2)} · {r.books?.page_count ?? '?'} pages, {r.books?.trim_size}</p>
                <p className="text-ink-muted">Submitted {new Date(r.created_at).toLocaleDateString('en-GB')}{r.isbn && ` · ISBN ${r.isbn}`}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-[13px]">
                  <a className="text-cloth underline" href={`/api/books/${r.book_id}/export?format=pdf`}>Interior PDF</a>
                  <a className="text-cloth underline" href={`/api/books/${r.book_id}/export?format=epub`}>EPUB</a>
                  {r.frontUrl && <a className="text-cloth underline" href={r.frontUrl} target="_blank" rel="noreferrer">Front cover</a>}
                  {r.wrapUrl && <a className="text-cloth underline" href={r.wrapUrl} target="_blank" rel="noreferrer">Paperback cover PDF</a>}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button size="sm" variant="ghost" onClick={() => setNotesFor(r)}>Chapter notes</Button>
                {NEXT[r.status].map((s) => (
                  <Button key={s} size="sm" variant={['changes_requested', 'rejected', 'failed'].includes(s) ? 'secondary' : 'primary'} onClick={() => { setAction({ row: r, status: s }); setNotes(''); setIsbn(r.isbn ?? ''); }}>
                    {s === 'changes_requested' ? 'Request changes' : s === 'rejected' ? 'Reject' : s === 'failed' ? 'Mark failed' : s === 'publishing' && r.status === 'failed' ? 'Retry publishing' : `Mark ${LABEL[s].toLowerCase()}`}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ChapterNotes row={notesFor} onClose={() => setNotesFor(null)} />
      <Modal open={!!action} onClose={() => setAction(null)} title={action ? `${action.row.books?.title}: ${LABEL[action.status]}` : ''}>
        <div className="space-y-4">
          <Field label={action?.status === 'changes_requested' ? 'What needs changing?' : action?.status === 'rejected' ? 'Why it can’t be published' : action?.status === 'failed' ? 'What went wrong' : 'Note to the author (optional)'} htmlFor="n">
            <textarea id="n" className="field min-h-[110px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {action && ['publishing', 'live', 'formatting'].includes(action.status) && (
            <Field label="ISBN" htmlFor="i"><input id="i" className="field" value={isbn} onChange={(e) => setIsbn(e.target.value)} /></Field>
          )}
          <Button onClick={apply} loading={busy} disabled={['changes_requested', 'rejected'].includes(action?.status ?? '') && !notes.trim()}>Update and notify author</Button>
        </div>
      </Modal>
    </>
  );
}

function ChapterNotes({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const toast = useToast();
  const [chapters, setChapters] = useState<{ id: string; position: number; title: string; word_count: number; admin_note: string }[] | null>(null);
  const [saving, setSaving] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (row && row.book_id !== loadedFor) {
    setLoadedFor(row.book_id);
    setChapters(null);
    api<{ chapters: NonNullable<typeof chapters> }>(`/api/admin/chapters/${row.book_id}`).then((r) => setChapters(r.chapters)).catch((e) => toast(errorText(e), 'error'));
  }
  async function save(id: string, note: string) {
    setSaving(id);
    try {
      await api(`/api/admin/chapters/${id}`, { method: 'PATCH', body: { note } });
      toast(note.trim() ? 'Note saved, and the author was notified' : 'Note removed');
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setSaving('');
  }
  return (
    <Modal open={!!row} onClose={() => { setLoadedFor(null); onClose(); }} title={row ? `Chapter notes: ${row.books?.title}` : ''} wide>
      {!chapters ? (
        <p className="text-ink-muted">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {chapters.map((c) => (
            <li key={c.id} className="rounded border border-line p-3">
              <p className="mb-1 text-[14px] font-medium">{c.position}. {c.title} <span className="font-normal text-ink-muted">· {c.word_count.toLocaleString('en-GB')} words</span></p>
              <textarea
                className="field min-h-[60px] text-[14px]"
                defaultValue={c.admin_note}
                placeholder="A note the author sees at the top of this chapter"
                onBlur={(e) => { if (e.target.value !== c.admin_note) { c.admin_note = e.target.value; save(c.id, e.target.value); } }}
              />
              {saving === c.id && <p className="mt-1 text-[12px] text-ink-muted">Saving…</p>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
