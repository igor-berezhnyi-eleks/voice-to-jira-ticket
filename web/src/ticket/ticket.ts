import type { GeneratedTicket, TicketType } from '../api/tickets'

// Field order, readable labels and required flags follow the output contract in CLAUDE.md.
export interface FieldDef {
  key: string
  label: string
  kind: 'text' | 'multiline' | 'list'
  required: boolean
}

export const FIELDS: Record<TicketType, FieldDef[]> = {
  Bug: [
    { key: 'title', label: 'Title', kind: 'text', required: true },
    { key: 'description', label: 'Description', kind: 'multiline', required: true },
    { key: 'stepsToReproduce', label: 'Steps to reproduce', kind: 'list', required: false },
    { key: 'actualResult', label: 'Actual result', kind: 'multiline', required: false },
    { key: 'expectedResult', label: 'Expected result', kind: 'multiline', required: false },
    { key: 'environment', label: 'Environment / platform', kind: 'multiline', required: false },
  ],
  Feature: [
    { key: 'title', label: 'Title', kind: 'text', required: true },
    { key: 'description', label: 'Description', kind: 'multiline', required: true },
    { key: 'userOrBusinessNeed', label: 'User or business need', kind: 'multiline', required: false },
    { key: 'acceptanceCriteria', label: 'Acceptance criteria', kind: 'list', required: true },
  ],
}

// The editable form state: all fields of one ticket type, without missingInformation (always derived).
export type TicketFields = Record<string, string | string[]>

export interface EditableTicket {
  type: TicketType
  fields: TicketFields
}

export function fromGenerated(ticket: GeneratedTicket): EditableTicket {
  const fields: TicketFields = {}
  for (const field of FIELDS[ticket.type]) {
    const value = (ticket as unknown as Record<string, unknown>)[field.key]
    fields[field.key] = field.kind === 'list' ? (Array.isArray(value) ? value.map(String) : []) : String(value ?? '')
  }
  return { type: ticket.type, fields }
}

// List items are edited one per line; blank lines are kept while editing and dropped here.
export function listValue(value: string | string[] | undefined): string[] {
  return (Array.isArray(value) ? value : []).map((item) => item.trim()).filter((item) => item.length > 0)
}

function textValue(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isEmpty(ticket: EditableTicket, field: FieldDef): boolean {
  const value = ticket.fields[field.key]
  return field.kind === 'list' ? listValue(value).length === 0 : textValue(value).length === 0
}

// Same rule as the API's TicketValidator: every empty field is listed by its name.
export function missingInformation(ticket: EditableTicket): string[] {
  return FIELDS[ticket.type].filter((field) => isEmpty(ticket, field)).map((field) => field.key)
}

export function missingRequired(ticket: EditableTicket): FieldDef[] {
  return FIELDS[ticket.type].filter((field) => field.required && isEmpty(ticket, field))
}

export function fieldLabel(type: TicketType, key: string): string {
  return FIELDS[type].find((field) => field.key === key)?.label ?? key
}

// The ticket in the API's flat JSON shape (type first, trimmed, missingInformation recomputed).
export function toGenerated(ticket: EditableTicket): GeneratedTicket {
  const body: Record<string, string | string[]> = { type: ticket.type }
  for (const field of FIELDS[ticket.type]) {
    const value = ticket.fields[field.key]
    body[field.key] = field.kind === 'list' ? listValue(value) : textValue(value)
  }
  body.missingInformation = missingInformation(ticket)
  return body as unknown as GeneratedTicket
}

// feature-ticket_DD.MM.YY_HH.MM.json, in local time.
export function ticketFileName(type: TicketType, at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${pad(at.getDate())}.${pad(at.getMonth() + 1)}.${pad(at.getFullYear() % 100)}`
  return `${type.toLowerCase()}-ticket_${date}_${pad(at.getHours())}.${pad(at.getMinutes())}.json`
}

// Jira 7.x wiki markup for the description. The title is the issue summary, so it is not repeated here.
// Empty optional sections are left out; Missing information lists them instead.
export function toWikiMarkup(ticket: EditableTicket): string {
  const sections: string[] = []
  for (const field of FIELDS[ticket.type]) {
    if (field.key === 'title' || isEmpty(ticket, field)) {
      continue
    }
    const value = ticket.fields[field.key]
    const body =
      field.kind === 'list'
        ? listValue(value)
            .map((item) => `${field.key === 'stepsToReproduce' ? '#' : '*'} ${escapeWiki(item)}`)
            .join('\n')
        : escapeWiki(textValue(value))
    sections.push(field.key === 'description' ? body : `h3. ${field.label}\n${body}`)
  }

  const missing = missingInformation(ticket)
  if (missing.length > 0) {
    sections.push(`h3. Missing information\n${missing.map((key) => `* ${fieldLabel(ticket.type, key)}`).join('\n')}`)
  }
  return sections.join('\n\n')
}

// Braces and brackets start macros and links in Jira wiki markup; escape them so user text stays literal.
function escapeWiki(text: string): string {
  return text.replace(/([{}[\]])/g, '\\$1')
}
