export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: 'start' | 'write' | 'check' | 'layout' | 'cover' | 'audio' | 'publish' | 'billing' | 'account' | 'fix';
}

export interface HelpArticle {
  slug: string;
  category: string;
  title: string;
  /** One line shown in lists and search results. */
  summary: string;
  /** The chatbot's short reply: one to three sentences. Supports **bold** and [links](/path). */
  answer: string;
  /** Ways an author might ask about this. The chatbot matches against these. */
  questions: string[];
  /** Extra words that should find this article. */
  keywords: string[];
  /**
   * The full guide. A small Markdown subset: paragraphs, "### " headings,
   * "1. " numbered steps, "- " bullets, "> " tips, **bold** and [links](/path).
   */
  body: string;
  /** A button that takes the author to the right place in the app. */
  action?: { label: string; href: string };
  related?: string[];
  /** Parts of an app address where this article is most useful, e.g. "/cover". */
  pages?: string[];
}
