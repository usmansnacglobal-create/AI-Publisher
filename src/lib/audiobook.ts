export const VOICES = {
  american_male: { label: 'American male (formal)', note: 'Clear, authoritative tone suited to non-fiction', voice: 'onyx', instructions: 'Narrate an audiobook in a clear, authoritative American English accent. Measured pace, warm but formal, crisp consonants, natural pauses at commas and full stops.' },
  american_female: { label: 'American female (warm)', note: 'Engaging and approachable, great for self-help', voice: 'coral', instructions: 'Narrate an audiobook in a warm, engaging American English accent. Friendly and encouraging, unhurried, natural pauses.' },
  british_male: { label: 'British male', note: 'Distinguished accent, ideal for literary fiction', voice: 'fable', instructions: 'Narrate an audiobook in a refined British English (Received Pronunciation) accent. Distinguished, expressive, measured pace with natural pauses.' },
  british_female: { label: 'British female', note: 'Elegant and expressive; suits most genres', voice: 'sage', instructions: 'Narrate an audiobook in an elegant British English accent. Expressive and clear, unhurried, with natural pauses.' },
  neutral: { label: 'Neutral', note: 'Accent-neutral; works for any genre', voice: 'alloy', instructions: 'Narrate an audiobook in a neutral, clear English accent. Even pace and natural pauses.' },
} as const;
export type VoiceId = keyof typeof VOICES;

/** Splits text into pieces under `max` characters, at paragraph, then sentence, boundaries. */
export function chunkText(text: string, max = 3800): string[] {
  const out: string[] = [];
  let buf = '';
  const push = () => {
    if (buf.trim()) out.push(buf.trim());
    buf = '';
  };
  for (const para of text.split(/\n\s*\n/)) {
    if ((buf + '\n\n' + para).length <= max) {
      buf = buf ? `${buf}\n\n${para}` : para;
      continue;
    }
    push();
    if (para.length <= max) {
      buf = para;
      continue;
    }
    for (const sentence of para.match(/[^.!?]+[.!?]+["”’)]*\s*|.+$/g) ?? [para]) {
      if ((buf + sentence).length > max) push();
      if (sentence.length > max) {
        for (let i = 0; i < sentence.length; i += max) out.push(sentence.slice(i, i + max));
      } else buf += sentence;
    }
  }
  push();
  return out;
}

/** Minutes of audio for some text at a typical narration pace. */
export function estimateMinutes(chars: number) {
  return Math.max(1, Math.round(chars / 5.5 / 155));
}
