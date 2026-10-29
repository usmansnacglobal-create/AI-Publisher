import { describe, expect, it } from 'vitest';
import { ARTICLES, CATEGORIES, getArticle, sectionFor } from '@/lib/help';
import { rank, reply, searchHelp, stem } from '@/lib/help/search';

// Real-world phrasings, including typos and different words, and the article that should answer each.
const CASES: [string, string][] = [
  ['how do I turn on dark mode', 'themes'],
  ['can i change the colour of the app to dark', 'themes'],
  ['night mode please', 'themes'],
  ['how much does pro cost', 'plans-compared'],
  ['what do i get on the free plan', 'plans-compared'],
  ['how do I cancel my subscription', 'cancel-plan'],
  ['i want a refund', 'cancel-plan'],
  ['how do i upgrade to agency', 'upgrade'],
  ['can i pay with a credit card', 'upgrade'],
  ['my card was declined', 'payment-failed'],
  ['where can i find my invoices', 'receipts'],
  ['I ran out of tokens', 'tokens-run-out'],
  ['when do my tokens reset', 'tokens-run-out'],
  ['what are tokens', 'tokens-explained'],
  ['what uses up my credits', 'tokens-explained'],
  ['how do i make a book cover', 'cover-overview'],
  ['how many covers can I generate with AI', 'cover-ai'],
  ['can I upload my own cover image', 'cover-own-image'],
  ['i already have a finished cover', 'cover-own-image'],
  ['why is there no text on the spine', 'spine'],
  ['my cover looks blurry', 'cover-blurry'],
  ['how do i add my photo to the back cover', 'cover-design'],
  ['download the print cover pdf for kdp', 'cover-export'],
  ['what should I write in the cover brief', 'cover-brief'],
  ['how do I create an audiobook', 'audiobook'],
  ['can ai read my book out loud', 'audiobook'],
  ['change narrator voice to british', 'audiobook-voices'],
  ['chapter says outdated in audiobook', 'audiobook-outdated'],
  ['does audible accept ai narration', 'audiobook-stores'],
  ['how do I publish my book on amazon', 'publish-overview'],
  ['why cant i submit my book', 'publish-checklist'],
  ['continue button is greyed out on publish', 'publish-checklist'],
  ['can i sell on barnes and noble', 'publish-formats-stores'],
  ['how much should i charge for my ebook', 'publish-details'],
  ['when will my book be live', 'submission-status'],
  ['my book was rejected what now', 'changes-requested'],
  ['how do i get paid royalties', 'royalties-payouts'],
  ['do i need an isbn', 'royalties-payouts'],
  ['how do I start a new book', 'create-book-wizard'],
  ['how do i upload my word document', 'import-manuscript'],
  ['can i import a pdf manuscript', 'import-manuscript'],
  ['all my text went into one chapter after import', 'import-problems'],
  ['how do i get ai to write a chapter', 'writing-modes'],
  ['make the chapter longer', 'writing-modes'],
  ['write the whole book with ai', 'write-whole-book'],
  ['i lost my text how do i get the old version back', 'version-history'],
  ['undo the ai changes', 'version-history'],
  ['how do I split a chapter', 'chapters-manage'],
  ['reorder chapters', 'chapters-manage'],
  ['rename my book', 'book-details'],
  ['make the ai write like me', 'writing-sample'],
  ['how do i rephrase a sentence', 'selection-actions'],
  ['polish dialogue', 'ai-panel'],
  ['brainstorm ideas for the next scene', 'ask-ai'],
  ['keyboard shortcut to hide the ai panel', 'keyboard-shortcuts'],
  ['how do I check spelling and grammar', 'proofread'],
  ['spellcheck my book', 'proofread'],
  ['find plot holes', 'continuity-check'],
  ['how do I add characters', 'story-bible'],
  ['how do i change the font', 'layout-typographer'],
  ['add page numbers', 'layout-typographer'],
  ['what trim size should i use', 'trim-sizes'],
  ['layout says outdated', 'approve-layout'],
  ['how do i download my book as epub', 'downloads'],
  ['export to word', 'downloads'],
  ['I forgot my password', 'forgot-password'],
  ['cant log in', 'forgot-password'],
  ['set up two factor authentication', 'two-factor'],
  ['confirmation email link expired', 'sign-up-confirm'],
  ['change my email address', 'change-email'],
  ['set a pen name', 'profile'],
  ['stop sending me emails', 'notifications'],
  ['someone else is using my account', 'devices'],
  ['delete my account', 'delete-account'],
  ['how do i delete a book', 'delete-book'],
  ['i cant create another book', 'book-limit'],
  ['connect to zapier', 'automations'],
  ['ai is not working', 'ai-unavailable'],
  ['my changes were not saved', 'save-conflict'],
  ['why is the cover designer locked', 'locked-feature'],
  ['where do i start', 'welcome'],
  ['how do i make a cvoer', 'cover-overview'],
  ['how do i cancle my plan', 'cancel-plan'],
  ['proofraed my book', 'proofread'],
  ['audibook', 'audiobook'],
  ['how do i add a picture to my chapter', 'images'],
  ['can i insert photos', 'images'],
  ['can i print my book in colour', 'colour-printing'],
  ['why are my pictures grey', 'colour-printing'],
  ['can i make a hardcover version', 'hardcover'],
  ['what sizes can my book be', 'trim-sizes'],
  ['my book is too long for amazon', 'trim-sizes'],
  ['how do i order printed copies of my book', 'print-orders'],
  ['how much will it cost to print 20 copies', 'print-orders'],
  ['where is my print order', 'print-orders'],
  ['how many copies have i sold', 'analytics'],
  ['which stores is my book in', 'distribution-channels'],
  ['where is content creation hub', 'dashboard-tour'],
  ['dashboard overview', 'dashboard-overview'],
  ['how do i buy more narration credits', 'narration-addon'],
  ['turbo or standard', 'narration-addon'],
  ['can i get a narration top up', 'narration-addon'],
  ['how do i pay by card', 'upgrade'],
  ['can i pay in pounds', 'upgrade'],
];

