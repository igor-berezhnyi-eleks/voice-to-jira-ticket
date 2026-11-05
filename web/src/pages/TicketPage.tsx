import { useState } from 'react'
import { downloadBlob } from '../audio/mp3'
import {
  FIELDS,
  fieldLabel,
  isEmpty,
  missingInformation,
  missingRequired,
  ticketFileName,
  toGenerated,
  toWikiMarkup,
  type EditableTicket,
  type FieldDef,
} from '../ticket/ticket'

export function TicketPage(props: {
  ticket: EditableTicket
  onChange: (ticket: EditableTicket) => void
  onBack: () => void
  onRegenerate: () => void
  generating: boolean
  error: string | null
}) {
  const { ticket } = props
  const [copied, setCopied] = useState<string | null>(null)
  const missing = missingInformation(ticket)
  const blocking = missingRequired(ticket)
  const ready = blocking.length === 0
  const markup = toWikiMarkup(ticket)
  const title = typeof ticket.fields.title === 'string' ? ticket.fields.title.trim() : ''

  function setField(key: string, value: string | string[]) {
    props.onChange({ ...ticket, fields: { ...ticket.fields, [key]: value } })
  }

  async function copy(what: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(`${what} copied.`)
    } catch {
      setCopied('Copy failed: the browser blocked clipboard access.')
    }
  }

  async function saveJson() {
    const json = JSON.stringify(toGenerated(ticket), null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const suggestedName = ticketFileName(ticket.type, new Date())
    if (!window.showSaveFilePicker) {
      downloadBlob(blob, suggestedName)
      return
    }
    try {
      // Always opens the save dialog, so the user can change the name and folder.
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      setCopied(`Saved as ${handle.name}.`)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setCopied(`Save failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  return (
    <section>
      <div className="toolbar">
        <button type="button" onClick={props.onBack}>
          Back to transcript
        </button>
        <button type="button" onClick={props.onRegenerate} disabled={props.generating}>
          {props.generating ? 'Regenerating...' : 'Regenerate'}
        </button>
      </div>
      {props.error && (
        <p role="alert" className="error">
          {props.error}
        </p>
      )}

      <h2>Review the {ticket.type === 'Bug' ? 'bug' : 'feature'} ticket</h2>
      <p className="hint">
        Detected type: <strong>{ticket.type}</strong>. To change it, edit the transcript and regenerate. Fields
        marked * are required.
      </p>

      {missing.length > 0 && (
        <div className="missing" role="status">
          <strong>Missing information</strong> (not found in the transcript; nothing was invented):
          <ul>
            {missing.map((key) => (
              <li key={key}>{fieldLabel(ticket.type, key)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="ticket-form">
        {FIELDS[ticket.type].map((field) => (
          <TicketField
            key={field.key}
            field={field}
            value={ticket.fields[field.key]}
            empty={isEmpty(ticket, field)}
            onChange={(value) => setField(field.key, value)}
          />
        ))}
      </div>

      <h3>Board-ready preview (Jira wiki markup)</h3>
      <p className="hint">Paste the title into Summary and the text below into Description.</p>
      <pre className="preview">
        <strong>Summary:</strong> {title || '(empty)'}
        {'\n\n'}
        {markup}
      </pre>

      <div className="toolbar">
        <button type="button" onClick={() => copy('Title', title)} disabled={!ready}>
          Copy title
        </button>
        <button type="button" onClick={() => copy('Description', markup)} disabled={!ready}>
          Copy description
        </button>
        <button type="button" onClick={saveJson} disabled={!ready}>
          Save as JSON
        </button>
        <button type="button" disabled title="Available in a later phase">
          Connect to Jira board
        </button>
        <span className="status" aria-live="polite">
          {ready ? copied : `Fill in the required fields first: ${blocking.map((field) => field.label).join(', ')}.`}
        </span>
      </div>
    </section>
  )
}

function TicketField(props: {
  field: FieldDef
  value: string | string[] | undefined
  empty: boolean
  onChange: (value: string | string[]) => void
}) {
  const { field, empty } = props
  const className = ['field', empty ? (field.required ? 'empty-required' : 'empty') : ''].join(' ').trim()
  const label = (
    <span>
      {field.label}
      {field.required && ' *'}
      {field.kind === 'list' && <span className="hint"> (one item per line)</span>}
      {empty && <span className="badge">{field.required ? 'required, empty' : 'empty'}</span>}
    </span>
  )

  if (field.kind === 'text') {
    return (
      <label className={className}>
        {label}
        <input
          type="text"
          value={typeof props.value === 'string' ? props.value : ''}
          onChange={(event) => props.onChange(event.target.value)}
        />
      </label>
    )
  }

  const text = Array.isArray(props.value) ? props.value.join('\n') : (props.value ?? '')
  return (
    <label className={className}>
      {label}
      <textarea
        value={text}
        rows={field.kind === 'list' ? 5 : 3}
        onChange={(event) =>
          props.onChange(field.kind === 'list' ? event.target.value.split('\n') : event.target.value)
        }
      />
    </label>
  )
}
