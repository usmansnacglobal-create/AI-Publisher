import 'server-only';
import JSZip from 'jszip';
import { randomUUID } from 'node:crypto';
import { escapeXml, type Block, type Manuscript, type Run } from './manuscript';
import { BODY_FONTS, DEFAULT_LAYOUT, numberWords, type LayoutSettings } from '../layout';

const CSS = `body{font-family:Georgia,serif;line-height:1.5;margin:0 5%}
h1{font-size:1.6em;text-align:center;margin:2.5em 0 0.2em;font-weight:normal;font-style:italic}
.num{text-align:center;font-size:.8em;letter-spacing:.2em;text-transform:uppercase;margin-top:3em}
p{margin:0;text-indent:1.4em;text-align:justify}
p.first{text-indent:0}
p.first::first-letter{font-size:1.1em}
.break{text-align:center;margin:1em 0;text-indent:0}
h2{font-size:1.1em;margin:1.2em 0 .4em}
.title{text-align:center;margin-top:30%}
.title h1{font-style:normal;font-size:2em}
.center{text-align:center;text-indent:0}
.small{font-size:.8em}`;

const runHtml = (r: Run) => {
  let t = escapeXml(r.text);
  if (r.italic) t = `<em>${t}</em>`;
  if (r.bold) t = `<strong>${t}</strong>`;
  if (r.underline) t = `<span class="u">${t}</span>`;
  return t;
};

function layoutCss(L: LayoutSettings) {
  return `body{font-family:${BODY_FONTS[L.font].css}}
${L.paragraph === 'block' ? 'p{text-indent:0;margin:0 0 .8em}' : ''}
${L.dropCaps ? 'p.opener::first-letter{float:left;font-size:3.1em;line-height:.85;margin:.05em .08em 0 0}' : ''}
${L.heading === 'modern' ? 'h1{font-style:normal;font-weight:bold;text-align:left;margin-top:.4em}.num{text-align:left;font-size:2.4em;letter-spacing:0;font-weight:bold;text-transform:none;margin-top:2em}' : ''}
${L.heading === 'decorative' ? '.orn{text-align:center;text-indent:0;margin-top:2.5em;font-size:1.2em}' : ''}
.u{text-decoration:underline}
blockquote{margin:1em 1.5em;font-style:italic}
ul,ol{margin:.6em 0 .6em 1.4em;padding:0}li{margin:.2em 0}`;
}

function blockHtml(b: Block, opener: boolean) {
  switch (b.type) {
    case 'break':
      return '<p class="break">* * *</p>';
    case 'heading':
      return `<h2>${escapeXml(b.text)}</h2>`;
    case 'quote':
      return `<blockquote><p class="first">${b.runs.map(runHtml).join('')}</p></blockquote>`;
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      return `<${tag}>${b.items.map((it) => `<li>${it.map(runHtml).join('')}</li>`).join('')}</${tag}>`;
    }
    default:
      return `<p class="${[b.first ? 'first' : '', opener ? 'opener' : ''].filter(Boolean).join(' ')}">${b.runs.map(runHtml).join('')}</p>`.replace(' class=""', '');
  }
}

