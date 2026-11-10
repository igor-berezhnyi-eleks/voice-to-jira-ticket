import type { Ticket } from '../api';
import type { FieldPath } from './fieldPaths';

const NOT_PROVIDED = 'Not provided';

/** One field of a ticket as the renderers print it, after the title. Lists are ordered for steps, bulleted otherwise. */
export type Section =
  | { label: string; kind: 'text'; value: string }
  | { label: string; kind: 'list'; ordered: boolean; items: string[] };

/** The description and the type's fields in display order, with gaps normalised to "Not provided". */
export function ticketSections(ticket: Ticket): Section[] {
  const text = (label: string, value: string): Section => ({
    label,
    kind: 'text',
    value: value.trim() === '' ? NOT_PROVIDED : value,
  });
  const list = (label: string, ordered: boolean, items: string[]): Section => ({ label, kind: 'list', ordered, items });

  const sections = [text('Description', ticket.description)];
  if (ticket.type === 'Bug' && ticket.bug) {
    sections.push(
      list('Steps to reproduce', true, ticket.bug.stepsToReproduce),
      text('Actual result', ticket.bug.actualResult),
      text('Expected result', ticket.bug.expectedResult),
      text('Environment / platform', ticket.bug.environment),
    );
  } else if (ticket.type === 'Feature' && ticket.feature) {
    sections.push(
      text('User or business need', ticket.feature.userNeed),
      text('Proposed behavior', ticket.feature.proposedBehavior),
      list('Acceptance criteria', false, ticket.feature.acceptanceCriteria),
    );
  }
  return sections;
}

type Texts =Partial<Record<FieldPath, string>>;
/** Rows only need their text here, so a page row with a client id fits without the id being read. */
type Lists = Partial<Record<FieldPath, readonly { text: string }[]>>;

/**
 * Reads the edited ticket out in contract shape: text is trimmed and a blank becomes exactly
 * "Not provided" (contract rule 3), blank list items are dropped (rule 5), and nothing client-side
 * (row ids) is carried over. The generator's missing-information list is kept as received.
 */
export function editedTicket(base: Ticket, texts: Texts, lists: Lists): Ticket {
  const text = (path: FieldPath): string => {
    const value = (texts[path] ?? '').trim();
    return value === '' ? NOT_PROVIDED : value;
  };
  const list = (path: FieldPath): string[] =>
    (lists[path] ?? []).map((row) => row.text.trim()).filter((item) => item !== '');

  return {
    type: base.type,
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
