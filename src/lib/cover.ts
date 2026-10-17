export const MOODS = ['Dark', 'Hopeful', 'Romantic', 'Tense', 'Whimsical', 'Professional', 'Inspirational', 'Minimalist', 'Epic', 'Cozy'] as const;
export const COVER_STYLES = {
  pictorial: { label: 'Pictorial', hint: 'Photographic, realistic' },
  illustrative: { label: 'Illustrative', hint: 'Painted or drawn' },
  vector: { label: 'Vector art', hint: 'Flat, graphic shapes' },
  typographic: { label: 'Typographic', hint: 'Type-led, minimal imagery' },
} as const;
export const PALETTES = ['auto', 'dark', 'light', 'vibrant', 'muted', 'monochrome', 'custom'] as const;
export const TITLE_FONTS = ['Playfair Display', 'Montserrat', 'Oswald', 'Merriweather', 'Libre Baskerville', 'Raleway', 'Cinzel', 'Lora', 'Bebas Neue', 'Cormorant Garamond'] as const;

export interface CoverBrief {
  subtitle: string;
  moods: string[];
  format: 'ebook' | 'paperback';
  pageCountOverride: number | null;
  style: keyof typeof COVER_STYLES;
  imagery: string;
  palette: (typeof PALETTES)[number];
  customColours: string;
  inspiration: string[];
  avoid: string;
  instructions: string;
  referencePaths: string[];
  rightsConfirmed: boolean;
  tagline: string;
  series: string;
  seriesNumber: string;
  reviewQuotes: string[];
  imprint: string;
  website: string;
}

export interface CoverDesign {
  titleFont: string;
  authorFont: string;
  titleColor: string;
  authorColor: string;
  titleScale: number; // 0.6–1.6
  titleY: number; // 0–1 of height
  authorY: number;
  align: 'center' | 'left';
  shade: number; // 0–0.8 darkening gradient behind text
  shadePosition: 'top' | 'bottom' | 'both';
  uppercaseTitle: boolean;
  spineColor: string;
  backColor: string;
  backTextColor: string;
}

export const DEFAULT_BRIEF: CoverBrief = {
  subtitle: '',
  moods: [],
  format: 'paperback',
  pageCountOverride: null,
  style: 'illustrative',
  imagery: '',
  palette: 'auto',
  customColours: '',
  inspiration: [],
  avoid: '',
  instructions: '',
  referencePaths: [],
  rightsConfirmed: false,
  tagline: '',
  series: '',
  seriesNumber: '',
  reviewQuotes: [],
  imprint: '',
  website: '',
};

export const DEFAULT_DESIGN: CoverDesign = {
  titleFont: 'Playfair Display',
  authorFont: 'Montserrat',
  titleColor: '#ffffff',
  authorColor: '#ffffff',
  titleScale: 1,
  titleY: 0.14,
  authorY: 0.9,
  align: 'center',
  shade: 0.45,
  shadePosition: 'both',
  uppercaseTitle: false,
  spineColor: '#1d2433',
  backColor: '#1d2433',
  backTextColor: '#f2f2ee',
};
