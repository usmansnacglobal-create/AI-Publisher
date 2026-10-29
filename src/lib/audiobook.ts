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

/** The narrator a book is set to use. */
export interface NarratorSettings {
  engine: 'basic' | 'premium';
  voice: string;
  premium_voice_id: string | null;
  quality: 'turbo' | 'standard';
}

/** A narrated chapter as stored. Older tracks (before premium voices) have no engine or quality. */
export interface StoredTrack {
  generated_at: string;
  voice: string;
  engine?: 'basic' | 'premium';
  quality?: 'turbo' | 'standard';
}

/** True when the chapter changed, or the narrator or quality differs from the book's current choice. */
export function isTrackOutdated(t: StoredTrack, chapterUpdatedAt: string, s: NarratorSettings) {
  if (new Date(chapterUpdatedAt) > new Date(t.generated_at)) return true;
  const engine = t.engine ?? 'basic';
  if (engine !== s.engine) return true;
  if (engine === 'basic') return t.voice !== s.voice;
  return t.voice !== s.premium_voice_id || (t.quality ?? 'turbo') !== s.quality;
}

/** How the narrator is described to authors and the publishing team. */
export function narratorLabel(ab: { engine?: string | null; voice?: string | null; premium_voice_name?: string | null; quality?: string | null } | null) {
  if (!ab) return null;
  if (ab.engine === 'premium') return ab.premium_voice_name ? `${ab.premium_voice_name} (premium, ${ab.quality === 'standard' ? 'Standard' : 'Turbo'})`.slice(0, 60) : null;
  return ab.voice ? VOICES[ab.voice as VoiceId]?.label ?? ab.voice : null;
}
