'use client';
import type { CoverDesign } from './cover';

const loaded = new Set<string>();

/** Loads a Google Font so canvas text can use it. */
export async function loadFont(family: string) {
  if (!loaded.has(family)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
    await new Promise((r) => { link.onload = r; link.onerror = r; });
    loaded.add(family);
  }
  await Promise.all([document.fonts.load(`700 40px "${family}"`), document.fonts.load(`400 40px "${family}"`)]).catch(() => {});
}

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the cover image.'));
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

/** Fits a title into at most `maxLines` lines by shrinking the font. */
function fitText(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, start: number, maxWidth: number, maxLines: number) {
  let size = start;
  let lines: string[] = [];
  while (size > 10) {
    ctx.font = font(size);
    lines = wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) break;
    size *= 0.93;
  }
  return { size, lines };
}

function coverFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s;
  const ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

export interface FrontText {
  title: string;
  subtitle: string;
  author: string;
  tagline: string;
  series: string;
}

/** Draws the front cover into the rectangle (x, y, w, h). `safe` is the inset kept clear of trimming. */
export function drawFront(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, d: CoverDesign, t: FrontText, x: number, y: number, w: number, h: number, safe = 0) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (img) coverFit(ctx, img, x, y, w, h);
  else {
    ctx.fillStyle = d.backColor;
    ctx.fillRect(x, y, w, h);
  }
  // Shade behind the lettering keeps it readable on any artwork.
  if (d.shade > 0) {
    const shade = (from: number, to: number) => {
      const g = ctx.createLinearGradient(0, y + from * h, 0, y + to * h);
      g.addColorStop(0, `rgba(0,0,0,${d.shade})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y + Math.min(from, to) * h, w, Math.abs(to - from) * h);
    };
    if (d.shadePosition !== 'bottom') shade(0, 0.42);
    if (d.shadePosition !== 'top') shade(1, 0.7);
  }

  const pad = Math.max(safe, w * 0.08);
  const maxW = w - pad * 2;
  const cx = d.align === 'center' ? x + w / 2 : x + pad;
  ctx.textAlign = d.align === 'center' ? 'center' : 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = w * 0.01;

  let cy = y + Math.max(safe, h * d.titleY);
  if (t.series) {
    ctx.font = `600 ${w * 0.03}px "${d.authorFont}"`;
    ctx.fillStyle = d.authorColor;
    ctx.fillText(t.series.toUpperCase(), cx, cy);
    cy += w * 0.055;
  }
  const title = d.uppercaseTitle ? t.title.toUpperCase() : t.title;
  const fit = fitText(ctx, title, (s) => `700 ${s}px "${d.titleFont}"`, w * 0.13 * d.titleScale, maxW, 4);
  ctx.fillStyle = d.titleColor;
  for (const line of fit.lines) {
    ctx.fillText(line, cx, cy);
    cy += fit.size * 1.08;
  }
  if (t.subtitle) {
    cy += fit.size * 0.2;
    const sub = fitText(ctx, t.subtitle, (s) => `400 ${s}px "${d.authorFont}"`, w * 0.042, maxW, 3);
    for (const line of sub.lines) {
      ctx.fillText(line, cx, cy);
      cy += sub.size * 1.3;
    }
  }
  if (t.tagline) {
    ctx.font = `italic 400 ${w * 0.034}px "${d.titleFont}"`;
    ctx.fillText(t.tagline, cx, y + h * 0.78, maxW);
  }
  const author = fitText(ctx, t.author.toUpperCase(), (s) => `600 ${s}px "${d.authorFont}"`, w * 0.055, maxW, 1);
  ctx.fillStyle = d.authorColor;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(author.lines[0] ?? '', cx, Math.min(y + h * d.authorY, y + h - Math.max(safe, h * 0.04)));
  ctx.restore();
}

export interface BackText {
  blurb: string;
  quotes: string[];
  bio: string;
  imprint: string;
  website: string;
}

/** Draws the full paperback wrap: back, spine and front, with bleed. Units are pixels at `dpi`. */
export function drawWrap(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  d: CoverDesign,
  front: FrontText,
  back: BackText,
  geo: { trimW: number; trimH: number; spine: number; bleed: number; spineText: boolean },
  dpi: number,
) {
  const b = geo.bleed * dpi;
  const tw = geo.trimW * dpi;
  const th = geo.trimH * dpi;
  const sw = geo.spine * dpi;
  const W = tw * 2 + sw + b * 2;
  const H = th + b * 2;
  const safe = 0.25 * dpi;

  // Back panel
  ctx.fillStyle = d.backColor;
  ctx.fillRect(0, 0, b + tw, H);
  // Spine
  ctx.fillStyle = d.spineColor;
  ctx.fillRect(b + tw, 0, sw, H);
  // Front (includes the bleed on the right, top and bottom)
  drawFront(ctx, img, d, front, b + tw + sw, 0, tw + b, H, b + safe);

  // Back text
  const bx = b + safe + 0.15 * dpi;
  const bw = tw - safe * 2 - 0.3 * dpi;
  let by = b + safe + 0.2 * dpi;
  ctx.fillStyle = d.backTextColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const q of back.quotes.filter(Boolean)) {
    const qs = fitText(ctx, `“${q.replace(/^“|”$/g, '')}”`, (s) => `italic 400 ${s}px "${d.titleFont}"`, 0.16 * dpi, bw, 4);
    for (const l of qs.lines) { ctx.fillText(l, bx, by); by += qs.size * 1.35; }
    by += 0.12 * dpi;
  }
  if (front.tagline) {
    ctx.font = `700 ${0.2 * dpi}px "${d.titleFont}"`;
    for (const l of wrap(ctx, front.tagline, bw)) { ctx.fillText(l, bx, by); by += 0.28 * dpi; }
    by += 0.08 * dpi;
  }
  const bodySize = 0.135 * dpi;
  ctx.font = `400 ${bodySize}px "${d.authorFont}"`;
  const barcodeTop = b + th - safe - 1.2 * dpi;
  for (const l of wrap(ctx, back.blurb, bw)) {
    if (by + bodySize * 1.5 > barcodeTop - 0.2 * dpi) break;
    ctx.fillText(l, bx, by);
    by += bodySize * 1.5;
  }
  if (back.bio && by < barcodeTop - 0.8 * dpi) {
    by += 0.15 * dpi;
    ctx.font = `400 ${bodySize * 0.88}px "${d.authorFont}"`;
    for (const l of wrap(ctx, back.bio, bw * 0.95)) {
      if (by + bodySize * 1.4 > barcodeTop - 0.2 * dpi) break;
      ctx.fillText(l, bx, by);
      by += bodySize * 1.35;
    }
  }
  ctx.font = `600 ${0.11 * dpi}px "${d.authorFont}"`;
  ctx.fillText([back.imprint, back.website].filter(Boolean).join('   ·   '), bx, barcodeTop + 0.5 * dpi);
  // Barcode area: KDP prints the ISBN barcode here (2" × 1.2"), so keep it blank and white.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(b + tw - safe - 2 * dpi, barcodeTop, 2 * dpi, 1.2 * dpi);

  // Spine text (only allowed from 79 pages)
  if (geo.spineText && sw > 0.2 * dpi) {
    ctx.save();
    ctx.translate(b + tw + sw / 2, b + safe);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = d.titleColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const size = Math.min(sw * 0.55, 0.22 * dpi);
    ctx.font = `700 ${size}px "${d.titleFont}"`;
    ctx.fillText(front.title, 0.1 * dpi, 0, th - safe * 2 - 1.6 * dpi);
    ctx.textAlign = 'right';
    ctx.font = `600 ${size * 0.8}px "${d.authorFont}"`;
    ctx.fillText(front.author.toUpperCase(), th - safe * 2 - 0.1 * dpi, 0, 1.4 * dpi);
    ctx.restore();
  }
  return { W, H };
}
