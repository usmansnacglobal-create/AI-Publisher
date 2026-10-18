'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

export function BookTabs({ id }: { id: string }) {
  const path = usePathname();
  const base = `/dashboard/books/${id}`;
  const tabs = [
    ['', 'Overview'],
    ['/write', 'Write'],
    ['/bible', 'Story bible'],
    ['/proofread', 'Proofread'],
    ['/format', 'Layout'],
    ['/cover', 'Cover'],
    ['/audiobook', 'Audiobook'],
    ['/publish', 'Publish'],
    ['/print', 'Print copies'],
  ];
  return (
    <nav className="-mx-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Book sections">
      <ul className="flex gap-1">
        {tabs.map(([seg, label]) => {
          const href = base + seg;
          const active = seg ? path.startsWith(href) : path === base;
          return (
            <li key={seg}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  '-mb-px block whitespace-nowrap border-b-2 px-3 py-2 text-[14px]',
                  active ? 'border-cloth font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
