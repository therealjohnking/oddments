/**
 * Deck normalization and validation.
 *
 * A "deck" reaches us either as the built-in {@link DEFAULT_PHRASES} or as a
 * block of text the user typed into the deck editor — one phrase per line. Both
 * go through the same door: trim each line, drop the blanks, collapse runs of
 * inner whitespace, and remove duplicates. Then we can say plainly whether what
 * is left is enough to deal a card.
 *
 * De-duplication is case- and whitespace-insensitive (`Circle Back`, `circle
 * back`, and `circle   back` are the same phrase), because two squares that read
 * identically would look like a bug on a card. The first spelling a phrase
 * appears in is the one kept, so the user's own capitalization is preserved.
 */

import { DEFAULT_PHRASES } from './default-phrases';
import { MIN_DECK_SIZE, type DeckValidation } from './types';

/** Collapse internal whitespace runs and trim the ends of a single phrase. */
export function normalizePhrase(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * The fold key two phrases share when they should count as duplicates.
 * Uses locale-independent `toLowerCase()` (Unicode default case folding) rather
 * than `toLocaleLowerCase()`, so de-duplication is deterministic across users —
 * otherwise the same deck could yield a different unique count in, say, a Turkish
 * locale (where an ASCII `I` folds to a dotless `ı`).
 */
function dedupeKey(phrase: string): string {
  return phrase.toLowerCase();
}

/**
 * Turn raw phrase text (one per line) into a clean, de-duplicated list.
 * Blank lines are ignored; surrounding and internal whitespace is normalized;
 * the first spelling of each phrase wins. The returned list preserves input
 * order.
 */
export function normalizeDeck(raw: string): string[] {
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const line of raw.split(/\r\n|\r|\n/)) {
    const phrase = normalizePhrase(line);
    if (phrase === '') continue;
    const key = dedupeKey(phrase);
    if (seen.has(key)) continue;
    seen.add(key);
    phrases.push(phrase);
  }
  return phrases;
}

/**
 * Normalize a raw deck and report whether it can deal a card. `phrases` always
 * holds the usable, de-duplicated subset — even when the deck is too small — so
 * the editor can show what it understood while explaining what is missing.
 */
export function validateDeck(raw: string): DeckValidation {
  // `rawCount` counts non-empty phrases before de-duplication, so the message can
  // distinguish "you only wrote 10 lines" from "you wrote 30, but 8 were repeats".
  let rawCount = 0;
  for (const line of raw.split(/\r\n|\r|\n/)) {
    if (normalizePhrase(line) !== '') rawCount++;
  }

  const phrases = normalizeDeck(raw);
  const uniqueCount = phrases.length;

  let error: string | null = null;
  if (uniqueCount < MIN_DECK_SIZE) {
    const short = MIN_DECK_SIZE - uniqueCount;
    const dupeNote =
      rawCount > uniqueCount
        ? ` (${rawCount - uniqueCount} duplicate ${rawCount - uniqueCount === 1 ? 'line was' : 'lines were'} ignored)`
        : '';
    error =
      `A card needs ${MIN_DECK_SIZE} different phrases — this deck has ${uniqueCount}${dupeNote}. ` +
      `Add ${short} more.`;
  }

  return { ok: error === null, phrases, uniqueCount, rawCount, error };
}

/** The default deck as a single validation result (always valid). */
export function defaultDeck(): DeckValidation {
  return validateDeck(DEFAULT_PHRASES.join('\n'));
}

/** The default phrases rendered back as editor text (one per line). */
export function defaultDeckText(): string {
  return DEFAULT_PHRASES.join('\n');
}
