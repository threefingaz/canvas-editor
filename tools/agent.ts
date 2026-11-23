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
// quotes (in the sentence, and in the path of the command): the end of the quotes, a variable, a second command, a redirect.
const unsafe = /["%&|<>^`$!\r\n]/

// The command with the sentence as its last argument. On Windows the command
// of a code editor is a `.cmd` script, which only a shell can start; the shell
// gets one line, thus the sentence is in double quotes there, and a sentence
// with a character that the shell reads in a different way is refused, not
// changed. On the other platforms no shell runs, and the sentence is one
// argument as it is.
export function agentCommand(agent: NonNullable<AgentConfig>, sentence: string, platform: string): AgentCommand {
  if (platform !== 'win32') return { command: agent.command, args: [...agent.args, sentence], shell: false }
  const found = unsafe.exec(sentence) ?? unsafe.exec(agent.command)
  if (found) throw new Error(`the command line has the character ${JSON.stringify(found[0])}, which is not safe in a shell line`)
  // A path with a space is one word of the shell line only in quotes.
  const command = agent.command.includes(' ') ? `"${agent.command}"` : agent.command
  return { command, args: [...agent.args, `"${sentence}"`], shell: true }
}

// The name of the command line of VS Code. When the config has this name and
// no path, the tool also looks for the command where VS Code keeps it: many
// machines do not have it on the path.
export const codeCommand = 'code'

// The command line of the VS Code whose terminal runs the dev server. VS Code
// gives each of its terminals the path of a script inside its own folder
// (`VSCODE_GIT_ASKPASS_MAIN`, `…/resources/app/extensions/git/…`); the command
// is in the same installation. Null when the path has a different form.
export function codeOfTerminal(askpass: string | undefined, platform: string): string | null {
  const match = askpass === undefined ? null : /^(.*?)[\\/]resources[\\/]app[\\/]extensions[\\/]/i.exec(askpass)
  if (!match) return null
  const root = match[1]
  if (platform === 'win32') return `${root}\\bin\\code.cmd`
  // In the application of macOS the command is below `Resources/app`.
  return platform === 'darwin' ? `${root}/Resources/app/bin/code` : `${root}/bin/code`
}

// The usual places of the command line of VS Code on a platform.
export function codePlaces(env: Readonly<Record<string, string | undefined>>, platform: string): string[] {
  if (platform === 'win32') {
    return [env.LOCALAPPDATA && `${env.LOCALAPPDATA}\\Programs\\Microsoft VS Code\\bin\\code.cmd`, env.ProgramFiles && `${env.ProgramFiles}\\Microsoft VS Code\\bin\\code.cmd`].filter(
      (path): path is string => typeof path === 'string' && path !== '',
    )
  }
  const app = 'Visual Studio Code.app/Contents/Resources/app/bin/code'
  if (platform === 'darwin') return [`/Applications/${app}`, ...(env.HOME ? [`${env.HOME}/Applications/${app}`] : [])]
  return ['/usr/share/code/bin/code', '/usr/bin/code', '/snap/bin/code']
}

// The commands to try, in this sequence, for the command of the config. A
// command with a path, and a command of a different code editor, is tried as
// it is. For `code`: first the VS Code of the terminal that runs the dev
// server, then `code` of the path, then the usual places; a place counts only
// when its file is there (`exists`).
export function agentCommands(
  agent: NonNullable<AgentConfig>,
  env: Readonly<Record<string, string | undefined>>,
  platform: string,
  exists: (path: string) => boolean,
): string[] {
  if (agent.command !== codeCommand) return [agent.command]
  const terminal = codeOfTerminal(env.VSCODE_GIT_ASKPASS_MAIN, platform)
  const found = [terminal, ...codePlaces(env, platform)].filter((path): path is string => path !== null && exists(path))
  return [...new Set([...found.slice(0, terminal !== null && found[0] === terminal ? 1 : 0), agent.command, ...found])]
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
