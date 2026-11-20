import type { Ticket } from '../api';
import { ticketLabels, type TicketLabels } from '../i18n/ticketLabels';
import { isFieldOf, type FieldPath } from './fieldPaths';
import { isNotProvided, NOT_PROVIDED } from './notProvided';

type TicketType = Ticket['type'];

/**
 * Turns an edited ticket (the read-out from `editedTicket`) into the other type in the browser, without a model call (decision D16).
 * Expected result and proposed behavior swap places. Details with no counterpart are not thrown away: where they have content,
 * they are appended to the description as labelled lines. Questions about fields of the other type are dropped.
 */
export function convertTicket(ticket: Ticket, to: TicketType): Ticket {
  if (ticket.type === to) return structuredClone(ticket);

  const labels = ticketLabels(ticket.language);
  const missingInformation = ticket.missingInformation.filter((item) => item.field === null || isFieldOf(to, item.field));

  if (to === 'Feature') {
    const bug = ticket.bug;
    return {
      type: 'Feature',
      language: ticket.language,
      title: ticket.title,
      description: withExtras(ticket.description, [
        listLine(labels, 'bug.stepsToReproduce', bug?.stepsToReproduce ?? [], true),
        textLine(labels, 'bug.actualResult', bug?.actualResult ?? ''),
        textLine(labels, 'bug.environment', bug?.environment ?? ''),
      ]),
      bug: null,
      feature: {
        userNeed: NOT_PROVIDED,
        proposedBehavior: bug?.expectedResult ?? NOT_PROVIDED,
        acceptanceCriteria: [],
      },
      missingInformation,
    };
  }

  const feature = ticket.feature;
  return {
    type: 'Bug',
    language: ticket.language,
    title: ticket.title,
    description: withExtras(ticket.description, [
      textLine(labels, 'feature.userNeed', feature?.userNeed ?? ''),
      listLine(labels, 'feature.acceptanceCriteria', feature?.acceptanceCriteria ?? [], false),
    ]),
    bug: {
      stepsToReproduce: [],
      actualResult: NOT_PROVIDED,
      expectedResult: feature?.proposedBehavior ?? NOT_PROVIDED,
      environment: NOT_PROVIDED,
    },
    feature: null,
    missingInformation,
  };
}

function textLine(labels: TicketLabels, path: FieldPath, value: string): string | null {
  return isNotProvided(value) ? null : `${labels.fields[path]}: ${value.trim()}`;
}

function listLine(labels: TicketLabels, path: FieldPath, items: readonly string[], ordered: boolean): string | null {
  const real = items.map((item) => item.trim()).filter((item) => item !== '');
  if (real.length === 0) return null;
  return `${labels.fields[path]}:\n${real.map((item, index) => (ordered ? `${index + 1}. ${item}` : `- ${item}`)).join('\n')}`;
}

function withExtras(description: string, extras: (string | null)[]): string {
  const lines = extras.filter((line): line is string => line !== null);
  if (lines.length === 0) return description;
  const extra = lines.join('\n');
  return isNotProvided(description) ? extra : `${description}\n\n${extra}`;
}
