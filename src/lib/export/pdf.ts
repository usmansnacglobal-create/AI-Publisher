import 'server-only';
import path from 'node:path';
import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { TRIM_SIZES } from '../spine';
import { BODY_FONTS, DEFAULT_LAYOUT, SPACING, numberWords, type BodyFont, type LayoutSettings } from '../layout';
import { tidyRuns, type Block, type Manuscript, type Run } from './manuscript';

const FONT_DIR = path.join(process.cwd(), 'src/assets/fonts');
const fontCache = new Map<string, Record<'R' | 'I' | 'B' | 'BI', Buffer>>();
function fontFiles(font: BodyFont) {
  const file = BODY_FONTS[font]?.file ?? 'EBGaramond';
  if (!fontCache.has(file)) {
    const read = (style: string) => fs.readFileSync(path.join(FONT_DIR, `${file}-${style}.ttf`));
    fontCache.set(file, { R: read('Regular'), I: read('Italic'), B: read('SemiBold'), BI: read('SemiBoldItalic') });
  }
  return fontCache.get(file)!;
}

const IN = 72;

interface Geometry {
  pageW: number;
  pageH: number;
  margin: { top: number; bottom: number; inside: number; outside: number };
  size: number;
  lineGap: number;
}

function geometry(trim: string, estimatedPages: number, s: LayoutSettings): Geometry {
  const t = TRIM_SIZES[trim] ?? TRIM_SIZES['6x9'];
  // KDP minimum gutters grow with page count; we stay comfortably above them.
  const inside = estimatedPages > 600 ? 0.95 : estimatedPages > 400 ? 0.85 : estimatedPages > 150 ? 0.8 : 0.7;
  return {
    pageW: t.w * IN,
    pageH: t.h * IN,
    margin: { top: s.margins.top * IN, bottom: s.margins.bottom * IN, inside: inside * IN, outside: s.margins.outside * IN },
    size: s.fontSize,
    lineGap: Math.max(0, s.fontSize * (SPACING[s.spacing] - 1.2)),
  };
}

export interface PdfOptions {
  layout?: LayoutSettings;
  /** Quick preview: skips front matter and renders only the first chapters. */
  preview?: boolean;
}

/**
 * Builds a print-ready interior PDF: embedded fonts, mirrored margins with a
 * gutter, chapters opening on right-hand pages, page numbers, running heads and
 * a table of contents. Rendered twice so the contents show real page numbers.
 */
export async function renderPdf(m: Manuscript, trim: string, estimatedPages: number, opts: PdfOptions = {}) {
  const layout = opts.layout ?? DEFAULT_LAYOUT;
  if (opts.preview) {
    return renderOnce({ ...m, chapters: m.chapters.slice(0, 2) }, trim, estimatedPages, null, layout, true);
  }
  const first = await renderOnce(m, trim, estimatedPages, null, layout, false);
  return renderOnce(m, trim, first.pages, first.chapterPages, layout, false);
}

