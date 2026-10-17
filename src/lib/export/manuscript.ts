export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export type Block =
  | { type: 'para'; runs: Run[]; first: boolean }
  | { type: 'break' }
  | { type: 'heading'; text: string }
  | { type: 'quote'; runs: Run[] }
  | { type: 'list'; ordered: boolean; items: Run[][] };

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

const SCENE_BREAK = /^\s*(\*\s*\*\s*\*|#|~{3}|-{3,}|_{3,}|⁂)\s*$/;

/** Parses **bold**, *italic*, _italic_ and <u>underline</u> inside a paragraph. Links keep their text. */
export function parseInline(raw: string): Run[] {
  const text = raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [text](url) → text
    .replace(/<(?!\/?u>)[^>]+>/g, '') // other HTML tags
    .replace(/\\([*_\[\]#>\\-])/g, '$1') // escaped Markdown characters
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
  const runs: Run[] = [];
  const re = /(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*|(?<![\w])_([^_]+)_(?![\w])|<u>([\s\S]*?)<\/u>)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) runs.push({ text: m[2], bold: true, italic: true });
    else if (m[3] !== undefined) runs.push(...parseInline(m[3]).map((r) => ({ ...r, bold: true })));
    else if (m[6] !== undefined) runs.push(...parseInline(m[6]).map((r) => ({ ...r, underline: true })));
    else runs.push({ text: m[4] ?? m[5], italic: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs.filter((r) => r.text) : [{ text }];
}

/** Turns stored chapter text (Markdown) into typed blocks for every export format. */
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
      blocks.push({ type: 'heading', text: plain(parseInline(h[1].trim())) });
      first = true;
      continue;
    }
    const lines = p.split('\n');
    if (lines.every((l) => /^\s*>/.test(l))) {
      blocks.push({ type: 'quote', runs: parseInline(lines.map((l) => l.replace(/^\s*>\s?/, '')).join(' ')) });
      continue;
    }
    if (lines.every((l) => /^\s*([-*+]|\d+[.)])\s+/.test(l) || /^\s{2,}\S/.test(l))) {
      const ordered = /^\s*\d/.test(lines[0]);
      const items: string[] = [];
      for (const l of lines) {
        if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) items.push(l.replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
        else items[items.length - 1] += ' ' + l.trim();
      }
      blocks.push({ type: 'list', ordered, items: items.map(parseInline) });
      first = false;
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
