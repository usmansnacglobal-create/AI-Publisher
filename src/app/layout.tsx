import type { Metadata } from 'next';
import '@fontsource-variable/figtree';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import './globals.css';
import { ToastProvider } from '@/components/toast';
import { THEME_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  title: { default: 'AI Publisher', template: '%s · AI Publisher' },
  description: 'Write, edit, format, design and publish your book in one place, with AI help at every step.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
