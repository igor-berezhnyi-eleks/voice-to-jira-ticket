import type { Ticket } from '../../api';
import { ticketLabels } from '../../i18n/ticketLabels';
import { ticketSections } from '../editedTicket';

/** Tracker-neutral text: title, type, then one block per field. Labels and gaps are in the ticket's language. */
export function renderPlain(ticket: Ticket): string {
  const labels = ticketLabels(ticket.language);
  const blocks = [`${ticket.title}\n${labels.type}: ${ticket.type}`];
  for (const section of ticketSections(ticket)) {
    if (section.kind === 'text') {
      blocks.push(`${section.label}\n${section.value}`);
    } else if (section.items.length === 0) {
      blocks.push(`${section.label}\n${labels.notProvided}`);
    } else {
      const lines = section.items.map((item, index) => (section.ordered ? `${index + 1}. ${item}` : `- ${item}`));
      blocks.push(`${section.label}\n${lines.join('\n')}`);
    }
  }
  return blocks.join('\n\n');
}
