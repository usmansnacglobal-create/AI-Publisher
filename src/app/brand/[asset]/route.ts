import { readStoredBrand } from '@/lib/brand-server';

/** Serves the business logo, dark-mode logo and browser icon. Public, so sign-in pages can show them. */
export async function GET(_req: Request, { params }: { params: { asset: string } }) {
  const s = await readStoredBrand();
  const pick = { logo: s.logo, 'logo-dark': s.logoDark || s.logo, icon: s.icon || null }[params.asset];
  if (params.asset === 'icon' && !pick) return new Response(null, { status: 404 });
  if (!pick) return new Response(null, { status: 404 });
  return new Response(Buffer.from(pick, 'base64'), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400' },
  });
}
