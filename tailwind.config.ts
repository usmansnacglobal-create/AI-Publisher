import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#EEF0EC', // page background: cool, slightly green-grey
        sheet: '#FFFFFF',
        ink: { DEFAULT: '#1C2230', soft: '#3A4252', muted: '#5E6675', faint: '#8B92A0' },
        line: { DEFAULT: '#D9DCD4', strong: '#BFC4BA' },
        cloth: { DEFAULT: '#2F5D50', dark: '#244A40', light: '#E3ECE8' }, // bookcloth green
        gilt: { DEFAULT: '#A8833A', light: '#F3ECDD' }, // foil-stamp gold, used sparingly
        danger: { DEFAULT: '#A8402E', light: '#F6E4DF' },
        added: { DEFAULT: '#2C6A4A', bg: '#E2F0E7' },
        removed: { DEFAULT: '#9C3727', bg: '#F8E3DE' },
      },
      fontFamily: {
        sans: ['"Figtree Variable"', 'system-ui', 'sans-serif'],
        serif: ['"Newsreader Variable"', 'Georgia', 'serif'],
      },
      borderRadius: { sm: '3px', DEFAULT: '5px', md: '7px', lg: '10px' },
      maxWidth: { prose: '68ch' },
    },
  },
  plugins: [],
} satisfies Config;
