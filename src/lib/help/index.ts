import type { HelpArticle, HelpCategory } from './types';
import { START_AND_WRITE } from './articles-start-write';
import { PRODUCE } from './articles-produce';
import { PUBLISH_AND_ACCOUNT } from './articles-publish-account';

export type { HelpArticle, HelpCategory } from './types';

export const CATEGORIES: HelpCategory[] = [
  { id: 'start', title: 'Getting started', description: 'Your account, your first book and finding your way around.', icon: 'start' },
  { id: 'write', title: 'Writing with AI', description: 'The editor, AI writing and edits, chapters and versions.', icon: 'write' },
  { id: 'check', title: 'Story bible and proofreading', description: 'Keep facts consistent and catch every error.', icon: 'check' },
  { id: 'layout', title: 'Layout and downloads', description: 'Design the interior and export PDF, EPUB and Word.', icon: 'layout' },
  { id: 'cover', title: 'Cover design', description: 'AI artwork, templates, lettering, spine and print files.', icon: 'cover' },
  { id: 'audio', title: 'Audiobook', description: 'Narrator voices and narrating your chapters.', icon: 'audio' },
  { id: 'publish', title: 'Publishing', description: 'Formats, stores, prices and following your submission.', icon: 'publish' },
  { id: 'billing', title: 'Plans, billing and AI tokens', description: 'Plans, payments, cancelling and your AI allowance.', icon: 'billing' },
  { id: 'account', title: 'Account and settings', description: 'Profile, security, notifications, themes and automations.', icon: 'account' },
  { id: 'fix', title: 'Troubleshooting and support', description: 'Fix common problems or contact our team.', icon: 'fix' },
];

export const ARTICLES: HelpArticle[] = [...START_AND_WRITE, ...PRODUCE, ...PUBLISH_AND_ACCOUNT];

const BY_SLUG = new Map(ARTICLES.map((a) => [a.slug, a]));
export const getArticle = (slug: string) => BY_SLUG.get(slug);
export const getCategory = (id: string) => CATEGORIES.find((c) => c.id === id);
export const articlesIn = (category: string) => ARTICLES.filter((a) => a.category === category);

/**
 * Which part of the app an address belongs to, e.g. "cover", "overview", "billing".
 * Article "pages" lists use these names.
 */
export function sectionFor(path: string): string {
  const p = path.replace(/\/+$/, '').split('?')[0];
  if (p === '/dashboard/books/new') return 'new-book';
  let m = p.match(/^\/dashboard\/books\/[^/]+\/([^/]+)/);
  if (m) return m[1];
  if (/^\/dashboard\/books\/[^/]+$/.test(p)) return 'overview';
  m = p.match(/^\/dashboard\/([^/]+)/);
  if (m) return m[1];
  if (p === '/dashboard') return 'home';
  return p.replace(/^\//, '').split('/')[0] || 'home';
}

/** Articles that suit the page the author is on. */
export function articlesForPath(path: string, limit = 4): HelpArticle[] {
  const section = sectionFor(path);
  return ARTICLES.filter((a) => a.pages?.includes(section)).slice(0, limit);
}
