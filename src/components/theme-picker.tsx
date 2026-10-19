'use client';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Moon, Sun } from 'lucide-react';
import { THEMES, applyTheme, isDark, readTheme, type ThemeId } from '@/lib/theme';

function useTheme() {
  const [theme, setTheme] = useState<ThemeId>('system');
  useEffect(() => {
    setTheme(readTheme());
    const on = (e: Event) => setTheme((e as CustomEvent<ThemeId>).detail);
    window.addEventListener('ap-theme', on);
    return () => window.removeEventListener('ap-theme', on);
  }, []);
  return theme;
}

const SWATCH: Record<ThemeId, [string, string, string]> = {
  system: ['#F2F5F9', '#0F141C', '#2760B1'],
  light: ['#F2F5F9', '#FFFFFF', '#2760B1'],
  sepia: ['#EFE7D6', '#FBF7EE', '#2A5A9E'],
  dark: ['#0F141C', '#172030', '#7FB0F0'],
};

/** The full choice, used on the Settings page. */
export function ThemePicker() {
  const theme = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-2">
      {THEMES.map((t) => {
        const [a, b, c] = SWATCH[t.id];
        return (
          <button
            key={t.id}
            role="radio"
            aria-checked={theme === t.id}
            onClick={() => applyTheme(t.id)}
            className={clsx('flex items-center gap-3 rounded-md border p-3 text-left', theme === t.id ? 'border-cloth bg-cloth-light' : 'border-line bg-sheet hover:border-line-strong')}
          >
            <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded border border-line" style={{ background: t.id === 'system' ? `linear-gradient(135deg, ${a} 50%, ${b} 50%)` : a }} aria-hidden>
              {t.id !== 'system' && <span className="absolute inset-x-2 bottom-0 top-2 rounded-t-sm" style={{ background: b }} />}
              <span className="absolute bottom-1.5 right-1.5 h-2 w-5 rounded-sm" style={{ background: c }} />
            </span>
            <span>
              <span className="block text-[14px] font-medium text-ink">{t.label}</span>
              <span className="block text-[13px] text-ink-muted">{t.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A one-click light/dark switch for the sidebar. */
export function ThemeToggle() {
  const theme = useTheme();
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(isDark(theme)), [theme]);
  return (
    <button
      onClick={() => applyTheme(dark ? 'light' : 'dark')}
      className="flex items-center gap-1 text-ink-muted hover:text-ink"
      aria-label={dark ? 'Switch to the light theme' : 'Switch to the dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
