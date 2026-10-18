'use client';
import type { CoverDesign } from './cover';

const loaded = new Set<string>();

/** Loads a Google Font so canvas text can use it. */
export async function loadFont(family: string) {
  if (!loaded.has(family)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,400;0,600;0,700;1,400&display=swap`;
    document.head.appendChild(link);
    await new Promise((r) => {
      link.onload = r;
      link.onerror = r;
    });
    loaded.add(family);
  }
  await Promise.all([document.fonts.load(`700 40px "${family}"`), document.fonts.load(`400 40px "${family}"`), document.fonts.load(`italic 400 40px "${family}"`)]).catch(() => {});
}

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load an image for the cover.'));
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

/** Fits text into at most `maxLines` lines by shrinking the font. */
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

/** Draws an image to cover a box, with zoom and a vertical focus point. */
function coverFit(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number, zoom = 1, focusY = 0.5, focusX = 0.5) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const iw = img.width * s;
  const ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) * focusX, y + (h - ih) * focusY, iw, ih);
}

/** Draws text justified across `width`, except the last line. */
function drawBlock(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, width: number, lineH: number, align: 'left' | 'center' | 'justify', maxY: number) {
  let cy = y;
  let overflow = false;
  lines.forEach((line, i) => {
    if (cy + lineH > maxY) {
      overflow = true;
      return;
    }
    const last = i === lines.length - 1 || lines[i + 1] === '';
    if (align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(line, x + width / 2, cy);
    } else if (align === 'justify' && !last && line.includes(' ')) {
      ctx.textAlign = 'left';
      const words = line.split(' ');
      const total = words.reduce((s, w) => s + ctx.measureText(w).width, 0);
      const gap = (width - total) / (words.length - 1);
      let cx = x;
      for (const w of words) {
        ctx.fillText(w, cx, cy);
        cx += ctx.measureText(w).width + gap;
      }
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(line, x, cy);
    }
    cy += lineH;
  });
  return { y: cy, overflow };
}

export interface FrontText {
  title: string;
  subtitle: string;
  author: string;
  tagline: string;
  series: string;
}

/** Draws the front cover into (x, y, w, h). `safe` is the inset kept clear of trimming. */
export function drawFront(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, d: CoverDesign, t: FrontText, x: number, y: number, w: number, h: number, safe = 0) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (img) coverFit(ctx, img, x, y, w, h, d.artZoom ?? 1, d.artY ?? 0.5);
  else {
    ctx.fillStyle = d.backColor;
    ctx.fillRect(x, y, w, h);
  }
  if (d.finishedFront && img) {
    ctx.restore();
    return;
  }

  // A shade behind the lettering keeps it readable on any artwork.
  if (d.shade > 0 && d.shadePosition !== 'none') {
    const shade = (from: number, to: number) => {
      const g = ctx.createLinearGradient(0, y + from * h, 0, y + to * h);
      g.addColorStop(0, `rgba(0,0,0,${d.shade})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y + Math.min(from, to) * h, w, Math.abs(to - from) * h);
    };
    if (d.shadePosition === 'all') {
      ctx.fillStyle = `rgba(0,0,0,${d.shade * 0.7})`;
      ctx.fillRect(x, y, w, h);
    } else {
      if (d.shadePosition !== 'bottom') shade(0, 0.42);
      if (d.shadePosition !== 'top') shade(1, 0.7);
    }
  }

  const pad = Math.max(safe, w * 0.08);
  const maxW = w - pad * 2;
  const align = d.align ?? 'center';
  const cx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - pad : x + pad;
  ctx.textAlign = align;
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
  const author = fitText(ctx, t.author.toUpperCase(), (s) => `600 ${s}px "${d.authorFont}"`, w * 0.055 * (d.authorScale ?? 1), maxW, 1);
  ctx.fillStyle = d.authorColor;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(author.lines[0] ?? '', cx, Math.min(y + h * d.authorY, y + h - Math.max(safe, h * 0.04)));
  ctx.restore();
}

export interface BackText {
  blurb: string;
  quotes: string[];
  sources: string[];
  bio: string;
  imprint: string;
  website: string;
}

export interface WrapAssets {
  backImage?: HTMLImageElement | null;
  authorPhoto?: HTMLImageElement | null;
  logo?: HTMLImageElement | null;
}

/**
 * Draws the full paperback wrap: back, spine and front, with bleed, at `dpi`.
 * Returns the canvas size and whether the back-cover text had to be cut short.
 */
