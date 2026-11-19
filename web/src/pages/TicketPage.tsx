import { useState } from 'react'
import { Alert, Box, Button, Link, MenuItem, Paper, Stack, TextField, Typography } from '@eleks-ui/components'
import { downloadBlob } from '../audio/mp3'
import type { TicketType } from '../api/tickets'
import {
  FIELDS,
  acceptSuggestion,
  changeType,
  isEmpty,
  missingInformation,
  pendingSuggestion,
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
  onConnect: () => void
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
  // Required missing fields first, then optional ones.
  const missingFields = FIELDS[ticket.type]
    .filter((field) => missing.includes(field.key))
    .sort((a, b) => Number(b.required) - Number(a.required))

  function focusField(key: string) {
    document.getElementById(fieldId(key))?.focus()
  }

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
    <Stack component="section" spacing={2}>
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" onClick={props.onBack}>
          Back to transcript
        </Button>
        <Button variant="outlined" onClick={props.onRegenerate} disabled={props.generating}>
          {props.generating ? 'Regenerating...' : 'Regenerate'}
        </Button>
      </Stack>
      {props.error && <Alert severity="error">{props.error}</Alert>}

      <Typography variant="h5" component="h2">
        Review the {ticket.type === 'Bug' ? 'bug' : 'feature'} ticket
      </Typography>
      <TextField
        select
        label="Issue type"
        value={ticket.type}
        onChange={(event) => props.onChange(changeType(ticket, event.target.value as TicketType))}
        helperText="The type was detected from the transcript; change it if it is wrong. Fields marked * are required."
      >
        <MenuItem value="Bug">Bug</MenuItem>
        <MenuItem value="Feature">Feature</MenuItem>
      </TextField>

      {missing.length > 0 && (
        <Alert severity="warning" title="Missing information">
          Not found in the transcript. Click an item to jump to its field:
          <ul>
            {missingFields.map((field) => {
              const suggestion = pendingSuggestion(ticket, field)
              return (
                <li key={field.key}>
                  <Link
                    component="button"
                    type="button"
                    underline="hover"
                    color={field.required ? 'error' : 'inherit'}
                    onClick={() => focusField(field.key)}
                  >
                    <strong>{field.label}</strong>
                  </Link>
                  {field.required ? ' (required)' : suggestion && <em> - suggested: {suggestion}</em>}
                </li>
              )
            })}
          </ul>
        </Alert>
      )}

      <Stack spacing={2}>
        {FIELDS[ticket.type].map((field) => (
          <TicketField
            key={field.key}
            field={field}
            value={ticket.fields[field.key]}
            empty={isEmpty(ticket, field)}
            suggestion={pendingSuggestion(ticket, field)}
            onChange={(value) => setField(field.key, value)}
            onAccept={() => props.onChange(acceptSuggestion(ticket, field))}
          />
        ))}
      </Stack>

      <Typography variant="h6" component="h3">
        Board-ready preview (Jira wiki markup)
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Paste the title into Summary and the text below into Description.
      </Typography>
      <Paper variant="outlined" sx={{ p: 1.5, overflowX: 'auto' }}>
        <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          <strong>Summary:</strong> {title || '(empty)'}
          {'\n\n'}
          {markup}
        </Box>
      </Paper>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="outlined" onClick={() => copy('Title', title)} disabled={!ready}>
          Copy title
        </Button>
        <Button variant="outlined" onClick={() => copy('Description', markup)} disabled={!ready}>
          Copy description
        </Button>
        <Button variant="outlined" onClick={saveJson} disabled={!ready}>
          Save as JSON
        </Button>
        <Button variant="contained" onClick={props.onConnect} disabled={!ready}>
          Connect to Jira board
        </Button>
        <Typography variant="body2" color="text.secondary" aria-live="polite">
          {ready ? copied : `Fill in the required fields first: ${blocking.map((field) => field.label).join(', ')}.`}
        </Typography>
      </Stack>
    </Stack>
  )
}

const fieldId = (key: string) => `ticket-field-${key}`

function TicketField(props: {
  field: FieldDef
  value: string | string[] | undefined
  empty: boolean
  suggestion: string | undefined
  onChange: (value: string | string[]) => void
  onAccept: () => void
}) {
  const { field, empty, suggestion } = props
  const label = `${field.label}${field.required ? ' *' : ''}${field.kind === 'list' ? ' (one item per line)' : ''}`
  const helperText = suggestion
    ? 'Suggested by the model, not part of the ticket yet. Click the field (or press Enter) to accept it, or type your own.'
    : empty ? (field.required ? 'Required, empty' : 'Empty') : undefined
  const text = Array.isArray(props.value) ? props.value.join('\n') : (props.value ?? '')

  return (
    <TextField
      id={fieldId(field.key)}
      label={label}
      placeholder={suggestion}
      onClick={suggestion ? props.onAccept : undefined}
      onKeyDown={(event) => {
        if (suggestion && event.key === 'Enter') {
          event.preventDefault()
          props.onAccept()
        }
      }}
      slotProps={{
        inputLabel: { shrink: suggestion ? true : undefined },
        htmlInput: {
          sx: { '&::placeholder': { fontStyle: 'italic', color: 'text.disabled', opacity: 1 } },
        },
      }}
      value={field.kind === 'text' ? (typeof props.value === 'string' ? props.value : '') : text}
      onChange={(event) =>
        props.onChange(field.kind === 'list' ? event.target.value.split('\n') : event.target.value)
      }
      multiline={field.kind !== 'text'}
      minRows={field.kind === 'list' ? 5 : 3}
      error={empty && field.required}
      color={empty && !field.required ? 'warning' : undefined}
      helperText={helperText}
      fullWidth
    />
  )
}
