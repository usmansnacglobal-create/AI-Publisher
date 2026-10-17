import 'server-only';
import { AlignmentType, Document, HeadingLevel, Packer, PageBreak, Paragraph, TextRun } from 'docx';
import type { Manuscript } from './manuscript';

/** Word manuscript in standard submission format (for editors, agents or other tools). */
export async function renderDocx(m: Manuscript) {
  const children: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 3000 }, heading: HeadingLevel.TITLE, children: [new TextRun(m.title)] }),
  ];
  if (m.subtitle) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.subtitle, italics: true })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 }, children: [new TextRun(m.author)] }));

  for (const c of m.chapters) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun(`Chapter ${c.number}: ${c.title}`)] }));
    for (const b of c.blocks) {
      if (b.type === 'break') children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('* * *')] }));
      else if (b.type === 'heading') children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(b.text)] }));
      else
        children.push(
          new Paragraph({
            indent: b.first ? undefined : { firstLine: 720 },
            spacing: { line: 360 },
            children: b.runs.map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic })),
          }),
        );
    }
  }
  const doc = new Document({
    creator: m.author,
    title: m.title,
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
