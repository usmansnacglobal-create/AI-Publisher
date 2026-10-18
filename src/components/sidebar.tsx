'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Bell, BookOpen, CreditCard, Gauge, History, LayoutGrid, LogOut, Menu, Settings, Shield, Send, PenLine, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { compact } from '@/lib/text';
import { Progress } from './ui';
import { ThemeToggle } from './theme-picker';

const NAV = [
  { href: '/dashboard', label: 'Home', icon: LayoutGrid, exact: true },
  { href: '/dashboard/books', label: 'My books', icon: BookOpen },
  { href: '/dashboard/writing', label: 'Writing', icon: PenLine },
  { href: '/dashboard/publishing', label: 'Publishing', icon: Send },
  { href: '/dashboard/usage', label: 'AI usage', icon: Gauge },
  { href: '/dashboard/billing', label: 'Plan and billing', icon: CreditCard },
  { href: '/dashboard/activity', label: 'Activity', icon: History },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ name, isAdmin, unread, usage }: { name: string; isAdmin: boolean; unread: number; usage: { used: number; limit: number; plan: string; resets: string } }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pct = (usage.used / usage.limit) * 100;

  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const nav = (
    <nav className="flex h-full flex-col">
      <Link href="/dashboard" className="px-5 pb-6 pt-6 font-serif text-[1.3rem]" onClick={() => setOpen(false)}>
        AI Publisher
      </Link>
      <ul className="flex-1 space-y-0.5 px-3">
        {[...NAV, ...(isAdmin ? [{ href: '/admin', label: 'Publishing queue', icon: Shield }] : [])].map((item) => {
          const active = 'exact' in item && item.exact ? path === item.href : path.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-3 rounded px-3 py-2 text-[14px]',
                  active ? 'bg-sheet font-medium text-ink shadow-[inset_2px_0_0_rgb(var(--c-cloth))]' : 'text-ink-soft hover:bg-sheet/60',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.href === '/dashboard/notifications' && unread > 0 && (
                  <span className="rounded-full bg-cloth px-1.5 text-[11px] font-semibold text-white">{unread > 99 ? '99+' : unread}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="m-3 rounded-md border border-line bg-sheet p-3">
        <div className="mb-2 flex items-baseline justify-between text-[13px]">
          <span className="font-medium">{usage.plan} plan</span>
          <span className="text-ink-muted">
            {compact(usage.used)} / {compact(usage.limit)}
          </span>
        </div>
        <Progress value={pct} tone={pct >= 100 ? 'danger' : pct >= 80 ? 'gilt' : 'cloth'} label="AI tokens used this month" />
        <p className="mt-2 text-[12px] text-ink-muted">
          AI tokens reset {new Date(usage.resets).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3 text-[13px]">
        <span className="truncate text-ink-soft">{name}</span>
        <span className="flex items-center gap-3">
          <ThemeToggle />
          <button onClick={signOut} className="flex items-center gap-1 text-ink-muted hover:text-ink" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </span>
      </div>
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ground/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="font-serif text-[1.15rem]">AI Publisher</Link>
        <button onClick={() => setOpen(true)} className="rounded p-1.5 hover:bg-ink/5" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <aside className="sticky top-0 hidden h-screen border-r border-line lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[#0B0D10]/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[270px] bg-ground">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded p-1 hover:bg-ink/5" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
