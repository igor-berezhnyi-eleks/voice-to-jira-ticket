import { describe, expect, it } from 'vitest'
import type { GeneratedTicket } from '../api/tickets'
import {
  FIELDS,
  acceptSuggestion,
  changeType,
  fromGenerated,
  missingInformation,
  missingRequired,
  pendingSuggestion,
  ticketFileName,
  toGenerated,
  toWikiMarkup,
} from './ticket'

const bug: GeneratedTicket = {
  type: 'Bug',
  title: 'Export fails',
  description: 'CSV export shows an error.',
  stepsToReproduce: ['Open reports', 'Click Export'],
  actualResult: 'Error toast',
  expectedResult: '',
  environment: '',
  missingInformation: ['expectedResult', 'environment'],
  suggestions: { environment: 'Chrome on Windows', expectedResult: 'The CSV file downloads' },
}

const feature: GeneratedTicket = {
  type: 'Feature',
  title: 'Dark mode',
  description: 'Add a dark theme.',
  userOrBusinessNeed: '',
  acceptanceCriteria: [],
  missingInformation: ['userOrBusinessNeed', 'acceptanceCriteria'],
  suggestions: { userOrBusinessNeed: 'Reduces eye strain at night' },
}

describe('ticket form', () => {
  it('derives missing information from the empty fields, including whitespace and blank list lines', () => {
    const ticket = fromGenerated(bug)
    ticket.fields.actualResult = '   '
    ticket.fields.stepsToReproduce = ['', '  ']

    expect(missingInformation(ticket)).toEqual(['stepsToReproduce', 'actualResult', 'expectedResult', 'environment'])
  })

  it('updates missing information when the user fills a field', () => {
    const ticket = fromGenerated(bug)
    ticket.fields.environment = 'Chrome on Windows'

    expect(missingInformation(ticket)).toEqual(['expectedResult'])
  })

  it('keeps suggestions out of the output until the user accepts them', () => {
    let ticket = fromGenerated(bug)
    const environment = FIELDS.Bug.find((f) => f.key === 'environment')!

    expect(pendingSuggestion(ticket, environment)).toBe('Chrome on Windows')
    expect(toGenerated(ticket)).toMatchObject({ environment: '', missingInformation: ['expectedResult', 'environment'] })
    expect(toWikiMarkup(ticket)).not.toContain('Chrome')

    ticket = acceptSuggestion(ticket, environment)
    expect(toGenerated(ticket)).toMatchObject({ environment: 'Chrome on Windows', missingInformation: ['expectedResult'] })
    expect(pendingSuggestion(ticket, environment)).toBeUndefined()
  })

  it('offers no suggestion for a required field or once the field has text', () => {
    const ticket = fromGenerated({ ...feature, suggestions: { acceptanceCriteria: 'Anything', userOrBusinessNeed: 'x' } })
    ticket.fields.userOrBusinessNeed = 'typed'

    expect(FIELDS.Feature.map((f) => pendingSuggestion(ticket, f))).toEqual([undefined, undefined, undefined, undefined])
  })

  it('restores field values after switching type and back', () => {
    const ticket = fromGenerated(bug)
    const back = changeType(changeType(ticket, 'Feature'), 'Bug')

    expect(back.fields).toMatchObject({ stepsToReproduce: ['Open reports', 'Click Export'], actualResult: 'Error toast' })
  })

  it('blocks copy and save while a required field is empty', () => {
    const ticket = fromGenerated(feature)
    expect(missingRequired(ticket).map((field) => field.key)).toEqual(['acceptanceCriteria'])

    ticket.fields.acceptanceCriteria = ['Theme follows the OS setting']
    expect(missingRequired(ticket)).toEqual([])

    ticket.fields.title = ' '
    expect(missingRequired(ticket).map((field) => field.key)).toEqual(['title'])
  })

  it('exports the flat API JSON shape, type first, with trimmed values and recomputed missing information', () => {
    const ticket = fromGenerated(bug)
    ticket.fields.stepsToReproduce = [' Open reports ', '', 'Click Export']
    ticket.fields.environment = 'Edge'

    const json = toGenerated(ticket)
    expect(json).toEqual({
      type: 'Bug',
      title: 'Export fails',
      description: 'CSV export shows an error.',
      stepsToReproduce: ['Open reports', 'Click Export'],
      actualResult: 'Error toast',
      expectedResult: '',
      environment: 'Edge',
      missingInformation: ['expectedResult'],
    })
    expect(Object.keys(json)[0]).toBe('type')
  })

  it('renders Jira wiki markup without the title, skipping empty sections and escaping braces', () => {
    const ticket = fromGenerated(bug)
    ticket.fields.actualResult = 'Error {code} [500]'

    expect(toWikiMarkup(ticket)).toBe(
      [
        'CSV export shows an error.',
        'h3. Steps to reproduce\n# Open reports\n# Click Export',
        'h3. Actual result\nError \\{code\\} \\[500\\]',
        'h3. Missing information\n* Expected result\n* Environment / platform',
      ].join('\n\n'),
    )
  })

  it('names the JSON file after the type with a DD.MM.YY_HH.MM timestamp', () => {
    expect(ticketFileName('Feature', new Date(2026, 10, 6, 9, 5))).toBe('feature-ticket_06.11.26_09.05.json')
    expect(ticketFileName('Bug', new Date(2027, 0, 31, 23, 59))).toBe('bug-ticket_31.01.27_23.59.json')
  })

  it('renders acceptance criteria as a bullet list', () => {
    const ticket = fromGenerated(feature)
    ticket.fields.acceptanceCriteria = ['A', 'B']

    expect(toWikiMarkup(ticket)).toBe(
      'Add a dark theme.\n\nh3. Acceptance criteria\n* A\n* B\n\nh3. Missing information\n* User or business need',
    )
  })
})
