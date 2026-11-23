import { agentAddress, type AgentAnswer, type AgentWayAnswer } from '../../requests/api.ts'
import type { CopyState } from '../copy.ts'

// The pure parts of the buttons that give the sentence to the agent: the way
// that the dev server says (`GET`), the call that starts the command of the
// way (`POST`), which opens the chat of the agent with the fixed sentence,
// and the texts of the buttons for each state.

export type SendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  // The command did not start: the button copies the sentence in its place.
  | { kind: 'failed'; reason: string }

export const idle: SendState = { kind: 'idle' }

// How long the button shows that the sentence went to the agent, in ms. A
// failure shows as long as a failed copy (`failedDelay` in `copy.ts`): its
// text tells the user what to do by hand.
export const sentDelay = 4000

// The reason when the dev server gave no answer of the expected form.
export const noAnswer = 'the dev server did not answer'

// The answer of the dev server from its JSON. An answer of a different form
// is a failure, thus the user still gets the sentence.
export function answerOf(value: unknown): AgentAnswer {
  if (typeof value !== 'object' || value === null) return { started: false, reason: noAnswer }
  const { started, reason } = value as { started?: unknown; reason?: unknown }
  if (started === true) return { started: true }
  return { started: false, reason: typeof reason === 'string' && reason !== '' ? reason : noAnswer }
}

// The part of `fetch` that the calls need.
export type Fetch = (
  address: string,
  init: { method: 'GET' | 'POST' },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

// The clipboard is the base: it always works, thus it is the way before the
// answer and after a failed one.
export const clipboardWay: AgentWayAnswer = { way: 'clipboard' }

// The way from the JSON of the dev server. A different form is the clipboard.
export function wayOf(value: unknown): AgentWayAnswer {
  if (typeof value !== 'object' || value === null) return clipboardWay
  const { way, preset } = value as { way?: unknown; preset?: unknown }
  if (way !== 'command') return clipboardWay
  return { way: 'command', preset: typeof preset === 'string' && preset !== '' ? preset : null }
}

// Asks the dev server which way holds. It never rejects: an error is the
// clipboard.
export async function agentWay(fetch: Fetch): Promise<AgentWayAnswer> {
  try {
    const response = await fetch(agentAddress, { method: 'GET' })
    return response.ok ? wayOf(await response.json()) : clipboardWay
  } catch {
    return clipboardWay
  }
}

// Asks the dev server to start the command. It sends no content: the command
// and the sentence are fixed on the server. It never rejects: each error is
// an answer with a reason.
export async function sendToAgent(fetch: Fetch): Promise<AgentAnswer> {
  try {
    const response = await fetch(agentAddress, { method: 'POST' })
    if (!response.ok) return { started: false, reason: `${noAnswer}, status ${response.status}` }
    return answerOf(await response.json())
  } catch {
    return { started: false, reason: noAnswer }
  }
}

export function stateAfter(answer: AgentAnswer): SendState {
  return answer.started ? { kind: 'sent' } : { kind: 'failed', reason: answer.reason }
}

// The short text on the button. After a failure it says what the user does
// next, with no hover: the sentence is in the clipboard.
export function sendText(state: SendState, copy: CopyState = 'idle'): string {
  if (state.kind === 'sending') return 'Sending…'
  if (state.kind === 'sent') return 'Sent to the agent'
  // The copy shows its result only for a short time; the text stays.
  if (state.kind === 'failed') return copy === 'failed' ? 'Not sent' : 'Copied: paste it in the chat'
  return 'Send to the agent'
}

// The full text of the state, for the tooltip and for a screen reader.
// `copy` is the state of the copy that a failure starts: when the clipboard
// fails too, the text gives the sentence itself. `preset` is the name of the
// preset of the way, or null for a command of the user.
export function sendLabel(state: SendState, copy: CopyState, sentence: string, preset: string | null = null): string {
  if (state.kind === 'sending') return 'The agent command starts.'
  if (state.kind === 'sent') return 'Sent to the agent. The chat of the agent opens with the sentence.'
  if (state.kind === 'failed') {
    const start = `The agent command did not start (${state.reason}).`
    return copy === 'failed'
      ? `${start} Cannot copy to the clipboard. Give the agent: ${sentence}`
      : `${start} The sentence is copied: paste it into the chat of the agent.`
  }
  const by = preset === null ? 'the command of canvas.config.ts' : `the preset ${preset}`
  return `Open the chat of the agent with the sentence for the agent, by ${by}`
}

// The text that a screen reader announces: only a result, not the idle state.
export function sendStatus(state: SendState, copy: CopyState, sentence: string): string {
  return state.kind === 'sent' || state.kind === 'failed' ? sendLabel(state, copy, sentence) : ''
}

// The short text of the one button of the clipboard way.
export function copyText(copy: CopyState): string {
  if (copy === 'copied') return 'Copied: paste it in the chat of the agent'
  if (copy === 'failed') return 'Not copied'
  return 'Copy for the agent'
}

// The full text of the one button of the clipboard way. A failure gives the
// sentence: the user can still give it by hand.
export function copyLabel(copy: CopyState, sentence: string): string {
  if (copy === 'copied') return 'The sentence is copied: paste it into the chat of the agent.'
  if (copy === 'failed') return `Cannot copy to the clipboard. Give the agent: ${sentence}`
  return 'Copy the sentence for the agent, then paste it into the chat of the agent'
}

// The text that a screen reader announces for the one button: only a result.
export function copyStatus(copy: CopyState, sentence: string): string {
  return copy === 'idle' ? '' : copyLabel(copy, sentence)
}
