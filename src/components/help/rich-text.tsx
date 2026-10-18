import Link from 'next/link';
import { Fragment } from 'react';
import { Lightbulb } from 'lucide-react';

/** Renders **bold**, *italic* and [links](/path) inside one line of help text. */
export function Inline({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={k++} className="font-semibold text-ink">{m[1]}</strong>);
    else if (m[2]) parts.push(<em key={k++}>{m[2]}</em>);
    else if (m[3]) {
      const href = m[4];
      parts.push(
        href.startsWith('/') ? (
          <Link key={k++} href={href} onClick={onNavigate} className="text-cloth underline">{m[3]}</Link>
        ) : (
          <a key={k++} href={href} target="_blank" rel="noreferrer" className="text-cloth underline">{m[3]}</a>
        ),
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}

type Block = { kind: 'p' | 'h' | 'tip'; text: string } | { kind: 'ol' | 'ul'; items: string[] };

function parse(body: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trimEnd();
    const prev = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ kind: 'p', text: '' });
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^###\s+(.*)/))) blocks.push({ kind: 'h', text: m[1] });
    else if ((m = line.match(/^>\s?(.*)/))) blocks.push({ kind: 'tip', text: m[1] });
    else if ((m = line.match(/^\d+\.\s+(.*)/))) {
      if (prev?.kind === 'ol') prev.items.push(m[1]);
      else blocks.push({ kind: 'ol', items: [m[1]] });
    } else if ((m = line.match(/^-\s+(.*)/))) {
      if (prev?.kind === 'ul') prev.items.push(m[1]);
      else blocks.push({ kind: 'ul', items: [m[1]] });
    } else if (prev?.kind === 'p' && prev.text) prev.text += ' ' + line.trim();
    else blocks.push({ kind: 'p', text: line.trim() });
  }
  return blocks.filter((b) => !(b.kind === 'p' && !b.text));
}

/** A help article body: paragraphs, headings, numbered steps, bullets and tips. */
export function RichText({ body, onNavigate, compact }: { body: string; onNavigate?: () => void; compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-2 text-[14px] leading-relaxed' : 'space-y-4 text-[15px] leading-relaxed text-ink-soft'}>
      {parse(body).map((b, i) => {
        if (b.kind === 'h') return <h3 key={i} className={compact ? 'pt-1 font-sans text-[14px] font-semibold' : 'pt-2'}>{b.text}</h3>;
        if (b.kind === 'tip')
          return (
            <p key={i} className="flex gap-2 rounded-md bg-gilt-light px-3 py-2 text-[14px] text-gilt-ink">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span><Inline text={b.text} onNavigate={onNavigate} /></span>
            </p>
          );
        if (b.kind === 'ol')
          return (
            <ol key={i} className="space-y-1.5 pl-1">
              {b.items.map((t, j) => (
                <li key={j} className="flex gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cloth-light text-[12px] font-semibold text-cloth-dark">{j + 1}</span>
                  <span><Inline text={t} onNavigate={onNavigate} /></span>
                </li>
              ))}
            </ol>
          );
        if (b.kind === 'ul')
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-ink-faint">
              {b.items.map((t, j) => <li key={j}><Inline text={t} onNavigate={onNavigate} /></li>)}
            </ul>
          );
        return <p key={i}><Inline text={"text" in b ? b.text : ""} onNavigate={onNavigate} /></p>;
      })}
    </div>
  );
}
