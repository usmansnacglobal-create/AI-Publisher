'use client';
import { forwardRef, useEffect, useRef } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Loader2, X } from 'lucide-react';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const btn = (variant: BtnVariant, size: 'sm' | 'md') =>
  clsx(
    'inline-flex items-center justify-center gap-2 rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 whitespace-nowrap',
    size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-[14px]',
    variant === 'primary' && 'bg-cloth text-white hover:bg-cloth-dark',
    variant === 'secondary' && 'border border-line-strong bg-sheet text-ink hover:border-ink-faint',
    variant === 'ghost' && 'text-ink-soft hover:bg-ink/5',
    variant === 'danger' && 'bg-danger text-white hover:brightness-95',
  );

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean }
>(function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} className={clsx(btn(variant, size), className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({ href, variant = 'primary', size = 'md', className, children }: { href: string; variant?: BtnVariant; size?: 'sm' | 'md'; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={clsx(btn(variant, size), className)}>
      {children}
    </Link>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-[13px] text-danger">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Progress({ value, tone = 'cloth', label }: { value: number; tone?: 'cloth' | 'gilt' | 'danger'; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={clsx('h-full rounded-full', tone === 'cloth' && 'bg-cloth', tone === 'gilt' && 'bg-gilt', tone === 'danger' && 'bg-danger')} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'cloth' | 'gilt' | 'danger' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[12px] font-medium',
        tone === 'neutral' && 'bg-ink/[.06] text-ink-soft',
        tone === 'cloth' && 'bg-cloth-light text-cloth-dark',
        tone === 'gilt' && 'bg-gilt-light text-[#7A5E25]',
        tone === 'danger' && 'bg-danger-light text-danger',
      )}
    >
      {children}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={clsx('w-[min(94vw,520px)] rounded-lg bg-sheet p-0 text-ink shadow-2xl backdrop:bg-ink/40', wide && 'w-[min(94vw,820px)]')}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-[1.15rem]">{title}</h2>
        <button onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-ink/5" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="panel flex flex-col items-start gap-3 px-6 py-10">
      <h3>{title}</h3>
      {children && <div className="max-w-prose text-ink-muted">{children}</div>}
      {action}
    </div>
  );
}

export function PageHeader({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1>{title}</h1>
        {children && <p className="mt-1 max-w-prose text-ink-muted">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