describe('help content', () => {
  it('has unique slugs, known categories and valid links', () => {
    const slugs = new Set<string>();
    for (const a of ARTICLES) {
      expect(slugs.has(a.slug), a.slug).toBe(false);
      slugs.add(a.slug);
      expect(CATEGORIES.some((c) => c.id === a.category), a.slug).toBe(true);
      for (const r of a.related ?? []) expect(getArticle(r), `${a.slug} → ${r}`).toBeTruthy();
      expect(a.questions.length, a.slug).toBeGreaterThanOrEqual(3);
    }
    for (const c of CATEGORIES) expect(ARTICLES.some((a) => a.category === c.id), c.id).toBe(true);
  });

  it('works out the app section from an address', () => {
    expect(sectionFor('/dashboard/books/abc/cover')).toBe('cover');
    expect(sectionFor('/dashboard/books/abc')).toBe('overview');
    expect(sectionFor('/dashboard/books/new')).toBe('new-book');
    expect(sectionFor('/dashboard/billing')).toBe('billing');
    expect(sectionFor('/dashboard')).toBe('home');
    expect(sectionFor('/login')).toBe('login');
  });

  it('stems word forms together', () => {
    expect(stem('chapters')).toBe(stem('chapter'));
    expect(stem('narrating')).toBe(stem('narrate'));
    expect(stem('cancelled')).toBe(stem('cancel'));
  });
});

describe('help assistant', () => {
  it('answers real questions with the right article', () => {
    const misses: string[] = [];
    for (const [q, slug] of CASES) {
      const r = reply(q);
      const got = r.kind === 'answer' ? r.article.slug : r.kind === 'unsure' ? `unsure:${r.options.map((o) => o.slug).join(',')}` : r.kind;
      const ok = r.kind === 'answer' ? r.article.slug === slug : r.kind === 'unsure' && r.options[0]?.slug === slug;
      if (!ok) misses.push(`"${q}" → ${got} (expected ${slug}; top: ${rank(q).slice(0, 3).map((x) => `${x.article.slug} ${x.confidence.toFixed(2)}`).join(' | ')})`);
    }
    if (misses.length) console.log(misses.join('\n'));
    expect(misses.length / CASES.length).toBeLessThanOrEqual(0.05);
  });

  it('stays accurate whichever page the author asks from', () => {
    for (const path of ['/dashboard', '/dashboard/books/x/cover', '/dashboard/books/x/write', '/dashboard/billing', '/dashboard/books/x/publish']) {
      const misses = CASES.filter(([q, slug]) => {
        const r = reply(q, path);
        return !(r.kind === 'answer' ? r.article.slug === slug : r.kind === 'unsure' && r.options[0]?.slug === slug);
      });
      expect(misses.length / CASES.length, `${path}: ${misses.map(([q]) => q).join(' | ')}`).toBeLessThanOrEqual(0.06);
    }
  });

  it('gives a confident answer, not a list, for most questions', () => {
    const confident = CASES.filter(([q]) => reply(q).kind === 'answer').length;
    expect(confident / CASES.length).toBeGreaterThanOrEqual(0.85);
  });

  it('handles small talk and hand-off to a person', () => {
    expect(reply('hello').kind).toBe('text');
    expect(reply('thanks!').kind).toBe('text');
    expect(reply('does this chat use my tokens?').kind).toBe('text');
    const human = reply('can i talk to a real person');
    expect(human.kind === 'text' && human.contact).toBe(true);
  });

  it('admits when it does not know', () => {
    expect(['none', 'unsure']).toContain(reply('what is the capital of peru').kind);
    expect(reply('asdfgh qwerty').kind).toBe('none');
  });

  it('prefers the article for the page the author is on when unclear', () => {
    const r = rank('outdated', '/dashboard/books/x/audiobook');
    expect(r[0].article.slug).toBe('audiobook-outdated');
    const r2 = rank('outdated', '/dashboard/books/x/format');
    expect(r2[0].article.slug).toBe('approve-layout');
  });

  it('searches the Help Centre', () => {
    expect(searchHelp('spine')[0].slug).toBe('spine');
    expect(searchHelp('')).toEqual([]);
  });
});
