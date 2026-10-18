export const THEMES = [
  { id: 'system', label: 'Match my device', hint: 'Light by day, dark at night, following your device setting.' },
  { id: 'light', label: 'Light', hint: 'Clean and bright.' },
  { id: 'sepia', label: 'Sepia', hint: 'Warm paper tones, easier on the eyes for long writing sessions.' },
  { id: 'dark', label: 'Dark', hint: 'Light text on a dark background, good for low light.' },
] as const;
export type ThemeId = (typeof THEMES)[number]['id'];
export const THEME_KEY = 'ap-theme';

/** Runs before the page paints, so there's no flash of the wrong theme. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t&&t!=='system')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export function readTheme(): ThemeId {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t && THEMES.some((x) => x.id === t)) return t as ThemeId;
  } catch {}
  return 'system';
}

export function applyTheme(t: ThemeId) {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {}
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  window.dispatchEvent(new CustomEvent('ap-theme', { detail: t }));
}

/** Whether the screen is currently showing the dark theme (for the quick toggle's icon). */
export function isDark(t: ThemeId) {
  return t === 'dark' || (t === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
