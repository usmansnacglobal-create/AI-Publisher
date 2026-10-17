import type { Book, Chapter } from '../api';

export interface BibleEntry {
  kind: string;
  name: string;
  details: string;
}

export function bookBrief(book: Book) {
  return [
    `Title: ${book.title}${book.subtitle ? ` — ${book.subtitle}` : ''}`,
    `Type: ${book.book_type === 'fiction' ? 'Fiction' : 'Non-fiction'}`,
    book.genre && `Genre: ${book.genre}`,
    book.audience && `Audience: ${book.audience}`,
    book.style && `Style: ${book.style}`,
    book.tone && `Tone: ${book.tone}`,
    book.summary && `Summary: ${book.summary}`,
    `Target length: about ${book.target_words.toLocaleString('en-GB')} words in ${book.target_chapters} chapters`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function bibleBlock(entries: BibleEntry[]) {
  if (!entries.length) return '';
  return (
    '\n\n<story_bible>\n' +
    entries.map((e) => `- [${e.kind}] ${e.name}: ${e.details}`).join('\n') +
    '\n</story_bible>'
  );
}

export const WRITER_SYSTEM = `You are a skilled ghostwriter and book editor working inside a publishing app for authors.
Write in polished, publishable prose that fits the book's genre, audience, style and tone.
Follow the author's brief and story bible exactly; never contradict established facts.
For non-fiction about real people or events, stay factually accurate and do not invent quotes, statistics or private details; write around gaps rather than fabricating.
Output only the requested text: no preambles, notes or explanations, and no Markdown headings unless asked.`;

export const EDITOR_SYSTEM = `You are a meticulous professional book editor. You suggest precise, minimal edits that improve the text while preserving the author's voice.
Every suggestion must quote the original text exactly, character for character, so it can be found and replaced.`;

export function chapterPrompt(book: Book, chapter: Chapter, all: Chapter[], bible: BibleEntry[]) {
  const outline = all
    .map((c) => `${c.position}. ${c.title}${c.synopsis ? ` — ${c.synopsis}` : ''}`)
    .join('\n');
  const prev = all.find((c) => c.position === chapter.position - 1);
  const prevTail = prev?.content ? prev.content.slice(-2500) : '';
  const perChapter = Math.round(book.target_words / Math.max(1, book.target_chapters));
  return `${bookBrief(book)}${bibleBlock(bible)}

<outline>
${outline}
</outline>
${prevTail ? `\n<end_of_previous_chapter>\n${prevTail}\n</end_of_previous_chapter>\n` : ''}
Write chapter ${chapter.position}, "${chapter.title}"${chapter.synopsis ? `, covering: ${chapter.synopsis}` : ''}.
Aim for about ${perChapter.toLocaleString('en-GB')} words. Continue naturally from the previous chapter, and don't repeat its content.
Start directly with the prose (no chapter heading).`;
}

export const OUTLINE_SCHEMA = {
  type: 'object',
  properties: {
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Chapter title, without "Chapter N"' },
          synopsis: { type: 'string', description: '2–3 sentences on what happens or is covered' },
        },
        required: ['title', 'synopsis'],
      },
    },
  },
  required: ['chapters'],
};

export const SUGGESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          original: { type: 'string', description: 'Exact text copied from the chapter (a phrase, sentence or paragraph)' },
          replacement: { type: 'string', description: 'The improved text' },
          reason: { type: 'string', description: 'One short sentence explaining the change' },
        },
        required: ['original', 'replacement', 'reason'],
      },
    },
  },
  required: ['suggestions'],
};

/** Quick actions and deep edits, all returned as tracked-change suggestions. */
export const EDIT_ACTIONS: Record<string, { label: string; instruction: string; group: 'quick' | 'deep' }> = {
  improve_last: {
    label: 'Improve the last paragraph',
    group: 'quick',
    instruction: 'Suggest one improved version of the final paragraph only.',
  },
  grammar: {
    label: 'Fix grammar and spelling',
    group: 'quick',
    instruction: 'Fix spelling, grammar and punctuation errors only. Do not change style. One suggestion per error-containing sentence.',
  },
  hook: {
    label: 'Strengthen the opening hook',
    group: 'quick',
    instruction: 'Rewrite the first paragraph so it hooks the reader more strongly. One suggestion.',
  },
  ending: {
    label: 'Strengthen the chapter ending',
    group: 'quick',
    instruction: 'Rewrite the final paragraph so the chapter ends with more pull into the next one. One suggestion.',
  },
  expand: {
    label: 'Expand the selected passage',
    group: 'quick',
    instruction: 'Expand the selected passage with more detail, sensory description or explanation, roughly doubling it. The original must be the selected passage exactly.',
  },
  shorten: {
    label: 'Tighten the selected passage',
    group: 'quick',
    instruction: 'Tighten the selected passage, cutting about a third of the words without losing meaning. The original must be the selected passage exactly.',
  },
  line_edit: {
    label: 'Line edit',
    group: 'deep',
    instruction: 'Do a line edit: clarity, rhythm, word choice, repetition, weak verbs, clichés. Suggest sentence-level changes (up to 25).',
  },
  paragraph_edit: {
    label: 'Paragraph edit',
    group: 'deep',
    instruction: 'Do a paragraph-level edit: flow, pacing, transitions and structure. Suggest whole-paragraph rewrites where they help most (up to 10).',
  },
  dialogue: {
    label: 'Polish dialogue',
    group: 'deep',
    instruction: 'Improve dialogue: make it natural, distinct per character, with tidy dialogue tags. Up to 15 suggestions.',
  },
  show_dont_tell: {
    label: 'Show, don’t tell',
    group: 'deep',
    instruction: 'Find places that tell emotions or facts flatly and suggest versions that show them through action, detail or dialogue. Up to 10.',
  },
};
