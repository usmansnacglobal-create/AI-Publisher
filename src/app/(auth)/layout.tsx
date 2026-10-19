import Link from 'next/link';
import { HelpAssistant } from '@/components/help/assistant';
import { BrandMark } from '@/components/brand-mark';
import { getBrand } from '@/lib/brand-server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrand();
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mb-8 block">
          <BrandMark brand={brand} size="lg" />
          {brand.tagline && <span className="mt-1 block text-[14px] text-ink-muted">{brand.tagline}</span>}
        </Link>
        <div className="panel p-6 sm:p-8">{children}</div>
        <p className="mt-4 text-center text-[13px] text-ink-muted">
          Need help? <Link href="/help" className="underline">Visit the Help Centre</Link>
        </p>
      </div>
      <HelpAssistant signedIn={false} />
    </main>
  );
}
