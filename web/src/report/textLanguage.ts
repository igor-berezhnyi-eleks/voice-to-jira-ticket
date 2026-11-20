/** How many leading characters decide whether a text counts as Ukrainian. */
export const cyrillicProbeLength = 50;

/**
 * A deliberately simple guess: a text whose first 50 characters (fewer when the text is shorter) contain any
 * Cyrillic letter is taken to be Ukrainian; anything else is taken to be English.
 */
export function looksCyrillic(text: string): boolean {
  return /\p{Script=Cyrillic}/u.test(text.slice(0, cyrillicProbeLength));
}
