import 'server-only';
import sharp from 'sharp';
import { createAdminClient } from './supabase/admin';
import { IMAGE_RE } from './text';

export type ImageSize = 'small' | 'medium' | 'full';
export const SIZE_FRACTION: Record<ImageSize, number> = { small: 0.5, medium: 0.75, full: 1 };
const NAME = /^[a-z0-9-]{8,64}\.(png|jpe?g|webp)$/i;

/** The stored file name for an image that belongs to this book, or null for anything else (e.g. a web address). */
export function imageName(src: string, bookId: string) {
  const m = /^\/api\/books\/([0-9a-f-]{36})\/images\/([^/?#]+)$/.exec(src);
  return m && m[1] === bookId && NAME.test(m[2]) ? m[2] : null;
}
export const imagePath = (userId: string, bookId: string, name: string) => `${userId}/${bookId}/images/${name}`;
export const validImageName = (name: string) => NAME.test(name);

export interface UsedImage {
  src: string;
  caption: string;
  size: ImageSize;
  chapter: string;
}

/** Every image used in the chapters, in reading order. */
export function imagesIn(chapters: { title: string; content: string }[]): UsedImage[] {
  return chapters.flatMap((c) =>
    [...c.content.matchAll(IMAGE_RE)].map((m) => ({
      src: m[2],
      caption: m[1],
      size: (['small', 'medium', 'full'].includes(m[3] ?? '') ? m[3] : 'full') as ImageSize,
      chapter: c.title,
    })),
  );
}

export interface LoadedImage {
  data: Buffer;
  width: number;
  height: number;
  /** jpeg or png, ready for PDF, EPUB and Word. */
  format: 'jpeg' | 'png';
}

/**
 * Loads a book's images for export. WebP is converted (PDF and Word can't use it),
 * and black-and-white books get greyscale images so the preview matches the print.
 */
export async function loadImages(userId: string, bookId: string, srcs: string[], opts: { greyscale?: boolean; maxWidth?: number } = {}) {
  const out = new Map<string, LoadedImage>();
  const admin = createAdminClient();
  const names = [...new Set(srcs.map((s) => imageName(s, bookId)).filter(Boolean) as string[])];
  await Promise.all(
    names.map(async (name) => {
      const { data } = await admin.storage.from('manuscripts').download(imagePath(userId, bookId, name));
      if (!data) return;
      let img = sharp(Buffer.from(await data.arrayBuffer()), { failOn: 'none' }).rotate();
      const meta = await img.metadata();
      if (!meta.width || !meta.height) return;
      if (opts.greyscale) img = img.grayscale();
      if (opts.maxWidth && meta.width > opts.maxWidth) img = img.resize({ width: opts.maxWidth });
      const keepPng = meta.format === 'png' && meta.hasAlpha;
      const buf = keepPng ? await img.png().toBuffer() : await img.flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
      const final = await sharp(buf).metadata();
      out.set(`/api/books/${bookId}/images/${name}`, { data: buf, width: final.width ?? meta.width, height: final.height ?? meta.height, format: keepPng ? 'png' : 'jpeg' });
    }),
  );
  return out;
}

/** Pixel size of each image without decoding it, for the print-quality check. */
export async function imageSizes(userId: string, bookId: string, srcs: string[]) {
  const out = new Map<string, { width: number; height: number }>();
  const admin = createAdminClient();
  const names = [...new Set(srcs.map((s) => imageName(s, bookId)).filter(Boolean) as string[])];
  await Promise.all(
    names.map(async (name) => {
      const { data } = await admin.storage.from('manuscripts').download(imagePath(userId, bookId, name));
      if (!data) return;
      const meta = await sharp(Buffer.from(await data.arrayBuffer()), { failOn: 'none' }).metadata();
      const rotated = (meta.orientation ?? 1) >= 5;
      if (meta.width && meta.height) out.set(`/api/books/${bookId}/images/${name}`, { width: rotated ? meta.height : meta.width, height: rotated ? meta.width : meta.height });
    }),
  );
  return out;
}
