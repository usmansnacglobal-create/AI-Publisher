import 'server-only';
import path from 'node:path';
import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { TRIM_SIZES } from '../spine';
import { tidyRuns, type Manuscript, type Run } from './manuscript';

const FONT_DIR = path.join(process.cwd(), 'src/assets/fonts');
const fonts = {
  regular: fs.readFileSync(path.join(FONT_DIR, 'EBGaramond-Regular.ttf')),
  italic: fs.readFileSync(path.join(FONT_DIR, 'EBGaramond-Italic.ttf')),
  bold: fs.readFileSync(path.join(FONT_DIR, 'EBGaramond-SemiBold.ttf')),
  boldItalic: fs.readFileSync(path.join(FONT_DIR, 'EBGaramond-SemiBoldItalic.ttf')),
};

const IN = 72;



interface Layout {
  pageW: number;
  pageH: number;
  margin: { top: number; bottom: number; inside: number; outside: number };
  fontSize: number;
  leading: number;
}

function layoutFor(trim: string, estimatedPages: number): Layout {
  const t = TRIM_SIZES[trim] ?? TRIM_SIZES['6x9'];
  const small = t.w <= 5;
  // KDP minimum gutters grow with page count; we stay comfortably above them.
  const inside = estimatedPages > 600 ? 0.95 : estimatedPages > 400 ? 0.85 : estimatedPages > 150 ? 0.8 : 0.7;
  return {
    pageW: t.w * IN,
    pageH: t.h * IN,
    margin: { top: 0.7 * IN, bottom: 0.75 * IN, inside: inside * IN, outside: (small ? 0.5 : 0.6) * IN },
    fontSize: t.w >= 8 ? 12 : small ? 10.5 : 11.5,
    leading: t.w >= 8 ? 5 : 3.6,
  };
}

/**
 * Builds a print-ready interior PDF: embedded fonts, mirrored margins with a
 * gutter, chapters opening on right-hand pages, running page numbers and a
 * table of contents. Rendered twice so the contents show real page numbers.
 */
export async function renderPdf(m: Manuscript, trim: string, estimatedPages: number) {
  const first = await renderOnce(m, trim, estimatedPages, null);
  const final = await renderOnce(m, trim, first.pages, first.chapterPages);
  return final;
}

