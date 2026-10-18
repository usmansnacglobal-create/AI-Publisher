import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { HelpAssistant } from '@/components/help/assistant';

export const metadata = { title: { default: 'Help Centre', template: '%s · Help Centre · AI Publisher' } };

export default async function PublicHelpLayout({ children }: { children: React.ReactNode }) {
  const { data } = await createClient().auth.getUser();
  const signedIn = !!data.user;
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-sheet">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-4 py-3">
          <Link href="/help" className="flex items-baseline gap-2">
            <span className="font-serif text-[1.25rem] text-ink">AI Publisher</span>
            <span className="text-[14px] text-ink-muted">Help Centre</span>
          </Link>
          <Link href={signedIn ? '/dashboard' : '/login'} className="rounded border border-line-strong px-3 py-1.5 text-[14px] hover:border-ink-faint">
            {signedIn ? 'Back to the app' : 'Sign in'}
          </Link>
        </div>
      </header>
      <main className="px-4 pb-24 pt-8 sm:px-8">{children}</main>
      <HelpAssistant signedIn={signedIn} />
    </div>
  );
}
