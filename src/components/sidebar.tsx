'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  BarChart3, Bell, BookOpen, ChevronDown, CreditCard, FilePlus2, Gauge, Globe2, History, Inbox, LayoutDashboard, LayoutGrid, LifeBuoy, LogOut, Menu,
  Palette, PenLine, Printer, Send, Settings, Shield, Type, X, type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { compact } from '@/lib/text';
import { Progress } from './ui';
import { ThemeToggle } from './theme-picker';

type Item = { href: string; label: string; icon: LucideIcon };
type Group = { title: string; items: Item[] };

// Grouped the same way as the original AI Content Publisher, so authors find things where they expect.
const TOP: Item[] = [
  { href: '/dashboard', label: 'Home', icon: LayoutGrid },
  { href: '/dashboard/overview', label: 'Dashboard Overview', icon: LayoutDashboard },
];
const GROUPS: Group[] = [
  {
    title: 'Content Creation Hub',
    items: [
      { href: '/dashboard/books', label: 'My Library', icon: BookOpen },
      { href: '/dashboard/books/new', label: 'Writing Launchpad', icon: FilePlus2 },
      { href: '/dashboard/writing', label: 'Document Editor', icon: PenLine },
    ],
  },
  {
    title: 'Styling & Design Studio',
    items: [
      { href: '/dashboard/layout', label: 'Layout Typographer', icon: Type },
      { href: '/dashboard/covers', label: 'Media & Cover Designer', icon: Palette },
    ],
  },
  {
    title: 'Publishing & Outbound',
    items: [
      { href: '/dashboard/publishing', label: 'Publishing', icon: Send },
      { href: '/dashboard/distribution', label: 'Distribution Channels', icon: Globe2 },
      { href: '/dashboard/analytics', label: 'Performance Analytics', icon: BarChart3 },
      { href: '/dashboard/print-orders', label: 'Print Orders', icon: Printer },
    ],
  },
  {
    title: 'Platform Management',
    items: [
      { href: '/dashboard/usage', label: 'Credits & AI Tokens', icon: Gauge },
      { href: '/dashboard/billing', label: 'Billing & Subscriptions', icon: CreditCard },
      { href: '/dashboard/activity', label: 'System Activity Logs', icon: History },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ],
  },
];
const BOTTOM: Item[] = [
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/help', label: 'Help', icon: LifeBuoy },
];
const ADMIN: Group = {
  title: 'Admin',
  items: [
    { href: '/admin', label: 'Publishing queue', icon: Shield },
    { href: '/admin/support', label: 'Support inbox', icon: Inbox },
    { href: '/admin/print', label: 'Print orders (admin)', icon: Printer },
    { href: '/admin/sales', label: 'Sales data', icon: BarChart3 },
    { href: '/admin/system', label: 'System check', icon: Gauge },
  ],
};

/** Which menu item a page belongs to. Each book's tabs light up the matching studio item. */
export function activeHref(path: string): string {
  const tab = /^\/dashboard\/books\/(?!new\b)[^/]+(?:\/([^/]+))?/.exec(path);
  if (tab) {
    const map: Record<string, string> = { write: '/dashboard/writing', format: '/dashboard/layout', cover: '/dashboard/covers', publish: '/dashboard/publishing', print: '/dashboard/print-orders' };
    return map[tab[1] ?? ''] ?? '/dashboard/books';
  }
  const all = [...TOP, ...GROUPS.flatMap((g) => g.items), ...BOTTOM, ...ADMIN.items].map((i) => i.href);
  const exact = all.find((h) => h === path);
  if (exact) return exact;
  return all.filter((h) => h !== '/dashboard' && h !== '/admin' && path.startsWith(h + '/')).sort((a, b) => b.length - a.length)[0] ?? '';
}

const GROUP_KEY = 'ap-nav-closed';

export function Sidebar({ name, isAdmin, unread, usage }: { name: string; isAdmin: boolean; unread: number; usage: { used: number; limit: number; plan: string; resets: string } }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState<string[]>([]);
  const pct = (usage.used / usage.limit) * 100;
  const current = activeHref(path);

  useEffect(() => {
    try {
      setClosed(JSON.parse(localStorage.getItem(GROUP_KEY) ?? '[]'));
    } catch {}
  }, []);
  function toggle(title: string) {
    setClosed((c) => {
      const next = c.includes(title) ? c.filter((t) => t !== title) : [...c, title];
      try {
        localStorage.setItem(GROUP_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const link = (item: Item) => {
    const active = item.href === current;
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={() => setOpen(false)}
          aria-current={active ? 'page' : undefined}
          className={clsx(
            'flex items-center gap-3 rounded px-3 py-1.5 text-[14px]',
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
  };

  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const nav = (
    <nav className="flex h-full flex-col">
      <Link href="/dashboard" className="px-5 pb-4 pt-6 font-serif text-[1.3rem]" onClick={() => setOpen(false)}>
        AI Publisher
      </Link>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        <ul className="space-y-0.5">{TOP.map(link)}</ul>
        {[...GROUPS, ...(isAdmin ? [ADMIN] : [])].map((g) => {
          const isClosed = closed.includes(g.title) && !g.items.some((i) => i.href === current);
          return (
            <div key={g.title} className="mt-3">
              <button
                onClick={() => toggle(g.title)}
                aria-expanded={!isClosed}
                className="flex w-full items-center justify-between rounded px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted hover:text-ink"
              >
                {g.title}
                <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', isClosed && '-rotate-90')} aria-hidden />
              </button>
              {!isClosed && <ul className="mt-0.5 space-y-0.5">{g.items.map(link)}</ul>}
            </div>
          );
        })}
        <ul className="mt-3 space-y-0.5 border-t border-line pt-3">{BOTTOM.map(link)}</ul>
      </div>
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
