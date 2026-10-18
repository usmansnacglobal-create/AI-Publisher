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
  /** Also make a hardcover (case laminate) cover. */
  hardcover?: boolean;
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
  quoteSources: string[];
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
  authorScale: number; // 0.6–1.6
  align: 'center' | 'left' | 'right';
  shade: number; // 0–0.8 darkening behind text
  shadePosition: 'none' | 'top' | 'bottom' | 'both' | 'all';
  uppercaseTitle: boolean;
  artY: number; // 0–1: which part of the artwork shows when it is cropped
  artZoom: number; // 1–1.6
  finishedFront: boolean; // uploaded finished cover: no lettering added
  spineColor: string;
  spineTextColor: string;
  spineFont: string;
  backBackground: 'solid' | 'match' | 'blur' | 'fade' | 'image';
  backImagePath: string | null;
  backColor: string;
  backTextColor: string;
  blurbFont: string;
  blurbScale: number; // 0.8–1.3
  blurbAlign: 'left' | 'center' | 'justify';
  authorPhotoPath: string | null;
  photoShape: 'circle' | 'square';
  logoPath: string | null;
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
  quoteSources: [],
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
  authorScale: 1,
  align: 'center',
  shade: 0.45,
  shadePosition: 'both',
  uppercaseTitle: false,
  artY: 0.5,
  artZoom: 1,
  finishedFront: false,
  spineColor: '#1d2433',
  spineTextColor: '#ffffff',
  spineFont: 'Playfair Display',
  backBackground: 'solid',
  backImagePath: null,
  backColor: '#1d2433',
  backTextColor: '#f2f2ee',
  blurbFont: 'Lora',
  blurbScale: 1,
  blurbAlign: 'left',
  authorPhotoPath: null,
  photoShape: 'circle',
  logoPath: null,
};

/** Simple artwork templates drawn in the browser, for authors who want a typographic cover without AI art. */
export const TEMPLATES = [
  { id: 'cloth', name: 'Bookcloth', colors: ['#2F5D50', '#244A40'], kind: 'frame' },
  { id: 'dusk', name: 'Dusk', colors: ['#1C2541', '#C46A4C'], kind: 'gradient' },
  { id: 'paper', name: 'Paper and ink', colors: ['#F2EBDD', '#1C2230'], kind: 'band' },
  { id: 'ocean', name: 'Deep water', colors: ['#0B3C5D', '#328CC1'], kind: 'gradient' },
  { id: 'noir', name: 'Noir', colors: ['#111317', '#A8833A'], kind: 'rule' },
  { id: 'meadow', name: 'Meadow', colors: ['#E8EFE3', '#6B8F5E'], kind: 'circle' },
] as const;
