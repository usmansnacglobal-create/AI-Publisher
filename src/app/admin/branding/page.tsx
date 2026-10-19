import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getViewer } from '@/lib/data';
import { getBrand } from '@/lib/brand-server';
import { BrandingForm } from './form';

export const metadata = { title: 'Branding' };
export const dynamic = 'force-dynamic';

export default async function BrandingPage() {
  const { profile } = await getViewer();
  if (profile.role !== 'admin') notFound();
  const brand = await getBrand();
  return (
    <main className="mx-auto max-w-[900px] px-4 py-8">
      <div className="flex flex-wrap gap-4 text-[13px] text-ink-muted"><Link href="/admin">Publishing queue</Link><Link href="/admin/system">System check</Link></div>
      <h1 className="mb-1 mt-1">Branding</h1>
      <p className="mb-6 text-ink-muted">Your business name and logo appear across the site: the sidebar, sign-in pages, home page, Help Centre, browser tab, emails, PayPal checkout and the details of exported PDFs.</p>
      <BrandingForm initial={brand} />
    </main>
  );
}