async function renderOnce(m: Manuscript, trim: string, estimatedPages: number, tocPages: number[] | null, S: LayoutSettings, preview: boolean) {
  const G = geometry(trim, estimatedPages, S);
  const doc = new PDFDocument({
    size: [G.pageW, G.pageH],
    margins: { top: G.margin.top, bottom: G.margin.bottom, left: G.margin.inside, right: G.margin.outside },
    bufferPages: true,
    autoFirstPage: false,
    info: { Title: m.title, Author: m.author, Creator: m.creator ?? 'AI Publisher' },
    lang: m.language,
  });
  const f = fontFiles(S.font);
  (['R', 'I', 'B', 'BI'] as const).forEach((k) => doc.registerFont(k, f[k]));

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  // Mirror margins: odd (right-hand) pages have the gutter on the left.
  let pageNo = 0;
  doc.on('pageAdded', () => {
    pageNo++;
    const odd = pageNo % 2 === 1;
    doc.page.margins = {
      top: G.margin.top,
      bottom: G.margin.bottom,
      left: odd ? G.margin.inside : G.margin.outside,
      right: odd ? G.margin.outside : G.margin.inside,
    };
    doc.x = doc.page.margins.left;
    doc.y = doc.page.margins.top;
  });
  const width = () => G.pageW - G.margin.inside - G.margin.outside;
  const plainPages = new Set<number>(); // no number, no running head
  const openerPages = new Set<number>();
  const chapterOfPage = new Map<number, string>();
  const newPage = () => doc.addPage();
  const toRecto = () => {
    newPage();
    if (pageNo % 2 === 0) {
      plainPages.add(pageNo); // blank left-hand page
      newPage();
    }
  };
  const center = (text: string, font: string, size: number, o: PDFKit.Mixins.TextOptions = {}) =>
    doc.font(font).fontSize(size).text(text, doc.page.margins.left, doc.y, { width: width(), align: 'center', ...o });

  if (!preview) {
    // Half-title and title page
    toRecto();
    plainPages.add(pageNo);
    doc.y = G.pageH * 0.3;
    center(m.title, 'R', G.size * 1.6);
    newPage();
    plainPages.add(pageNo);
    toRecto();
    plainPages.add(pageNo);
    doc.y = G.pageH * 0.25;
    center(m.title, 'B', G.size * 2.4, { lineGap: 4 });
    if (m.subtitle) {
      doc.moveDown(0.6);
      center(m.subtitle, 'I', G.size * 1.3);
    }
    doc.y = G.pageH * 0.62;
    center(m.author, 'R', G.size * 1.4);

    // Copyright page (left-hand page)
    newPage();
    plainPages.add(pageNo);
    doc.y = G.pageH - G.margin.bottom - G.size * 9;
    const copy = [
      `Copyright © ${m.year} ${m.copyrightHolder || m.author}`,
      'All rights reserved.',
      'No part of this book may be reproduced in any form without written permission from the author, except for brief quotations in reviews.',
      m.isbn ? `ISBN: ${m.isbn}` : '',
    ].filter(Boolean);
    doc.font('R').fontSize(G.size * 0.8).text(copy.join('\n\n'), doc.page.margins.left, doc.y, { width: width(), align: 'left' });

    if (m.dedication) {
      toRecto();
      plainPages.add(pageNo);
      doc.y = G.pageH * 0.3;
      center(m.dedication, 'I', G.size);
    }

    if (m.chapters.length > 1) {
      toRecto();
      plainPages.add(pageNo);
      doc.y = G.pageH * 0.15;
      center('Contents', 'R', G.size * 1.5);
      doc.moveDown(1.5);
      m.chapters.forEach((c, i) => {
        const y = doc.y;
        doc.font('R').fontSize(G.size);
        doc.text(c.title, doc.page.margins.left, y, { width: width() - 40, lineGap: 2 });
        const after = doc.y;
        doc.text(tocPages ? String(tocPages[i]) : '000', doc.page.margins.left, y, { width: width(), align: 'right' });
        doc.y = Math.max(after, doc.y) + 4;
        if (doc.y > G.pageH - G.margin.bottom - G.size * 2 && i < m.chapters.length - 1) {
          newPage();
          plainPages.add(pageNo);
        }
      });
    }
  }

  // Body
  let bodyStart = 0;
  const chapterPages: number[] = [];
  const fontFor = (r: Run) => (r.bold && r.italic ? 'BI' : r.bold ? 'B' : r.italic ? 'I' : 'R');

  const ornament = () => {
    const cx = G.pageW / 2 + (doc.page.margins.left - doc.page.margins.right) / 2;
    const y = doc.y + 4;
    const w = G.size * 3.2;
    doc.save().lineWidth(0.6).strokeColor('#222');
    doc.moveTo(cx - w, y).lineTo(cx - 6, y).stroke();
    doc.moveTo(cx + 6, y).lineTo(cx + w, y).stroke();
    doc.moveTo(cx, y - 4).lineTo(cx + 4, y).lineTo(cx, y + 4).lineTo(cx - 4, y).closePath().fill('#222');
    doc.restore();
    doc.y = y + 14;
  };

  const bottomLimit = () => G.pageH - G.margin.bottom;
  /** Starts a new page if fewer than `lines` lines fit, so headings and bullets never strand at the foot. */
  const keep = (lines: number) => {
    if (doc.y + lines * (G.size * 1.2 + G.lineGap) > bottomLimit()) newPage();
  };

  const writeRuns = (runs: Run[], o: PDFKit.Mixins.TextOptions, x: number) => {
    const list = tidyRuns(runs);
    doc.fontSize(G.size);
    if (list.length === 1 && !list[0].bold && !list[0].italic && !list[0].underline) {
      doc.font('R').text(list[0].text, x, doc.y, o);
      return;
    }
    list.forEach((r, i) => {
      const last = i === list.length - 1;
      doc.font(fontFor(r));
      if (i === 0) doc.text(r.text, x, doc.y, { ...o, continued: !last, underline: !!r.underline });
      else doc.text(r.text, { continued: !last, underline: !!r.underline });
    });
  };

  /** Splits runs at a character offset. */
  const splitRuns = (runs: Run[], at: number): [Run[], Run[]] => {
    const a: Run[] = [];
    const b: Run[] = [];
    let n = 0;
    for (const r of runs) {
      if (n + r.text.length <= at) a.push(r);
      else if (n >= at) b.push(r);
      else {
        a.push({ ...r, text: r.text.slice(0, at - n) });
        b.push({ ...r, text: r.text.slice(at - n) });
      }
      n += r.text.length;
    }
    return [a, b];
  };

  /** A true two-line drop cap: the initial spans two lines and the text wraps beside it. */
  const dropCapParagraph = (runs: Run[], o: PDFKit.Mixins.TextOptions, x: number) => {
    const text = runs.map((r) => r.text).join('');
    const initial = [...text][0];
    if (!initial || !/\p{L}/u.test(initial)) return writeRuns(runs, o, x);
    keep(4);
    const lineH = G.size * 1.2 + G.lineGap;
    const capSize = lineH * 2 + G.size * 0.15;
    doc.font(fontFor(runs[0])).fontSize(capSize);
    const capW = doc.widthOfString(initial) + G.size * 0.35;
    const top = doc.y;
    doc.text(initial, x, top - capSize * 0.12, { lineBreak: false });
    // Fit two lines of the remaining text into the narrower column beside the initial.
    const [, rest] = splitRuns(runs, initial.length);
    const restText = rest.map((r) => r.text).join('');
    const colW = (o.width as number) - capW;
    doc.font('R').fontSize(G.size);
    const words = restText.split(/(\s+)/);
    let lines = 0;
    let line = '';
    let used = 0;
    for (let i = 0; i < words.length && lines < 2; i++) {
      const next = line + words[i];
      if (doc.widthOfString(next.trim()) > colW * 0.97 && line.trim()) {
        lines++;
        if (lines === 2) break;
        line = words[i].trimStart();
        used += next.length - line.length;
        continue;
      }
      line = next;
      if (i === words.length - 1) used = restText.length;
    }
    if (lines < 2) used = Math.max(used, restText.length - (lines === 1 ? 0 : 0));
    if (lines === 2) used += line.length;
    const [side, below] = splitRuns(rest, Math.min(used, restText.length));
    doc.y = top;
    writeRuns(side, { ...o, width: colW, indent: 0, align: 'justify' }, x + capW);
    doc.y = Math.max(doc.y, top + lineH * 2);
    if (below.some((r) => r.text.trim())) writeRuns([{ ...below[0], text: below[0].text.trimStart() }, ...below.slice(1)], { ...o, indent: 0 }, x);
  };

  for (const ch of m.chapters) {
    toRecto();
    openerPages.add(pageNo);
    if (!bodyStart) bodyStart = pageNo;
    chapterPages.push(pageNo - bodyStart + 1);
    const chapterStart = pageNo;
    doc.y = G.pageH * 0.22;

    if (S.heading === 'modern') {
      doc.font('B').fontSize(G.size * 3.2).text(String(ch.number), doc.page.margins.left, doc.y, { width: width(), align: 'left' });
      doc.moveDown(0.2);
      doc.font('B').fontSize(G.size * 1.6).text(ch.title, { width: width(), align: 'left' });
      doc.moveDown(1.6);
    } else {
      if (S.heading === 'decorative') ornament();
      center(`Chapter ${numberWords(ch.number)}`.toUpperCase(), 'R', G.size * 0.85, { characterSpacing: 2 });
      doc.moveDown(0.8);
      center(ch.title, 'I', G.size * 1.7, { lineGap: 2 });
      doc.moveDown(2.2);
    }

    let firstPara = true;
    for (const b of ch.blocks as Block[]) {
      const x = doc.page.margins.left;
      if (b.type === 'break') {
        doc.moveDown(0.5);
        center('*   *   *', 'R', G.size);
        doc.moveDown(0.5);
        continue;
      }
      if (b.type === 'heading') {
        keep(3);
        doc.moveDown(0.6);
        doc.font('B').fontSize(G.size * 1.1).text(b.text, x, doc.y, { width: width(), align: 'left' });
        doc.moveDown(0.3);
        continue;
      }
      if (b.type === 'quote') {
        doc.moveDown(0.3);
        keep(2);
        writeRuns(b.runs.map((r) => ({ ...r, italic: !r.italic })), { width: width() - G.size * 3, align: 'left', lineGap: G.lineGap }, x + G.size * 1.5);
        doc.moveDown(0.5);
        continue;
      }
      if (b.type === 'image') {
        const img = m.images?.get(b.src);
        if (!img) continue;
        const maxW = width() * ({ small: 0.5, medium: 0.75, full: 1 } as const)[b.size];
        const textH = G.pageH - G.margin.top - G.margin.bottom;
        // Never taller than most of the page, leaving room for the caption.
        let w = maxW;
        let h = (w * img.height) / img.width;
        const capH = b.caption ? G.size * 2.6 : 0;
        if (h > textH * 0.88 - capH) {
          h = textH * 0.88 - capH;
          w = (h * img.width) / img.height;
        }
        if (doc.y + h + capH + G.size > bottomLimit()) newPage();
        else doc.moveDown(0.6);
        const left = doc.page.margins.left + (width() - w) / 2;
        const top = doc.y;
        doc.image(img.data, left, top, { width: w, height: h });
        doc.y = top + h + G.size * 0.5;
        if (b.caption) doc.font('I').fontSize(G.size * 0.85).text(b.caption, doc.page.margins.left, doc.y, { width: width(), align: 'center' });
        doc.moveDown(0.8);
        continue;
      }
      if (b.type === 'list') {
        doc.moveDown(0.2);
        b.items.forEach((item, i) => {
          keep(2);
          const y = doc.y;
          doc.font('R').fontSize(G.size).text(b.ordered ? `${i + 1}.` : '•', x + G.size * 0.4, y, { width: G.size * 1.6, lineBreak: false });
          doc.y = y;
          writeRuns(item, { width: width() - G.size * 2, align: 'left', lineGap: G.lineGap }, x + G.size * 2);
          doc.moveDown(0.15);
        });
        doc.moveDown(0.3);
        continue;
      }
      const block = S.paragraph === 'block';
      const o: PDFKit.Mixins.TextOptions = {
        width: width(),
        align: 'justify',
        lineGap: G.lineGap,
        indent: b.first || block ? 0 : G.size * 1.5,
      };
      if (S.dropCaps && firstPara) dropCapParagraph(b.runs, o, x);
      else writeRuns(b.runs, o, x);
      if (block) doc.moveDown(0.6);
      firstPara = false;
    }
    for (let p = chapterStart; p <= pageNo; p++) chapterOfPage.set(p, ch.title);
  }

  if (!preview) {
    if (m.authorBio) {
      toRecto();
      plainPages.add(pageNo);
      doc.y = G.pageH * 0.22;
      center('About the Author', 'I', G.size * 1.5);
      doc.moveDown(1.5);
      doc.font('R').fontSize(G.size).text(m.authorBio, doc.page.margins.left, doc.y, { width: width(), align: 'justify', lineGap: G.lineGap });
    }
    // Even total page count, as printers require.
    if (pageNo % 2 === 1) {
      newPage();
      plainPages.add(pageNo);
    }
  }

  // Page numbers and running heads (body pages only)
  const range = doc.bufferedPageRange();
  const small = G.size * 0.8;
  for (let i = 0; i < range.count; i++) {
    const n = i + 1;
    if (!bodyStart || n < bodyStart || plainPages.has(n)) continue;
    doc.switchToPage(i);
    const opener = openerPages.has(n);
    const odd = n % 2 === 1;
    const num = String(n - bodyStart + 1);
    const { top, bottom, left, right } = doc.page.margins;
    doc.page.margins.top = 0;
    doc.page.margins.bottom = 0;
    const headY = top * 0.45;
    const footY = G.pageH - bottom * 0.6;
    if (S.runningHeads && !opener) {
      // Convention: author (or book title) on left-hand pages, chapter title on right-hand pages.
      const label = odd ? chapterOfPage.get(n) ?? m.title : m.author || m.title;
      doc.font('I').fontSize(small).text(label.slice(0, 80), left, headY, { width: G.pageW - left - right, align: 'center', lineBreak: false });
    }
    const place = S.pageNumbers;
    if (!(opener && place === 'hidden_openers')) {
      doc.font('R').fontSize(small);
      if (place === 'top_outer' && !opener) {
        doc.text(num, left, headY, { width: G.pageW - left - right, align: odd ? 'right' : 'left', lineBreak: false });
      } else if (place === 'bottom_outer') {
        doc.text(num, left, footY, { width: G.pageW - left - right, align: odd ? 'right' : 'left', lineBreak: false });
      } else if (place !== 'top_outer') {
        doc.text(num, 0, footY, { width: G.pageW, align: 'center', lineBreak: false });
      } else if (opener) {
        doc.text(num, 0, footY, { width: G.pageW, align: 'center', lineBreak: false });
      }
    }
    doc.page.margins.top = top;
    doc.page.margins.bottom = bottom;
  }

  doc.end();
  const buffer = await done;
  return { buffer, pages: range.count, chapterPages };
}
