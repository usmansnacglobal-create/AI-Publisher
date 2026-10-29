import type { Metadata } from 'next';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/literata/opsz.css';
import '@fontsource-variable/literata/opsz-italic.css';
import './globals.css';
import { ToastProvider } from '@/components/toast';
import { BrandProvider } from '@/components/brand-context';
import { THEME_SCRIPT } from '@/lib/theme';
import { getBrand } from '@/lib/brand-server';

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: { default: brand.name, template: `%s · ${brand.name}` },
    description: brand.tagline || 'Write, edit, format, design and publish your book in one place, with AI help at every step.',
    ...(brand.hasIcon ? { icons: { icon: `/brand/icon?v=${brand.version}`, apple: `/brand/icon?v=${brand.version}` } } : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrand();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <BrandProvider brand={brand}>
          <ToastProvider>{children}</ToastProvider>
        </BrandProvider>
      </body>
    </html>
  );
}