export function drawWrap(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  d: CoverDesign,
  front: FrontText,
  back: BackText,
  geo: { trimW: number; trimH: number; spine: number; bleed: number; spineText: boolean; safe?: number },
  dpi: number,
  assets: WrapAssets = {},
) {
  const b = geo.bleed * dpi;
  const tw = geo.trimW * dpi;
  const th = geo.trimH * dpi;
  const sw = geo.spine * dpi;
  const W = tw * 2 + sw + b * 2;
  const H = th + b * 2;
  const safe = (geo.safe ?? 0.25) * dpi;
  const backW = b + tw;

  // Back panel background
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, backW, H);
  ctx.clip();
  ctx.fillStyle = d.backColor;
  ctx.fillRect(0, 0, backW, H);
  const bg = d.backBackground ?? 'solid';
  if ((bg === 'match' || bg === 'blur' || bg === 'fade') && img) {
    if (bg === 'blur') ctx.filter = `blur(${Math.round(dpi * 0.12)}px) brightness(0.7)`;
    ctx.save();
    if (bg === 'match') {
      // Mirror the artwork so the back continues the front.
      ctx.translate(backW, 0);
      ctx.scale(-1, 1);
    }
    coverFit(ctx, img, bg === 'blur' ? -dpi * 0.3 : 0, bg === 'blur' ? -dpi * 0.3 : 0, backW + (bg === 'blur' ? dpi * 0.6 : 0), H + (bg === 'blur' ? dpi * 0.6 : 0), d.artZoom ?? 1, d.artY ?? 0.5);
    ctx.restore();
    ctx.filter = 'none';
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (bg === 'fade') {
      g.addColorStop(0, 'rgba(0,0,0,0.25)');
      g.addColorStop(0.45, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
    } else {
      g.addColorStop(0, 'rgba(0,0,0,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, backW, H);
  } else if (bg === 'image' && assets.backImage) {
    coverFit(ctx, assets.backImage, 0, 0, backW, H);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, backW, H);
  }
  ctx.restore();

  // Spine
  ctx.fillStyle = d.spineColor;
  ctx.fillRect(backW, 0, sw, H);
  // Front (includes the bleed on the right, top and bottom)
  drawFront(ctx, img, d, front, backW + sw, 0, tw + b, H, b + safe);

  // Back text
  const bx = b + safe + 0.15 * dpi;
  const bw = tw - safe * 2 - 0.3 * dpi;
  let by = b + safe + 0.2 * dpi;
  const barcodeTop = b + th - safe - 1.2 * dpi;
  const textBottom = barcodeTop - 0.2 * dpi;
  let overflow = false;
  ctx.fillStyle = d.backTextColor;
  ctx.textBaseline = 'top';
  const blurbFont = d.blurbFont || d.authorFont;
  const scale = d.blurbScale ?? 1;

  back.quotes.forEach((q, i) => {
    if (!q.trim()) return;
    const qs = fitText(ctx, `“${q.trim().replace(/^[“"]|[”"]$/g, '')}”`, (s) => `italic 400 ${s}px "${d.titleFont}"`, 0.16 * dpi * scale, bw, 4);
    const r = drawBlock(ctx, qs.lines, bx, by, bw, qs.size * 1.35, d.blurbAlign === 'center' ? 'center' : 'left', textBottom);
    by = r.y;
    overflow ||= r.overflow;
    const src = back.sources[i]?.trim();
    if (src) {
      ctx.font = `600 ${0.11 * dpi * scale}px "${d.authorFont}"`;
      const r2 = drawBlock(ctx, [`— ${src}`], bx, by + 0.03 * dpi, bw, 0.15 * dpi, d.blurbAlign === 'center' ? 'center' : 'left', textBottom);
      by = r2.y;
    }
    by += 0.12 * dpi;
  });
  if (front.tagline) {
    ctx.font = `700 ${0.2 * dpi * scale}px "${d.titleFont}"`;
    const r = drawBlock(ctx, wrap(ctx, front.tagline, bw), bx, by, bw, 0.28 * dpi * scale, d.blurbAlign === 'center' ? 'center' : 'left', textBottom);
    by = r.y + 0.08 * dpi;
  }
  const bodySize = 0.135 * dpi * scale;
  ctx.font = `400 ${bodySize}px "${blurbFont}"`;
  const blurb = drawBlock(ctx, wrap(ctx, back.blurb, bw), bx, by, bw, bodySize * 1.5, d.blurbAlign ?? 'left', textBottom);
  by = blurb.y;
  overflow ||= blurb.overflow;

  if (back.bio && by < textBottom - 0.8 * dpi) {
    by += 0.15 * dpi;
    const photo = assets.authorPhoto;
    const ps = 0.85 * dpi;
    let textX = bx;
    let textW = bw;
    if (photo) {
      ctx.save();
      ctx.beginPath();
      if (d.photoShape === 'square') ctx.rect(bx, by, ps, ps);
      else ctx.arc(bx + ps / 2, by + ps / 2, ps / 2, 0, Math.PI * 2);
      ctx.clip();
      coverFit(ctx, photo, bx, by, ps, ps, 1, 0.3);
      ctx.restore();
      textX = bx + ps + 0.15 * dpi;
      textW = bw - ps - 0.15 * dpi;
    }
    ctx.fillStyle = d.backTextColor;
    ctx.font = `400 ${bodySize * 0.88}px "${blurbFont}"`;
    const r = drawBlock(ctx, wrap(ctx, back.bio, textW), textX, by, textW, bodySize * 1.35, 'left', textBottom);
    overflow ||= r.overflow;
  } else if (back.bio) overflow = true;

  // Publisher line and logo at the foot
  const footY = barcodeTop + 0.5 * dpi;
  if (assets.logo) {
    const lh = 0.45 * dpi;
    const lw = Math.min(1.2 * dpi, (assets.logo.width / assets.logo.height) * lh);
    ctx.drawImage(assets.logo, bx, barcodeTop + 0.35 * dpi, lw, lh);
  }
  ctx.font = `600 ${0.11 * dpi}px "${d.authorFont}"`;
  ctx.textAlign = 'left';
  ctx.fillText([back.imprint, back.website].filter(Boolean).join('   ·   '), bx + (assets.logo ? 1.35 * dpi : 0), footY, bw - 2.2 * dpi);
  // Barcode area: the printer adds the ISBN barcode here (2" × 1.2"), so keep it blank and white.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(b + tw - safe - 2 * dpi, barcodeTop, 2 * dpi, 1.2 * dpi);

  // Spine text (only allowed from 79 pages)
  if (geo.spineText && sw > 0.2 * dpi) {
    ctx.save();
    ctx.translate(backW + sw / 2, b + safe);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = d.spineTextColor || d.titleColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const size = Math.min(sw * 0.55, 0.22 * dpi);
    ctx.font = `700 ${size}px "${d.spineFont || d.titleFont}"`;
    ctx.fillText(front.title, 0.1 * dpi, 0, th - safe * 2 - 1.6 * dpi);
    ctx.textAlign = 'right';
    ctx.font = `600 ${size * 0.8}px "${d.authorFont}"`;
    ctx.fillText(front.author.toUpperCase(), th - safe * 2 - 0.1 * dpi, 0, 1.4 * dpi);
    ctx.restore();
  }
  return { W, H, overflow };
}

/** A 1200 × 630 image for social media and store pages: the front cover on a matching background. */
export function drawSocial(ctx: CanvasRenderingContext2D, front: HTMLCanvasElement, d: CoverDesign, t: FrontText) {
  const W = 1200;
  const H = 630;
  ctx.fillStyle = d.backColor;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.filter = 'blur(30px) brightness(0.6)';
  coverFit(ctx, front, -60, -60, W + 120, H + 120);
  ctx.restore();
  const ch = 540;
  const cw = (front.width / front.height) * ch;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 30;
  ctx.drawImage(front, 90, (H - ch) / 2, cw, ch);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const x = 90 + cw + 60;
  const fit = fitText(ctx, t.title, (s) => `700 ${s}px "${d.titleFont}"`, 64, W - x - 60, 4);
  let y = 150;
  for (const l of fit.lines) {
    ctx.fillText(l, x, y);
    y += fit.size * 1.1;
  }
  ctx.font = `600 28px "${d.authorFont}"`;
  ctx.fillText(t.author.toUpperCase(), x, y + 24);
  if (t.tagline) {
    ctx.font = `italic 400 26px "${d.titleFont}"`;
    const lines = wrap(ctx, t.tagline, W - x - 60).slice(0, 3);
    lines.forEach((l, i) => ctx.fillText(l, x, y + 80 + i * 34));
  }
}

/** Paints a simple template background (no lettering) at 1024 × 1536. */
export function drawTemplate(ctx: CanvasRenderingContext2D, kind: string, colors: readonly string[]) {
  const W = 1024;
  const H = 1536;
  const [a, b2] = colors;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, W, H);
  if (kind === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, a);
    g.addColorStop(1, b2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (kind === 'frame') {
    ctx.strokeStyle = '#A8833A';
    ctx.lineWidth = 6;
    ctx.strokeRect(60, 60, W - 120, H - 120);
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 80, W - 160, H - 160);
  } else if (kind === 'band') {
    ctx.fillStyle = b2;
    ctx.fillRect(0, H * 0.58, W, H * 0.3);
  } else if (kind === 'rule') {
    ctx.fillStyle = b2;
    ctx.fillRect(W * 0.12, H * 0.55, W * 0.76, 6);
  } else if (kind === 'circle') {
    ctx.fillStyle = b2;
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.6, W * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fine paper grain so flat colours print without banding.
  const grain = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    grain.data[i] += n;
    grain.data[i + 1] += n;
    grain.data[i + 2] += n;
  }
  ctx.putImageData(grain, 0, 0);
}
