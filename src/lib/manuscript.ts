/** A chapter heading line: "Chapter 3", "CHAPTER THREE", "# Prologue", "**Part One**"… */
export const CHAPTER_HEADING =
  /^\s*(?:#{1,3}\s*)?(?:\*\*)?((?:chapter|part)\s+(?:\d+|[ivxlc]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty[\w-]*|thirty[\w-]*)\b.*|prologue\b.*|epilogue\b.*|introduction\s*|preface\s*|afterword\s*)(?:\*\*)?\s*$/i;

/** Splits an imported manuscript into chapters by headings like "Chapter 3", "CHAPTER THREE", "Prologue". */
export function splitIntoChapters(raw: string): { title: string; content: string }[] {
  const text = raw.replace(/\r\n?/g, '\n').replace(/ /g, ' ');
  const lines = text.split('\n');
  const heading = CHAPTER_HEADING;
  const chapters: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;
  for (const line of lines) {
    const m = heading.exec(line);
    if (m && line.trim().length < 120) {
      current = { title: tidyTitle(m[1]), lines: [] };
      chapters.push(current);
    } else {
      if (!current) {
        if (!line.trim()) continue;
        current = { title: 'Opening', lines: [] };
        chapters.push(current);
      }
      current.lines.push(line);
    }
  }
  const result = chapters
    .map((c) => ({ title: c.title, content: normaliseParagraphs(c.lines.join('\n')) }))
    .filter((c) => c.content.trim());
  if (result.length <= 1 && text.trim()) {
    // No headings found: split into chunks of ~4,000 words at paragraph breaks.
    return chunkByWords(normaliseParagraphs(text), 4000);
  }
  return result;
}

function tidyTitle(t: string) {
  const s = t.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
  const m = /^chapter\s+[\w-]+\s*[:.\-–—]\s*(.+)$/i.exec(s);
  return (m ? m[1] : s).slice(0, 200);
}

export function normaliseParagraphs(text: string) {
  return text
    .split(/\n\s*\n|\n(?=\s{2,}|\t)/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

function chunkByWords(text: string, size: number) {
  const paras = text.split('\n\n');
  const out: { title: string; content: string }[] = [];
  let buf: string[] = [];
  let words = 0;
  for (const p of paras) {
    buf.push(p);
    words += p.split(/\s+/).length;
    if (words >= size) {
      out.push({ title: `Part ${out.length + 1}`, content: buf.join('\n\n') });
      buf = [];
      words = 0;
    }
  }
  if (buf.length) out.push({ title: `Part ${out.length + 1}`, content: buf.join('\n\n') });
  return out;
}

/**
 * PDF text comes out one printed line at a time. Rebuild paragraphs: a line
 * that ends a sentence and is noticeably shorter than a full line ends a paragraph.
 */
export function pdfLinesToText(pages: string[]): string {
  const lines = pages
    .flatMap((p) => p.split('\n'))
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l && !/^\d{1,4}$/.test(l)); // drop bare page numbers
  if (!lines.length) return '';
  const lengths = lines.map((l) => l.length).sort((a, b) => a - b);
  const full = lengths[Math.floor(lengths.length * 0.75)] || 60;
  const out: string[] = [];
  let para = '';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const heading = /^(chapter|part|prologue|epilogue)\b/i.test(l) && l.length < 80;
    if (heading) {
      if (para) out.push(para);
      out.push(l);
      para = '';
      continue;
    }
    // A line ending in a hyphen continues the word on the next line; keep the hyphen (proofreading catches stray ones).
    para = para ? (para.endsWith('-') && /^[a-z]/.test(l) ? para + l : `${para} ${l}`) : l;
    const next = lines[i + 1];
    const endsSentence = /[.!?"”’)]$/.test(l);
    if (!next || (endsSentence && l.length < full * 0.85)) {
      out.push(para);
      para = '';
    }
  }
  if (para) out.push(para);
  return out.join('\n\n');
}


/**
 * Splits Markdown (from a Word file) into chapters while keeping its formatting:
 * lists, quotes, bold and italic, headings and images.
 */
export function splitMarkdownChapters(md: string): { title: string; content: string }[] {
  const lines = md.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n');
  const chapters: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;
  for (const line of lines) {
    const m = CHAPTER_HEADING.exec(line);
    if (m && line.trim().length < 120) {
      current = { title: tidyTitle(m[1]), lines: [] };
      chapters.push(current);
    } else {
      if (!current) {
        if (!line.trim()) continue;
        current = { title: 'Opening', lines: [] };
        chapters.push(current);
      }
      current.lines.push(line);
    }
  }
  const tidy = (t: string) => t.replace(/\n{3,}/g, '\n\n').trim();
  const result = chapters.map((c) => ({ title: c.title, content: tidy(c.lines.join('\n')) })).filter((c) => c.content);
  if (result.length <= 1 && md.trim()) {
    // No chapter headings: split into parts of about 4,000 words at paragraph breaks.
    const blocks = tidy(md).split('\n\n');
    const out: { title: string; content: string }[] = [];
    let buf: string[] = [];
    let words = 0;
    for (const b of blocks) {
      buf.push(b);
      words += b.split(/\s+/).length;
      if (words >= 4000) {
        out.push({ title: `Part ${out.length + 1}`, content: buf.join('\n\n') });
        buf = [];
        words = 0;
      }
    }
    if (buf.length) out.push({ title: `Part ${out.length + 1}`, content: buf.join('\n\n') });
    return out;
  }
  return result;
}
