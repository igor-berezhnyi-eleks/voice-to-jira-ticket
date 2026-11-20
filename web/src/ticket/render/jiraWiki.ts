import type { Ticket } from '../../api';
import { ticketLabels } from '../../i18n/ticketLabels';
import { ticketSections } from '../editedTicket';

/** Jira wiki markup (Jira Server 7 has no Markdown). User text is not escaped (human decision, T4.2). Labels and gaps are in the ticket's language. */
export function renderJiraWiki(ticket: Ticket): string {
  const labels = ticketLabels(ticket.language);
  const blocks = [`h1. ${ticket.title}\n${labels.type}: ${ticket.type}`];
  for (const section of ticketSections(ticket)) {
    if (section.kind === 'text') {
      blocks.push(`h2. ${section.label}\n${section.value}`);
    } else if (section.items.length === 0) {
      blocks.push(`h2. ${section.label}\n${labels.notProvided}`);
    } else {
      const marker = section.ordered ? '#' : '*';
      blocks.push(`h2. ${section.label}\n${section.items.map((item) => `${marker} ${item}`).join('\n')}`);
    }
  }
  return blocks.join('\n\n');
}
