/**
 * Finds `original` in `text` and replaces it. Tries an exact match first, then
 * a match that ignores differences in whitespace and curly/straight quotes,
 * because AI models sometimes normalise these when quoting.
 */
export function applyReplacement(text: string, original: string, replacement: string): string | null {
  const idx = text.indexOf(original);
  if (idx !== -1) return text.slice(0, idx) + replacement + text.slice(idx + original.length);
  const range = fuzzyFind(text, original);
  if (!range) return null;
  return text.slice(0, range[0]) + replacement + text.slice(range[1]);
}

export function locate(text: string, original: string): [number, number] | null {
  const idx = text.indexOf(original);
  if (idx !== -1) return [idx, idx + original.length];
  return fuzzyFind(text, original);
}

const norm = (c: string) =>
  c === '‘' || c === '’' ? "'" : c === '“' || c === '”' ? '"' : c === '—' || c === '–' ? '-' : c;

function fuzzyFind(text: string, needle: string): [number, number] | null {
  // Build a normalised copy of the text with a map back to original offsets.
  const map: number[] = [];
  let flat = '';
  let lastSpace = false;
  for (let i = 0; i < text.length; i++) {
    const ch = norm(text[i]);
    if (/\s/.test(ch)) {
      if (lastSpace) continue;
      flat += ' ';
      map.push(i);
      lastSpace = true;
    } else {
      flat += ch;
      map.push(i);
      lastSpace = false;
    }
  }
  const n = needle.split('').map(norm).join('').replace(/\s+/g, ' ').trim();
  if (!n) return null;
  const at = flat.indexOf(n);
  if (at === -1) return null;
  return [map[at], map[at + n.length - 1] + 1];
}
