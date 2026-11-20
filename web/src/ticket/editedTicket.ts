import type { Ticket } from '../api';
import { ticketLabels } from '../i18n/ticketLabels';
import type { FieldPath } from './fieldPaths';
import { displayGap, NOT_PROVIDED, storeGap } from './notProvided';

/** One field of a ticket as the renderers print it, after the title. Lists are ordered for steps, bulleted otherwise. */
export type Section =
  | { label: string; kind: 'text'; value: string }
  | { label: string; kind: 'list'; ordered: boolean; items: string[] };

/** The description and the type's fields in display order. Labels and gaps are in the ticket's language (English for a code with no dictionary). */
export function ticketSections(ticket: Ticket): Section[] {
  const labels = ticketLabels(ticket.language);
  const text = (path: FieldPath, value: string): Section => ({
    label: labels.fields[path],
    kind: 'text',
    value: displayGap(value, labels),
  });
  const list = (path: FieldPath, ordered: boolean, items: string[]): Section => ({
    label: labels.fields[path],
    kind: 'list',
    ordered,
    items,
  });

  const sections = [text('description', ticket.description)];
  if (ticket.type === 'Bug' && ticket.bug) {
    sections.push(
      list('bug.stepsToReproduce', true, ticket.bug.stepsToReproduce),
      text('bug.actualResult', ticket.bug.actualResult),
      text('bug.expectedResult', ticket.bug.expectedResult),
      text('bug.environment', ticket.bug.environment),
    );
  } else if (ticket.type === 'Feature' && ticket.feature) {
    sections.push(
      text('feature.userNeed', ticket.feature.userNeed),
      text('feature.proposedBehavior', ticket.feature.proposedBehavior),
      list('feature.acceptanceCriteria', false, ticket.feature.acceptanceCriteria),
    );
  }
  return sections;
}

type Texts =Partial<Record<FieldPath, string>>;
/** Rows only need their text here, so a page row with a client id fits without the id being read. */
type Lists = Partial<Record<FieldPath, readonly { text: string }[]>>;

/**
 * Reads the edited ticket out in contract shape: text is trimmed and a blank, or the ticket language's gap phrase on its own, becomes exactly
 * "Not provided" (contract rule 3), blank list items are dropped (rule 5), and nothing client-side
 * (row ids) is carried over. The generator's missing-information list is kept as received.
 */
export function editedTicket(base: Ticket, texts: Texts, lists: Lists): Ticket {
  const labels = ticketLabels(base.language);
  const text = (path: FieldPath): string => {
    const value = storeGap((texts[path] ?? '').trim(), labels);
    return value === '' ? NOT_PROVIDED : value;
  };
  const list = (path: FieldPath): string[] =>
    (lists[path] ?? []).map((row) => row.text.trim()).filter((item) => item !== '');

  return {
    type: base.type,
    language: base.language,
    title: text('title'),
    description: text('description'),
    bug:
      base.type === 'Bug'
        ? {
            stepsToReproduce: list('bug.stepsToReproduce'),
            actualResult: text('bug.actualResult'),
            expectedResult: text('bug.expectedResult'),
            environment: text('bug.environment'),
          }
        : base.bug,
    feature:
      base.type === 'Feature'
        ? {
            userNeed: text('feature.userNeed'),
            proposedBehavior: text('feature.proposedBehavior'),
            acceptanceCriteria: list('feature.acceptanceCriteria'),
          }
        : base.feature,
    missingInformation: base.missingInformation,
  };
}
