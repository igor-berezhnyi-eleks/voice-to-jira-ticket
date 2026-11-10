import type { Ticket } from '../../api';
import { ticketSections } from '../editedTicket';

/** Jira wiki markup (Jira Server 7 has no Markdown). User text is not escaped (human decision, T4.2). */
export function renderJiraWiki(ticket: Ticket): string {
  const blocks = [`h1. ${ticket.title}\nType: ${ticket.type}`];
  for (const section of ticketSections(ticket)) {
    if (section.kind === 'text') {
      blocks.push(`h2. ${section.label}\n${section.value}`);
    } else if (section.items.length === 0) {
      blocks.push(`h2. ${section.label}\nNot provided`);
    } else {
      const marker = section.ordered ? '#' : '*';
      blocks.push(`h2. ${section.label}\n${section.items.map((item) => `${marker} ${item}`).join('\n')}`);
    }
  }
  return blocks.join('\n\n');
}
