// The pure parts of "Send to the agent" (`agent-plugin.ts`): the command line
// that opens the chat of the agent in the code editor with the fixed
// sentence, and the texts for the user when the command did not start.

import type { CanvasConfig } from '../canvas.config.ts'

// The field `agent` of the config: the command and its first arguments, or
// null when "Send to the agent" is off.
export type AgentConfig = CanvasConfig['agent']

// What the dev server starts.
export type AgentCommand = { command: string; args: string[]; shell: boolean }

// The reason for the user when the config has no command.
export const agentOff = 'Send to the agent is turned off in canvas.config.ts'

// A character that a shell line reads as more than text, also in double
// quotes: the end of the quotes, a variable, a second command, a redirect.
const unsafe = /["%&|<>^`$!\r\n]/

// The command with the sentence as its last argument. On Windows the command
// of a code editor is a `.cmd` script, which only a shell can start; the shell
// gets one line, thus the sentence is in double quotes there, and a sentence
// with a character that the shell reads in a different way is refused, not
// changed. On the other platforms no shell runs, and the sentence is one
// argument as it is.
export function agentCommand(agent: NonNullable<AgentConfig>, sentence: string, platform: string): AgentCommand {
  if (platform !== 'win32') return { command: agent.command, args: [...agent.args, sentence], shell: false }
  const found = unsafe.exec(sentence)
  if (found) throw new Error(`the sentence has the character ${JSON.stringify(found[0])}, which is not safe in a shell line`)
  return { command: agent.command, args: [...agent.args, `"${sentence}"`], shell: true }
}

// How a start ended: the process runs (or ended with the code 0), the system
// did not start it, or it ended with an error code within the wait.
export type StartEvent =
  | { kind: 'running' }
  | { kind: 'error'; code: string | undefined; message: string }
  | { kind: 'exit'; code: number | null }

export type StartResult = { started: true } | { started: false; reason: string }

// The answer for the editor. A code editor that is not installed, or whose
// command is not on the path, gives `ENOENT`; with a shell (Windows) the shell
// starts and ends with an error code.
export function startResult(event: StartEvent, command: string): StartResult {
  if (event.kind === 'running' || (event.kind === 'exit' && event.code === 0)) return { started: true }
  if (event.kind === 'error') {
    if (event.code === 'ENOENT') return { started: false, reason: `the command "${command}" was not found` }
    return { started: false, reason: `the command "${command}" did not start: ${event.message}` }
  }
  return {
    started: false,
    reason:
      event.code === null
        ? `the command "${command}" was stopped`
        : `the command "${command}" ended with the code ${event.code}`,
  }
}
