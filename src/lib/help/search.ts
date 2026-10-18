/**
 * The help assistant's "brain". It never calls an AI service: it matches the
 * author's question against the help articles with classic search techniques
 * (word stemming, synonyms, typo tolerance and BM25-style scoring), entirely in
 * the browser. So it's instant, free and uses no AI tokens.
 */
import { ARTICLES, sectionFor, type HelpArticle } from './index';

// ───────────── Text normalisation ─────────────

const STOP = new Set(
  `a about above after again all am an and any are as at be because been before being below between both but by can could
  did do does doing done down during each few for from further get got had has have having he her here hers him his how i if in into is it its
  itself just me more most my myself no nor now of on once only or other our ours out over own same she should so some such than that the
  their theirs them then there these they this those through to too under until up very was we were what when where which while who whom why
  will with would you your yours yourself please pls plz want wanna need trying try tried able possible way ways im ive id youre thing things
  something anything also still really much many there let lets know tell show give help hi hello hey thanks`.split(/\s+/),
);
// Words that matter for meaning even though they look like stop words.
const KEEP = new Set(['not', 'off', 'out', 'new', 'all', 'back', 'up', 'down', 'own', 'more', 'many', 'help', 'show']);

/** Phrases rewritten before splitting into words, so they match as one idea. */
const PHRASES: [RegExp, string][] = [
  [/\bdark ?mode|night ?mode|light ?mode\b/g, ' theme dark '],
  [/\btwo[- ]?(factor|step)|2fa|2 fa|mfa|authenticator\b/g, ' twofactor '],
  [/\bpen ?name|pseudonym|nom de plume\b/g, ' penname '],
  [/\bback ?cover\b/g, ' backcover '],
  [/\bfront ?cover\b/g, ' frontcover cover '],
  [/\b(log|sign) ?(in|on)\b/g, ' signin '],
  [/\b(log|sign) ?out\b/g, ' signout '],
  [/\bsign ?up\b/g, ' signup '],
  [/\btext ?to ?speech|tts|read (it )?(out )?(loud|aloud)\b/g, ' audiobook narrate '],
  [/\bstory ?bible\b/g, ' storybible '],
  [/\bscene ?break\b/g, ' scenebreak '],
  [/\bdrop ?caps?\b/g, ' dropcap '],
  [/\bpage ?numbers?\b/g, ' pagenumber '],
  [/\btrim ?size\b/g, ' trimsize '],
  [/\bspell(ing)? ?check(er)?|spellcheck\b/g, ' proofread spelling '],
  [/\bplot ?holes?\b/g, ' continuity '],
  [/\bran out|run out|running out|used up|no tokens? left\b/g, ' tokenout '],
  [/\bcredit ?card|debit ?card\b/g, ' card '],
  [/\bprint on demand|\bpod\b/g, ' paperback print '],
  [/\bbarnes ?(and|&) ?noble|b&n\b/g, ' barnesnoble '],
  [/\bgoogle ?play\b/g, ' googleplay '],
  [/\bapple ?books?\b/g, ' applebooks '],
  [/\bsocial ?media\b/g, ' social '],
  [/\bcustomer ?(service|support|care)|real person|human being|live (chat|agent)\b/g, ' support human '],
  [/\bcan ?not|can't|cant|won't|wont|doesn't|doesnt|isn't|isnt|didn't|didnt|not able\b/g, ' not '],
  [/\bwhere'?s\b/g, ' where '],
  [/\bout[- ]of[- ]date\b/g, ' outdated '],
];

/** Different words authors use for the same thing. Each maps to the words our articles use. */
const SYNONYMS: Record<string, string[]> = {
  login: ['signin'], logon: ['signin'], logout: ['signout'], register: ['signup'], registration: ['signup'],
  subscription: ['plan'], subscriptions: ['plan'], membership: ['plan'], package: ['plan'], tier: ['plan'],
  price: ['price', 'cost'], prices: ['price'], pricing: ['price', 'plan'], cost: ['price'], costs: ['price'], fee: ['price'], fees: ['price'], charge: ['price', 'payment'], expensive: ['price'],
  credit: ['token'], credits: ['token'], quota: ['token'], allowance: ['token'], word: ['word'],
  colour: ['colour', 'color'], color: ['colour', 'color'], colours: ['colour'], colors: ['colour'],
  picture: ['photo', 'image'], pic: ['photo', 'image'], pics: ['image'], illustration: ['image', 'artwork'], art: ['artwork'], graphic: ['image'],
  typo: ['proofread', 'spelling'], typos: ['proofread', 'spelling'], mistake: ['error', 'proofread'], mistakes: ['error', 'proofread'],
  blurb: ['description', 'blurb'], synopsis: ['description', 'summary'],
  narration: ['narrate', 'audiobook'], narrator: ['narrate', 'voice'], audio: ['audiobook'], listen: ['audiobook'], mp3: ['audiobook'], spoken: ['audiobook'],
  kdp: ['amazon', 'kindle'], kindle: ['kindle', 'amazon'], amazon: ['amazon'], acx: ['audible'],
  typeset: ['layout'], typesetting: ['layout'], formatting: ['layout', 'format'], interior: ['layout'], typography: ['layout', 'font'], typeface: ['font'],
  margin: ['margins'], gutter: ['margins'],
  remove: ['delete'], erase: ['delete'], trash: ['delete'], bin: ['delete'],
  rename: ['title', 'rename'], retitle: ['title'],
  download: ['download', 'export'], export: ['export', 'download'], save: ['save', 'download'], backup: ['download', 'backup'],
  upload: ['upload', 'import'], import: ['import', 'upload'], docx: ['word', 'docx'], doc: ['word'], msword: ['word'],
  outline: ['outline', 'plan'], structure: ['outline', 'plan'],
  refund: ['refund', 'cancel'], unsubscribe: ['cancel'], downgrade: ['cancel', 'downgrade'],
  invoice: ['receipt'], invoices: ['receipt'], bill: ['billing'], bills: ['billing'],
  hacked: ['signout', 'security'], password: ['password'], pw: ['password'], pwd: ['password'],
  bug: ['problem', 'support'], broken: ['error', 'working'], crash: ['error'], stuck: ['error'], glitch: ['error'], issue: ['problem'],
  agent: ['support', 'human'], person: ['human'], someone: ['human'], staff: ['support', 'human'], team: ['team'],
  appearance: ['theme'], night: ['theme', 'dark'], bright: ['theme', 'light'],
  isbn: ['isbn'], royalty: ['royalties'], payout: ['royalties', 'paid'], earn: ['earn', 'royalties'],
  undo: ['undo', 'restore'], revert: ['restore', 'version'], rollback: ['restore', 'version'], lost: ['lost', 'restore'], disappeared: ['lost', 'restore'], vanished: ['lost', 'restore'],
  characters: ['character', 'storybible'], character: ['character', 'storybible'], consistent: ['consistent', 'continuity'],
  hook: ['hook'], ending: ['ending'], chat: ['ask'], brainstorm: ['brainstorm', 'ask'],
  status: ['status'], approved: ['approve'], rejected: ['rejected', 'approved'], live: ['live'],
  zapier: ['zapier', 'automation'], webhook: ['webhook', 'automation'], integration: ['automation'], integrate: ['automation'],
  email: ['email'], mail: ['email'], inbox: ['email'],
  remaining: ['left'],
  mobile: ['phone'], iphone: ['phone'], android: ['phone'], tablet: ['phone'],
};

const STEM_EXCEPTIONS = new Set(['news', 'plus', 'bus', 'status', 'canvas', 'access', 'process', 'business', 'series', 'pages', 'notes', 'bless']);

/** A deliberately light stemmer: "chapters", "chaptered" and "chapter" become the same word. */
export function stem(w: string): string {
  if (w.length <= 3 || STEM_EXCEPTIONS.has(w) || /\d/.test(w)) return w;
  const s = rawStem(w);
  return s.length > 4 && s.endsWith('e') ? s.slice(0, -1) : s;
}
function rawStem(w: string): string {
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ing') && w.length > 5) return trimDouble(w.slice(0, -3));
  if (w.endsWith('ed') && w.length > 4) return trimDouble(w.slice(0, -2));
  if (w.endsWith('ly') && w.length > 5) return w.slice(0, -2);
  if (/(ss|sh|ch|x)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}
function trimDouble(w: string) {
  return /([bdgklmnprt])\1$/.test(w) ? w.slice(0, -1) : w.endsWith('e') ? w : w;
}

function normalise(text: string): string {
  let t = ` ${text.toLowerCase().replace(/[’‘`]/g, "'").replace(/[“”]/g, '"')} `;
  for (const [re, rep] of PHRASES) t = t.replace(re, rep);
  return t.replace(/'s\b/g, '').replace(/[^a-z0-9&+ ]+/g, ' ');
}

/** Words for indexing (no synonym expansion). */
export function words(text: string): string[] {
  return normalise(text)
    .split(/\s+/)
    .filter((w) => w && (KEEP.has(w) || !STOP.has(w)))
    .map(stem);
}

// ───────────── The index ─────────────

type Field = 'title' | 'question' | 'keyword' | 'summary' | 'answer' | 'body';
const WEIGHT: Record<Field, number> = { title: 3, question: 3, keyword: 2.5, summary: 1.6, answer: 1.2, body: 0.5 };

interface Doc {
  article: HelpArticle;
  fields: Map<string, number>; // word → best field weight
  questions: Set<string>[];
  slugWords: Set<string>;
}

let INDEX: { docs: Doc[]; idf: Map<string, number>; vocab: string[] } | null = null;

function buildIndex() {
  const docs: Doc[] = ARTICLES.map((a) => {
    const fields = new Map<string, number>();
    const add = (text: string, f: Field) => {
      for (const w of words(text)) fields.set(w, Math.max(fields.get(w) ?? 0, WEIGHT[f]));
    };
    add(a.title, 'title');
    a.questions.forEach((q) => add(q, 'question'));
    add(a.keywords.join(' '), 'keyword');
    add(a.summary, 'summary');
    add(a.answer, 'answer');
    add(a.body, 'body');
    return { article: a, fields, questions: [a.title, ...a.questions].map((q) => new Set(words(q))), slugWords: new Set(words(a.slug.replace(/-/g, ' '))) };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const w of d.fields.keys()) df.set(w, (df.get(w) ?? 0) + 1);
  const N = docs.length;
  const idf = new Map<string, number>();
  for (const [w, n] of df) idf.set(w, Math.log(1 + (N - n + 0.5) / (n + 0.5)));
  INDEX = { docs, idf, vocab: [...df.keys()] };
  return INDEX;
}
const index = () => INDEX ?? buildIndex();

/** Edit distance where swapped neighbouring letters ("cvoer") count as one mistake. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** The query's words, each with the alternatives it may match (synonyms and typo corrections). */
function queryTerms(text: string): { word: string; options: { w: string; factor: number }[] }[] {
  const { idf, vocab } = index();
  const raw = normalise(text)
    .split(/\s+/)
    .filter((w) => w && (KEEP.has(w) || !STOP.has(w)));
  return raw.map((orig) => {
    const base = stem(orig);
    const options: { w: string; factor: number }[] = [{ w: base, factor: 1 }];
    for (const s of SYNONYMS[orig] ?? SYNONYMS[base] ?? []) options.push({ w: stem(s), factor: 0.9 });
    if (!idf.has(base) && base.length >= 4) {
      const max = base.length >= 8 ? 2 : 1;
      for (const v of vocab) {
        if (v.length >= 4 && editDistance(base, v, max) <= max) options.push({ w: v, factor: 0.75 });
        else if (base.length >= 5 && v.length > base.length && v.startsWith(base)) options.push({ w: v, factor: 0.7 });
      }
    }
    return { word: base, options };
  });
}

export interface Ranked {
  article: HelpArticle;
  score: number;
  /** 0–1: how much of the question this article covers. */
  confidence: number;
}

/** Ranks every article for a question. The current page gives a small nudge. */
export function rank(question: string, path?: string): Ranked[] {
  const { docs, idf } = index();
  const terms = queryTerms(question);
  if (!terms.length) return [];
  const section = path ? sectionFor(path) : '';
  const qset = new Set(terms.map((t) => t.word));
  const maxIdf = Math.max(...idf.values());
  const possible = terms.reduce((s, t) => s + (idf.get(t.word) ?? maxIdf * 0.6), 0) * WEIGHT.title;

  const out: Ranked[] = docs.map((d) => {
    let score = 0;
    for (const t of terms) {
      let best = 0;
      for (const o of t.options) {
        const fw = d.fields.get(o.w);
        if (fw) best = Math.max(best, fw * o.factor * (idf.get(o.w) ?? 0));
      }
      score += best;
    }
    // Reward a close match with one of the ways people ask about this.
    let overlap = 0;
    for (const q of d.questions) {
      if (!q.size) continue;
      let hit = 0;
      for (const w of qset) if (q.has(w)) hit++;
      overlap = Math.max(overlap, hit / Math.max(q.size, qset.size));
    }
    score *= 1 + overlap * 0.8;
    // The slug names the article's topic, so a question about exactly that topic gets a nudge.
    const slugWords = d.slugWords;
    let slugHit = 0;
    for (const w of qset) if (slugWords.has(w)) slugHit++;
    score *= 1 + (0.35 * slugHit) / qset.size;
    // The page the author is on matters most when the question itself is short or vague.
    if (section && d.article.pages?.includes(section)) score *= terms.length <= 2 ? 1.4 : 1.1;
    return { article: d.article, score, confidence: Math.min(1, possible ? (score / possible) * (1 + overlap) * 0.9 : 0) };
  });
  return out.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}

/** Help Centre search: the best matches for what someone typed. */
export function searchHelp(query: string, limit = 8): HelpArticle[] {
  const r = rank(query);
  if (!r.length) return [];
  const top = r[0].score;
  return r.filter((x) => x.score >= top * 0.25).slice(0, limit).map((x) => x.article);
}

// ───────────── The assistant's replies ─────────────

export type BotReply =
  | { kind: 'answer'; article: HelpArticle; also: HelpArticle[] }
  | { kind: 'unsure'; options: HelpArticle[] }
  | { kind: 'none' }
  | { kind: 'text'; text: string; options?: HelpArticle[]; contact?: boolean };

const GREETING = /^\s*(hi+|hello+|hey+|hiya|yo|salaam|salam|assalam[ou]? ?alaikum|good (morning|afternoon|evening)|greetings)\b[\s!.,?]*$/i;
const THANKS = /^\s*(thanks?( you)?( so much| a lot)?|thank u|thx|ty|cheers|great|perfect|awesome|brilliant|cool|ok(ay)?|got it|that helped|helpful)\b[\s!.,]*$/i;
const BYE = /^\s*(bye|goodbye|see you|that'?s all|nothing else|no thanks?)\b[\s!.,]*$/i;
const WHO = /\b(who|what) are you\b|\bare you (a )?(bot|robot|human|ai|real)\b|\bis this (a )?(bot|ai)\b/i;
const HUMAN = /\b(human|real person|someone real|agent|staff|operator|contact (support|you|us|the team)|support team|speak to|talk to|email (you|support)|customer (service|support))\b/i;
const TOKENS_Q = /\b(does|do|will|is) (this|the|you|it)( help)?( (chat|assistant|bot))? (use|cost|consume|take)s? (my )?(ai )?tokens?\b/i;

/** Decide how to answer one message. */
export function reply(message: string, path?: string): BotReply {
  const m = message.trim();
  if (!m) return { kind: 'none' };
  if (GREETING.test(m)) return { kind: 'text', text: 'Hello! Ask me anything about using AI Publisher, for example “how do I make a cover?” or “how do I cancel my plan?”' };
  if (THANKS.test(m)) return { kind: 'text', text: 'You’re welcome! Ask me anything else whenever you like.' };
  if (BYE.test(m)) return { kind: 'text', text: 'Happy writing! I’m here whenever you need me.' };
  if (WHO.test(m) || TOKENS_Q.test(m))
    return {
      kind: 'text',
      text: 'I’m the AI Publisher help assistant. I answer from our help guides, so I’m instant and I never use your AI tokens. For anything I can’t answer, you can message our support team.',
    };
  if (HUMAN.test(m) && rank(m, path)[0]?.article.slug === 'contact-support')
    return { kind: 'text', text: 'Of course. Send our support team a message and they’ll get back to you.', contact: true };

  const ranked = rank(m, path);
  if (!ranked.length) return { kind: 'none' };
  const [top, second] = ranked;
  const clear = !second || top.score >= second.score * 1.25;
  if (top.confidence >= 0.42 || (top.confidence >= 0.3 && clear)) {
    const also = ranked.slice(1, 3).filter((r) => r.score >= top.score * 0.6).map((r) => r.article);
    return { kind: 'answer', article: top.article, also };
  }
  if (top.confidence >= 0.12) return { kind: 'unsure', options: ranked.slice(0, 3).map((r) => r.article) };
  return { kind: 'none' };
}
