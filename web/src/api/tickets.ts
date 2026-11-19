export type TicketType = 'Bug' | 'Feature'

// The API returns one flat ticket; `type` decides which fields are present.
export interface BugTicket {
  type: 'Bug'
  title: string
  description: string
  stepsToReproduce: string[]
  actualResult: string
  expectedResult: string
  environment: string
  missingInformation: string[]
  suggestions: Record<string, string>
}

export interface FeatureTicket {
  type: 'Feature'
  title: string
  description: string
  userOrBusinessNeed: string
  acceptanceCriteria: string[]
  missingInformation: string[]
  suggestions: Record<string, string>
}

export type GeneratedTicket = BugTicket | FeatureTicket

// Calls the API; throws an Error with a readable message (ProblemDetails detail) on failure.
export async function generateTicket(transcript: string, signal?: AbortSignal): Promise<GeneratedTicket> {
  const response = await fetch('/api/tickets/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
    signal,
  })

  if (response.ok) {
    return (await response.json()) as GeneratedTicket
  }

  throw new Error(await describeProblem(response))
}

export async function describeProblem(response: Response): Promise<string> {
  try {
    const problem = (await response.json()) as { title?: string; detail?: string; errors?: Record<string, string[]> }
    const fieldErrors = problem.errors ? Object.values(problem.errors).flat().join(' ') : ''
    return problem.detail || fieldErrors || problem.title || `Request failed (${response.status}).`
  } catch {
    return `Request failed (${response.status}).`
  }
}

// Dedicated Claude call: translates the text into the target language ('en' | 'uk').
export async function translateText(text: string, targetLanguage: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch('/api/tickets/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, targetLanguage }),
    signal,
  })

  if (response.ok) {
    return ((await response.json()) as { text: string }).text
  }

  throw new Error(await describeProblem(response))
}
