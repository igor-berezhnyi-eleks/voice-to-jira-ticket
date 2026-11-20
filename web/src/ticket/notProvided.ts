import type { TicketLabels } from '../i18n/ticketLabels';

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

/** What a gap looks like to the reader: the ticket language's phrase for blank text or the contract marker. Display only. */
export function displayGap(value: string, labels: TicketLabels): string {
  return isNotProvided(value) ? labels.notProvided : value;
}

/** The reverse for text typed in an input: the ticket language's phrase on its own is the contract marker again. */
export function storeGap(value: string, labels: TicketLabels): string {
  return value.trim() === labels.notProvided ? NOT_PROVIDED : value;
}
