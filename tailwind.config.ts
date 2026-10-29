import type { Config } from 'tailwindcss';

export default {
  darkMode: ['selector', "[data-theme='dark']"],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Every colour comes from a CSS variable, so the light, sepia and dark themes swap in globals.css.
      colors: {
        white: 'rgb(var(--c-on-accent) / <alpha-value>)', // text on filled buttons and badges; dark in the dark theme
        ground: 'rgb(var(--c-ground) / <alpha-value>)',
        sheet: 'rgb(var(--c-sheet) / <alpha-value>)',
        ink: { DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)', soft: 'rgb(var(--c-ink-soft) / <alpha-value>)', muted: 'rgb(var(--c-ink-muted) / <alpha-value>)', faint: 'rgb(var(--c-ink-faint) / <alpha-value>)' },
        line: { DEFAULT: 'rgb(var(--c-line) / <alpha-value>)', strong: 'rgb(var(--c-line-strong) / <alpha-value>)' },
        cloth: { DEFAULT: 'rgb(var(--c-cloth) / <alpha-value>)', dark: 'rgb(var(--c-cloth-dark) / <alpha-value>)', light: 'rgb(var(--c-cloth-light) / <alpha-value>)' }, // bookcloth green
        gilt: { DEFAULT: 'rgb(var(--c-gilt) / <alpha-value>)', light: 'rgb(var(--c-gilt-light) / <alpha-value>)', ink: 'rgb(var(--c-gilt-ink) / <alpha-value>)' }, // foil-stamp gold, used sparingly
        danger: { DEFAULT: 'rgb(var(--c-danger) / <alpha-value>)', light: 'rgb(var(--c-danger-light) / <alpha-value>)' },
        added: { DEFAULT: 'rgb(var(--c-added) / <alpha-value>)', bg: 'rgb(var(--c-added-bg) / <alpha-value>)' },
        removed: { DEFAULT: 'rgb(var(--c-removed) / <alpha-value>)', bg: 'rgb(var(--c-removed-bg) / <alpha-value>)' },
      },
      fontFamily: {
        sans: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'],
        serif: ['"Literata Variable"', 'Georgia', 'serif'],
      },
      borderRadius: { sm: '3px', DEFAULT: '5px', md: '7px', lg: '10px' },
      maxWidth: { prose: '68ch' },
    },
  },
  plugins: [],
} satisfies Config;
