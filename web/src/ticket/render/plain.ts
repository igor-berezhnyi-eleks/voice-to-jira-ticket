import type { Ticket } from '../../api';
import { ticketSections } from '../editedTicket';

/** Tracker-neutral text: title, type, then one block per field. Gaps print "Not provided". */
export function renderPlain(ticket: Ticket): string {
  const blocks = [`${ticket.title}\nType: ${ticket.type}`];
  for (const section of ticketSections(ticket)) {
    if (section.kind === 'text') {
      blocks.push(`${section.label}\n${section.value}`);
    } else if (section.items.length === 0) {
      blocks.push(`${section.label}\nNot provided`);
    } else {
      const lines = section.items.map((item, index) => (section.ordered ? `${index + 1}. ${item}` : `- ${item}`));
      blocks.push(`${section.label}\n${lines.join('\n')}`);
    }
  }
  return blocks.join('\n\n');
}