async function renderOnce(m: Manuscript, trim: string, estimatedPages: number, tocPages: number[] | null) {
  const L = layoutFor(trim, estimatedPages);
  const doc = new PDFDocument({
    size: [L.pageW, L.pageH],
    margins: { top: L.margin.top, bottom: L.margin.bottom, left: L.margin.inside, right: L.margin.outside },
    bufferPages: true,
    autoFirstPage: false,
    info: { Title: m.title, Author: m.author, Creator: 'AI Publisher' },
    lang: m.language,
  });
  doc.registerFont('R', fonts.regular);
  doc.registerFont('I', fonts.italic);
  doc.registerFont('B', fonts.bold);
  doc.registerFont('BI', fonts.boldItalic);

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  // Mirror margins: odd (right-hand) pages have the gutter on the left.
  let pageNo = 0;
  doc.on('pageAdded', () => {
    pageNo++;
    const odd = pageNo % 2 === 1;
    doc.page.margins = {
      top: L.margin.top,
      bottom: L.margin.bottom,
      left: odd ? L.margin.inside : L.margin.outside,
      right: odd ? L.margin.outside : L.margin.inside,
    };
    doc.x = doc.page.margins.left;
    doc.y = doc.page.margins.top;
  });
  const width = () => L.pageW - L.margin.inside - L.margin.outside;
  const noNumber = new Set<number>();
  const newPage = () => doc.addPage();
  const toRecto = () => {
    newPage();
    if (pageNo % 2 === 0) {
      noNumber.add(pageNo); // blank left-hand page
      newPage();
    }
  };
  const center = (text: string, font: string, size: number, opts: PDFKit.Mixins.TextOptions = {}) =>
    doc.font(font).fontSize(size).text(text, doc.page.margins.left, doc.y, { width: width(), align: 'center', ...opts });

  // Half-title and title page
  toRecto();
  noNumber.add(pageNo);
  doc.y = L.pageH * 0.3;
  center(m.title, 'R', L.fontSize * 1.6);
  newPage();
  noNumber.add(pageNo);
  toRecto();
  noNumber.add(pageNo);
  doc.y = L.pageH * 0.25;
  center(m.title, 'B', L.fontSize * 2.4, { lineGap: 4 });
  if (m.subtitle) {
    doc.moveDown(0.6);
    center(m.subtitle, 'I', L.fontSize * 1.3);
  }
  doc.y = L.pageH * 0.62;
  center(m.author, 'R', L.fontSize * 1.4);

  // Copyright page (left-hand page)
  newPage();
  noNumber.add(pageNo);
  doc.y = L.pageH - L.margin.bottom - L.fontSize * 9;
  const copy = [
    `Copyright © ${m.year} ${m.copyrightHolder || m.author}`,
    'All rights reserved.',
    'No part of this book may be reproduced in any form without written permission from the author, except for brief quotations in reviews.',
    m.isbn ? `ISBN: ${m.isbn}` : '',
  ].filter(Boolean);
  doc.font('R').fontSize(L.fontSize * 0.8).text(copy.join('\n\n'), doc.page.margins.left, doc.y, { width: width(), align: 'left' });

  if (m.dedication) {
    toRecto();
    noNumber.add(pageNo);
    doc.y = L.pageH * 0.3;
    center(m.dedication, 'I', L.fontSize);
  }

  // Contents
  if (m.chapters.length > 1) {
    toRecto();
    noNumber.add(pageNo);
    doc.y = L.pageH * 0.15;
    center('Contents', 'R', L.fontSize * 1.5);
    doc.moveDown(1.5);
    m.chapters.forEach((c, i) => {
      const label = `${c.title}`;
      const y = doc.y;
      doc.font('R').fontSize(L.fontSize);
      doc.text(label, doc.page.margins.left, y, { width: width() - 40, lineGap: 2 });
      const after = doc.y;
      const num = tocPages ? String(tocPages[i]) : '000';
      doc.text(num, doc.page.margins.left, y, { width: width(), align: 'right' });
      doc.y = Math.max(after, doc.y) + 4;
      if (doc.y > L.pageH - L.margin.bottom - L.fontSize * 2 && i < m.chapters.length - 1) {
        newPage();
        noNumber.add(pageNo);
      }
    });
  }

  // Body
  let bodyStart = 0;
  const chapterPages: number[] = [];
  const fontFor = (r: Run) => (r.bold && r.italic ? 'BI' : r.bold ? 'B' : r.italic ? 'I' : 'R');

  for (const ch of m.chapters) {
    toRecto();
    noNumber.add(pageNo);
    if (!bodyStart) bodyStart = pageNo;
    chapterPages.push(pageNo - bodyStart + 1);
    doc.y = L.pageH * 0.22;
    center(`Chapter ${ch.number}`.toUpperCase(), 'R', L.fontSize * 0.85, { characterSpacing: 2 });
    doc.moveDown(0.8);
    center(ch.title, 'I', L.fontSize * 1.7, { lineGap: 2 });
    doc.moveDown(2.2);

    for (const b of ch.blocks) {
      const x = doc.page.margins.left;
      if (b.type === 'break') {
        doc.moveDown(0.5);
        center('*   *   *', 'R', L.fontSize);
        doc.moveDown(0.5);
        continue;
      }
      if (b.type === 'heading') {
        doc.moveDown(0.6);
        doc.font('B').fontSize(L.fontSize * 1.1).text(b.text, x, doc.y, { width: width(), align: 'left' });
        doc.moveDown(0.3);
        continue;
      }
      doc.fontSize(L.fontSize);
      const opts = {
        width: width(),
        align: 'justify' as const,
        lineGap: L.leading,
        indent: b.first ? 0 : L.fontSize * 1.5,
      };
      if (b.runs.length === 1 && !b.runs[0].bold && !b.runs[0].italic) {
        doc.font('R').text(b.runs[0].text, x, doc.y, opts);
      } else {
        const runs = tidyRuns(b.runs);
        runs.forEach((r, i) => {
          const last = i === runs.length - 1;
          doc.font(fontFor(r));
          if (i === 0) doc.text(r.text, x, doc.y, { ...opts, continued: !last });
          else doc.text(r.text, { continued: !last });
        });
      }
    }
  }

  // Back matter: about the author
  if (m.authorBio) {
    toRecto();
    noNumber.add(pageNo);
    doc.y = L.pageH * 0.22;
    center('About the Author', 'I', L.fontSize * 1.5);
    doc.moveDown(1.5);
    doc.font('R').fontSize(L.fontSize).text(m.authorBio, doc.page.margins.left, doc.y, { width: width(), align: 'justify', lineGap: L.leading });
  }

  // Even total page count, as printers require.
  if (pageNo % 2 === 1) {
    newPage();
    noNumber.add(pageNo);
  }

  // Page numbers (body pages only, not on chapter openings or blanks)
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    const n = i + 1;
    if (!bodyStart || n < bodyStart || noNumber.has(n)) continue;
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('R').fontSize(L.fontSize * 0.8).text(String(n - bodyStart + 1), 0, L.pageH - bottom * 0.6, { width: L.pageW, align: 'center', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }

  doc.end();
  const buffer = await done;
  return { buffer, pages: range.count, chapterPages };
}
