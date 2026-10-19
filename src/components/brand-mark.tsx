import { clsx } from 'clsx';
import type { Brand } from '@/lib/brand';

/** The business logo and name, as used in headers. Switches to the dark-mode logo with the theme. */
export function BrandMark({ brand, size = 'md', className }: { brand: Brand; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  // A logo that already contains the name is shown a little larger, so the name stays readable.
  const h = brand.showName ? { sm: 'h-7', md: 'h-8', lg: 'h-10' }[size] : { sm: 'h-8', md: 'h-10', lg: 'h-12' }[size];
  const text = { sm: 'text-[1.15rem]', md: 'text-[1.3rem]', lg: 'text-[1.4rem]' }[size];
  return (
    <span className={clsx('inline-flex min-w-0 items-center gap-2.5', className)}>
      {brand.hasLogo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/brand/logo?v=${brand.version}`} alt={brand.showName ? '' : brand.name} className={clsx(h, 'w-auto max-w-[190px] object-contain', brand.hasDarkLogo && 'brand-logo-light')} />
          {brand.hasDarkLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/brand/logo-dark?v=${brand.version}`} alt={brand.showName ? '' : brand.name} className={clsx(h, 'brand-logo-dark w-auto max-w-[190px] object-contain')} />
          )}
        </>
      )}
      {brand.showName && <span className={clsx('truncate font-serif leading-tight text-ink', text)}>{brand.name}</span>}
    </span>
  );
}