const page = (title: string, body: string, lang: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head><meta charset="UTF-8"/><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>${body}</body></html>`;

/** Builds a valid EPUB 3 ebook (with EPUB 2 table of contents for older readers). */
export async function renderEpub(m: Manuscript, cover?: { data: Buffer; type: 'image/png' | 'image/jpeg' }, L: LayoutSettings = DEFAULT_LAYOUT) {
  const zip = new JSZip();
  const id = `urn:uuid:${randomUUID()}`;
  const lang = m.language || 'en';
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );
  const o = zip.folder('OEBPS')!;
  o.file('style.css', CSS + '\n' + layoutCss(L));

  const items: { id: string; href: string; type: string; props?: string }[] = [];
  const spine: string[] = [];
  const add = (idv: string, href: string, html: string, props?: string) => {
    o.file(href, html);
    items.push({ id: idv, href, type: 'application/xhtml+xml', props });
    spine.push(idv);
  };

  if (cover) {
    const ext = cover.type === 'image/png' ? 'png' : 'jpg';
    o.file(`cover.${ext}`, cover.data);
    items.push({ id: 'cover-image', href: `cover.${ext}`, type: cover.type, props: 'cover-image' });
    add('cover', 'cover.xhtml', page('Cover', `<div style="text-align:center"><img src="cover.${ext}" alt="${escapeXml(m.title)}" style="max-width:100%;max-height:100%"/></div>`, lang));
  }

  add(
    'titlepage',
    'title.xhtml',
    page(
      m.title,
      `<div class="title"><h1>${escapeXml(m.title)}</h1>${m.subtitle ? `<p class="center"><em>${escapeXml(m.subtitle)}</em></p>` : ''}<p class="center" style="margin-top:3em">${escapeXml(m.author)}</p></div>`,
      lang,
    ),
  );
  add(
    'copyright',
    'copyright.xhtml',
    page('Copyright', `<div style="margin-top:40%" class="small"><p class="first">Copyright © ${m.year} ${escapeXml(m.copyrightHolder || m.author)}</p><p class="first">All rights reserved.</p>${m.isbn ? `<p class="first">ISBN: ${escapeXml(m.isbn)}</p>` : ''}</div>`, lang),
  );
  if (m.dedication) add('dedication', 'dedication.xhtml', page('Dedication', `<p class="center" style="margin-top:30%"><em>${escapeXml(m.dedication)}</em></p>`, lang));

  m.chapters.forEach((c, i) => {
    const firstPara = c.blocks.findIndex((b) => b.type === 'para');
    const body = c.blocks.map((b, j) => blockHtml(b, j === firstPara)).join('\n');
    const label = L.heading === 'modern' ? String(c.number) : `Chapter ${numberWords(c.number)}`;
    const orn = L.heading === 'decorative' ? '<p class="orn">— ◆ —</p>' : '';
    add(`ch${i + 1}`, `chapter-${i + 1}.xhtml`, page(c.title, `<section epub:type="chapter">${orn}<p class="num">${escapeXml(label)}</p><h1>${escapeXml(c.title)}</h1>${body}</section>`, lang));
  });
  if (m.authorBio) add('about', 'about.xhtml', page('About the Author', `<h1>About the Author</h1><p class="first">${escapeXml(m.authorBio)}</p>`, lang));

  const navList = m.chapters.map((c, i) => `<li><a href="chapter-${i + 1}.xhtml">${escapeXml(c.title)}</a></li>`).join('');
  o.file('nav.xhtml', page('Contents', `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${navList}</ol></nav>`, lang));
  items.push({ id: 'nav', href: 'nav.xhtml', type: 'application/xhtml+xml', props: 'nav' });
  o.file(
    'toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${id}"/></head><docTitle><text>${escapeXml(m.title)}</text></docTitle><navMap>${m.chapters
      .map((c, i) => `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${escapeXml(c.title)}</text></navLabel><content src="chapter-${i + 1}.xhtml"/></navPoint>`)
      .join('')}</navMap></ncx>`,
  );
  items.push({ id: 'ncx', href: 'toc.ncx', type: 'application/x-dtbncx+xml' });
  items.push({ id: 'css', href: 'style.css', type: 'text/css' });

  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  o.file(
    'content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${m.isbn ? `urn:isbn:${escapeXml(m.isbn)}` : id}</dc:identifier>
<dc:title>${escapeXml(m.title)}</dc:title>
<dc:creator>${escapeXml(m.author)}</dc:creator>
<dc:language>${lang}</dc:language>
${m.blurb ? `<dc:description>${escapeXml(m.blurb)}</dc:description>` : ''}
<meta property="dcterms:modified">${modified}</meta>
${cover ? '<meta name="cover" content="cover-image"/>' : ''}
</metadata>
<manifest>${items.map((it) => `<item id="${it.id}" href="${it.href}" media-type="${it.type}"${it.props ? ` properties="${it.props}"` : ''}/>`).join('')}</manifest>
<spine toc="ncx">${spine.map((s) => `<itemref idref="${s}"/>`).join('')}</spine>
</package>`,
  );
  return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}
