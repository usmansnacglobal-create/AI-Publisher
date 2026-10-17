export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type Block = { type: 'para'; runs: Run[]; first: boolean } | { type: 'break' } | { type: 'heading'; text: string };

export interface ManuscriptChapter {
  number: number;
  title: string;
  blocks: Block[];
}

export interface Manuscript {
  title: string;
  subtitle: string;
  author: string;
  copyrightHolder: string;
  dedication: string;
  year: number;
  isbn?: string | null;
  blurb: string;
  authorBio: string;
  language: string;
  chapters: ManuscriptChapter[];
}

const SCENE_BREAK = /^\s*(\*\s*\*\s*\*|#|~{3}|-{3}|⁂)\s*$/;

/** Parses **bold**, *italic* and _italic_ inside a paragraph. */
export function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*|(?<![\w])_([^_]+)_(?![\w]))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) runs.push({ text: m[2], bold: true });
    else runs.push({ text: m[3] ?? m[4], italic: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text }];
}

/** Turns stored chapter text into typed blocks for every export format. */
export function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let first = true;
  for (const raw of content.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const p = raw.trim();
    if (!p) continue;
    if (SCENE_BREAK.test(p)) {
      blocks.push({ type: 'break' });
      first = true;
      continue;
    }
    const h = /^#{1,3}\s+(.+)$/.exec(p);
    if (h) {
      blocks.push({ type: 'heading', text: h[1].trim() });
      first = true;
      continue;
    }
    blocks.push({ type: 'para', runs: parseInline(p.replace(/\s*\n\s*/g, ' ')), first });
    first = false;
  }
  return blocks;
}

export function plain(runs: Run[]) {
  return runs.map((r) => r.text).join('');
}

export function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'book';
}

/**
 * PDFKit drops leading spaces between styled runs and may wrap a comma onto
 * its own line, so move spaces and attached punctuation onto the previous run.
 */
export function tidyRuns(runs: Run[]): Run[] {
  const out = runs.map((r) => ({ ...r }));
  for (let i = 1; i < out.length; i++) {
    const m = /^([^\s\p{L}\p{N}]*\s*)/u.exec(out[i].text);
    if (m && m[1]) {
      out[i - 1].text += m[1];
      out[i].text = out[i].text.slice(m[1].length);
    }
  }
  return out.filter((r) => r.text.length);
}
