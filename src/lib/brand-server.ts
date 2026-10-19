import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from './supabase/admin';
import { DEFAULT_BRAND, type Brand } from './brand';

export interface StoredBrand {
  name?: string;
  tagline?: string;
  showName?: boolean;
  /** PNG images as base64 (small: resized when uploaded). */
  logo?: string | null;
  logoDark?: string | null;
  icon?: string | null;
  /** The icon was made from the logo rather than uploaded. */
  iconFromLogo?: boolean;
  updatedAt?: string;
}

export const readStoredBrand = unstable_cache(
  async (): Promise<StoredBrand> => {
    try {
      const { data } = await createAdminClient().from('app_settings').select('value').eq('key', 'branding').maybeSingle();
      return (data?.value as StoredBrand) ?? {};
    } catch {
      return {};
    }
  },
  ['branding'],
  { tags: ['branding'], revalidate: 300 },
);

export async function getBrand(): Promise<Brand> {
  const s = await readStoredBrand();
  return {
    name: s.name?.trim() || DEFAULT_BRAND.name,
    tagline: s.tagline?.trim() ?? '',
    showName: s.showName !== false || !s.logo,
    hasLogo: !!s.logo,
    hasDarkLogo: !!s.logoDark,
    hasIcon: !!(s.icon || s.logo),
    version: s.updatedAt ? String(new Date(s.updatedAt).getTime()) : '0',
  };
}
