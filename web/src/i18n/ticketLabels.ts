import { en, type Dictionary } from './en';
import { uk } from './uk';

export type TicketLabels = Dictionary['ticketLabels'];

const byLanguage: Record<string, TicketLabels> = { en: en.ticketLabels, uk: uk.ticketLabels };

/** The labels a ticket is rendered with: those of `ticket.language`, or English when that code has no dictionary. */
export function ticketLabels(language: string): TicketLabels {
  return Object.hasOwn(byLanguage, language) ? byLanguage[language] : en.ticketLabels;
}
