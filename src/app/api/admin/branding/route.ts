import { z } from 'zod';
import sharp from 'sharp';
import { revalidatePath, revalidateTag } from 'next/cache';
import { handle, json, requireUser, HttpError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { readStoredBrand, type StoredBrand } from '@/lib/brand-server';

const Image = z.string().regex(/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/, 'Use a PNG, JPG, WebP or SVG image.').max(4_000_000, 'That image is too large. Use one under 2 MB.').nullable().optional();

const Body = z.object({
  name: z.string().trim().min(1, 'Add your business name.').max(60),
  tagline: z.string().trim().max(120).default(''),
  showName: z.boolean().default(true),
  logo: Image,
  logoDark: Image,
  icon: Image,
});

const decode = (dataUrl: string) => Buffer.from(dataUrl.split(',')[1], 'base64');

/** Logos are stored small: at most 640 × 160 pixels, as PNG with transparency kept. */
async function toLogo(dataUrl: string) {
  try {
    const png = await sharp(decode(dataUrl), { density: 300 }).resize({ width: 640, height: 160, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    return png.toString('base64');
  } catch {
    throw new HttpError(400, 'That image couldn’t be read. Try a PNG or JPG.');
  }
}

/** Browser icons are square: the picture is centred on a transparent 256 × 256 square. */
async function toIcon(dataUrl: string) {
  try {
    const png = await sharp(decode(dataUrl), { density: 300 }).resize({ width: 256, height: 256, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    return png.toString('base64');
  } catch {
    throw new HttpError(400, 'That icon couldn’t be read. Try a square PNG.');
  }
}

async function requireAdmin() {
  const { supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) throw new HttpError(403, 'Admins only.');
}

/** Saves the business name and logos. Leave an image out to keep it; send null to remove it. */
export const PUT = handle(async (req: Request) => {
  await requireAdmin();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
  const b = parsed.data;
  const current = await readStoredBrand();
  const next: StoredBrand = { ...current, name: b.name, tagline: b.tagline, showName: b.showName, updatedAt: new Date().toISOString() };
  if (b.logo !== undefined) next.logo = b.logo ? await toLogo(b.logo) : null;
  if (b.logoDark !== undefined) next.logoDark = b.logoDark ? await toLogo(b.logoDark) : null;
  if (b.icon !== undefined) {
    next.icon = b.icon ? await toIcon(b.icon) : null;
    next.iconFromLogo = false;
  }
  // Without an icon of its own, the browser icon is made from the logo (and follows it).
  if ((!next.icon || next.iconFromLogo) && b.logo !== undefined) {
    next.icon = next.logo ? await toIcon(`data:image/png;base64,${next.logo}`) : null;
    next.iconFromLogo = !!next.logo;
  }
  const { error } = await createAdminClient().from('app_settings').upsert({ key: 'branding', value: next, updated_at: next.updatedAt });
  if (error) throw error;
  revalidateTag('branding');
  revalidatePath('/', 'layout');
  return json({ ok: true });
});
