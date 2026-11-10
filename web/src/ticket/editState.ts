import type { Ticket } from '../api';

/**
 * True when the ticket the user has now differs from the one the page started with. Both must come
 * from `editedTicket`, so whitespace-only changes, blank list rows and a field typed back to its
 * original text are not edits: it compares what Copy would write, not raw state.
 */
export function hasEdits(original: Ticket, current: Ticket): boolean {
  return JSON.stringify(original) !== JSON.stringify(current);
}
