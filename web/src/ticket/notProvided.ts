/** The text the contract uses for a detail the speaker did not give. */
export const NOT_PROVIDED = 'Not provided';

/**
 * True when a field holds no real content: text that is blank or exactly "Not provided",
 * or a list with no item that has text. Close variants such as "Not provided." are real text.
 */
export function isNotProvided(value: string | readonly string[]): boolean {
  if (typeof value === 'string') {
    const text = value.trim();
    return text === '' || text === NOT_PROVIDED;
  }
  return value.every((item) => item.trim() === '');
}
