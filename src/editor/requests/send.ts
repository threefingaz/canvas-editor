import { agentAddress, type AgentAnswer } from '../../requests/api.ts'
import type { CopyState } from '../copy.ts'

// The pure parts of the button "Send to the agent": the call of the dev
// server, which starts the command of the code editor that opens the chat of
// the agent with the fixed sentence, and the texts of the button for each
// state.

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

// The part of `fetch` that the call needs.
export type Fetch = (
  address: string,
  init: { method: 'POST' },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

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
// fails too, the text gives the sentence itself.
export function sendLabel(state: SendState, copy: CopyState, sentence: string): string {
  if (state.kind === 'sending') return 'The agent command starts.'
  if (state.kind === 'sent') return 'Sent to the agent. The chat of the agent opens in the code editor.'
  if (state.kind === 'failed') {
    const start = `The agent command did not start (${state.reason}).`
    return copy === 'failed'
      ? `${start} Cannot copy to the clipboard. Give the agent: ${sentence}`
      : `${start} The sentence is copied: paste it into the chat of the agent.`
  }
  return 'Open the chat of the agent in the code editor with the sentence for the agent'
}

// The text that a screen reader announces: only a result, not the idle state.
export function sendStatus(state: SendState, copy: CopyState, sentence: string): string {
  return state.kind === 'sent' || state.kind === 'failed' ? sendLabel(state, copy, sentence) : ''
}
