import type { MetadataRoute } from 'next';

// Search indexing is off. Crawlers may fetch pages so they can see the "noindex" signal
// (a Disallow here would hide that signal from Google), but AI training crawlers are blocked outright.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: ['GPTBot', 'ChatGPT-User', 'CCBot', 'Google-Extended', 'anthropic-ai', 'ClaudeBot', 'PerplexityBot', 'Bytespider'], disallow: '/' },
      { userAgent: '*', allow: '/' },
    ],
  };
}
