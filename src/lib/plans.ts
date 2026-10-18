export type PlanId = 'free' | 'pro' | 'agency';

/** Paid tools. Free authors can write, use AI assist and export ebooks. */
export type Feature = 'bible' | 'proofread' | 'print' | 'cover' | 'publish' | 'audiobook' | 'automations';

export const FEATURE_NAMES: Record<Feature, string> = {
  bible: 'The story bible and continuity checks',
  proofread: 'Proofreading reports',
  print: 'Print-ready PDF interiors',
  cover: 'The AI cover designer',
  publish: 'The publishing kit and submission',
  audiobook: 'AI audiobook narration',
  automations: 'Automations',
};

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  /** null = unlimited */
  bookLimit: number | null;
  monthlyTokens: number;
  /** AI cover generation runs per book */
  coverRunsPerBook: number;
  integrations: boolean;
  tools: Feature[];
  features: string[];
}

// Keep book limits in sync with enforce_book_limit() in supabase/migrations/0001_init.sql.
export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    bookLimit: 1,
    monthlyTokens: 30_000,
    coverRunsPerBook: 0,
    integrations: false,
    tools: [],
    features: ['1 book', '30,000 AI tokens a month', 'Writing and AI assist', 'Ebook export'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 29,
    bookLimit: 10,
    monthlyTokens: 500_000,
    coverRunsPerBook: 3,
    integrations: false,
    tools: ['bible', 'proofread', 'print', 'cover', 'publish', 'audiobook'],
    features: [
      'Up to 10 books',
      '500,000 AI tokens a month',
      'Story bible and continuity checks',
      'Proofreading reports',
      'Print and ebook formatting',
      'AI cover designer',
      'Publishing kit and submission',
      '3 AI cover runs per book',
      'AI audiobook narration',
    ],
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    priceMonthly: 79,
    bookLimit: null,
    monthlyTokens: 2_000_000,
    coverRunsPerBook: 10,
    integrations: true,
    tools: ['bible', 'proofread', 'print', 'cover', 'publish', 'audiobook', 'automations'],
    features: ['Unlimited books', '2,000,000 AI tokens a month', 'Everything in Pro', '10 AI cover runs per book', 'Zapier and webhook automations'],
  },
};

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : 'free'];
}

/**
 * Cover images cost far more to generate than text, so each OpenAI image token
 * counts as this many tokens against the monthly allowance.
 */
export const IMAGE_TOKEN_WEIGHT = Number(process.env.IMAGE_TOKEN_WEIGHT ?? 3);

export const FEATURE_LABELS: Record<string, string> = {
  outline: 'Chapter outlines',
  chapter: 'Chapter writing',
  assist: 'AI assist',
  deep_edit: 'Deep edits',
  rewrite: 'Book rewrites',
  bible: 'Story bible',
  continuity: 'Continuity checks',
  proofread: 'Proofreading',
  publishing_kit: 'Publishing kit',
  cover_image: 'Cover images',
  cover_text: 'Cover copy',
  illustration: 'Book images',
  audiobook: 'Audiobook narration',
};

export function planAllows(planId: string | null | undefined, f: Feature) {
  return getPlan(planId).tools.includes(f);
}
