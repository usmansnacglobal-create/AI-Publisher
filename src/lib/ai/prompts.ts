import { forAI } from '../text';
import type { Book, Chapter, ChapterSettings } from '../api';

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
    book.reader_outcome && `What readers should gain: ${book.reader_outcome}`,
    book.key_message && `The one key message: ${book.key_message}`,
    book.pov && `Point of view: ${book.pov}`,
    book.pacing && `Pacing: ${book.pacing}`,
    book.themes?.length && `Themes and keywords: ${book.themes.join(', ')}`,
    book.dialect && `Spelling and usage: ${book.dialect}`,
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

export const LENGTHS = { short: 650, standard: 1200, long: 2300 } as const;

export function chapterTargetWords(book: Book, s: ChapterSettings) {
  if (s.length === 'custom' && s.words) return s.words;
  if (s.length && s.length !== 'custom') return LENGTHS[s.length];
  return Math.round(book.target_words / Math.max(1, book.target_chapters));
}

/** Turns a chapter's AI controls into instructions. */
export function settingsBlock(book: Book, s: ChapterSettings) {
  const lines = [
    s.tone && `Tone: ${s.tone}.`,
    s.formality && `Formality: ${s.formality}.`,
    s.sentences && `Sentences: ${{ short: 'mostly short and punchy', varied: 'a natural mix of short and long', long: 'long and flowing' }[s.sentences]}.`,
    s.style && `Style: ${s.style}.`,
    s.instructions && `Special instructions from the author: ${s.instructions}`,
    s.includeSummary && 'End with a short "Chapter summary" section of 3–5 bullet points, under a "## Chapter summary" heading.',
    s.includeReflection && 'Finish with a short "## Reflection" section: 2–3 questions or a call to action for the reader.',
  ].filter(Boolean);
  let out = lines.length ? `\n\n<chapter_controls>\n${lines.join('\n')}\n</chapter_controls>` : '';
  if (s.useSample && book.writing_sample?.trim()) {
    out += `\n\n<author_writing_sample>\n${book.writing_sample.slice(0, 6000)}\n</author_writing_sample>\nMatch the voice, rhythm and vocabulary of this sample closely. Do not reuse its content.`;
  }
  return out;
}

export function chapterPrompt(book: Book, chapter: Chapter, all: Chapter[], bible: BibleEntry[]) {
  const outline = all
    .map((c) => `${c.position}. ${c.title}${c.synopsis ? ` — ${c.synopsis}` : ''}`)
    .join('\n');
  const prev = all.find((c) => c.position === chapter.position - 1);
  const prevTail = prev?.content ? forAI(prev.content).slice(-2500) : '';
  const s = chapter.settings ?? {};
  const perChapter = chapterTargetWords(book, s);
  const mode = s.mode ?? 'full';
  const task =
    mode === 'assist'
      ? `Write a working draft of chapter ${chapter.position}, "${chapter.title}"${chapter.synopsis ? `, covering: ${chapter.synopsis}` : ''}, of about ${Math.round(perChapter * 0.6).toLocaleString('en-GB')} words, for the author to finish. Write the connecting prose fully, and wherever the author's own memories, examples, research or opinions belong, leave a clear placeholder in square brackets, e.g. [Add your story about …]. Start directly with the prose.`
      : `Write chapter ${chapter.position}, "${chapter.title}"${chapter.synopsis ? `, covering: ${chapter.synopsis}` : ''}.
Aim for about ${perChapter.toLocaleString('en-GB')} words. Continue naturally from the previous chapter, and don't repeat its content.
Start directly with the prose (no chapter heading).`;
  return `${bookBrief(book)}${bibleBlock(bible)}${settingsBlock(book, s)}

<outline>
${outline}
</outline>
${prevTail ? `\n<end_of_previous_chapter>\n${prevTail}\n</end_of_previous_chapter>\n` : ''}
${task}
You may use Markdown for emphasis (*italic*, **bold**), "## " subheadings, lists and "> " quotes where they suit the book.`;
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
export const EDIT_ACTIONS: Record<string, { label: string; instruction: string; group: 'quick' | 'deep' | 'selection' }> = {
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
  formal: {
    label: 'Make the tone more formal',
    group: 'deep',
    instruction: 'Make the tone more formal throughout, sentence by sentence, without changing meaning. Up to 25 suggestions.',
  },
  simplify: {
    label: 'Simplify the language',
    group: 'deep',
    instruction: 'Simplify the language for easier reading: shorter sentences, plainer words. Up to 25 suggestions.',
  },
  vivid: {
    label: 'More vivid and descriptive',
    group: 'deep',
    instruction: 'Make the writing more vivid: concrete sensory detail, stronger verbs, fresher images. Up to 15 suggestions.',
  },
  grammar_all: {
    label: 'Fix grammar everywhere',
    group: 'deep',
    instruction: 'Fix every spelling, grammar and punctuation error in the chapter. Do not change style. One suggestion per error-containing sentence, no limit.',
  },
  sel_improve: {
    label: 'Improve',
    group: 'selection',
    instruction: 'Improve the selected passage: clarity, rhythm and word choice, keeping the author’s voice. One suggestion; the original must be the selected passage exactly.',
  },
  sel_shorten: {
    label: 'Shorten',
    group: 'selection',
    instruction: 'Shorten the selected passage by about a third without losing meaning. One suggestion; the original must be the selected passage exactly.',
  },
  sel_expand: {
    label: 'Expand',
    group: 'selection',
    instruction: 'Expand the selected passage with more detail, description or explanation, roughly doubling it. One suggestion; the original must be the selected passage exactly.',
  },
  sel_rephrase: {
    label: 'Rephrase',
    group: 'selection',
    instruction: 'Rephrase the selected passage in fresh words with the same meaning and length. One suggestion; the original must be the selected passage exactly.',
  },
  sel_fix: {
    label: 'Fix grammar',
    group: 'selection',
    instruction: 'Fix spelling, grammar and punctuation in the selected passage only. One suggestion; the original must be the selected passage exactly. If there are no errors, return no suggestions.',
  },
  show_dont_tell: {
    label: 'Show, don’t tell',
    group: 'deep',
    instruction: 'Find places that tell emotions or facts flatly and suggest versions that show them through action, detail or dialogue. Up to 10.',
  },
};
