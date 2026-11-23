// The pure parts of "Send to the agent" (`agent-plugin.ts`): the way that
// the setting `agent` of the config gives (`agentOf`), the command line that
// opens the chat of the agent with the fixed sentence, and the texts for the
// user when the command did not start.

import type { AgentPreset, AgentSetting } from '../canvas.config.ts'

// The setting as the tool uses it: `null` of an older config is read as
// `'clipboard'` one time, when the settings are read (`project-config.ts`).
export type AgentChoice = Exclude<AgentSetting, null>

// A command and its first arguments; the sentence comes after them.
export type AgentLine = { command: string; args: readonly string[] }

// The command line of the preset `vscode`: the command line of VS Code, which
// opens the chat of its agent. The tool looks for its command where VS Code
// keeps it (`agentCommands`).
export const vscodeLine: AgentLine = { command: 'code', args: ['chat', '--mode', 'agent', '--reuse-window'] }

export function isPreset(value: unknown): value is AgentPreset {
  return value === 'vscode'
}

// The setting of a config: `null` (an older config) is the clipboard.
export function choiceOf(setting: AgentSetting): AgentChoice {
  return setting ?? 'clipboard'
}

// The way that holds: the clipboard (the one button "Copy for the agent"), or
// a command that the dev server starts, with the name of its preset or null
// for a command of the user.
export type AgentWay = { kind: 'clipboard' } | { kind: 'command'; line: AgentLine; preset: AgentPreset | null }

export type Env = Readonly<Record<string, string | undefined>>

// The dev server runs in a terminal of VS Code: VS Code gives each of its
// terminals `TERM_PROGRAM=vscode` and the path of its Git helper.
export function inCodeTerminal(env: Env): boolean {
  return env.TERM_PROGRAM === 'vscode' || (env.VSCODE_GIT_ASKPASS_MAIN ?? '') !== ''
}

// The way of a setting in the environment of the dev server. `'auto'` takes
// the preset `vscode` in a terminal of VS Code, else the clipboard.
export function agentOf(setting: AgentChoice, env: Env): AgentWay {
  const vscode: AgentWay = { kind: 'command', line: vscodeLine, preset: 'vscode' }
  if (setting === 'clipboard') return { kind: 'clipboard' }
  if (setting === 'auto') return inCodeTerminal(env) ? vscode : { kind: 'clipboard' }
  if (setting === 'vscode') return vscode
  return { kind: 'command', line: setting, preset: null }
}

// The way in words, for `canvas status`.
export function wayText(way: AgentWay): string {
  if (way.kind === 'clipboard') return 'the clipboard: Copy for the agent copies the sentence'
  const line = [way.line.command, ...way.line.args].join(' ')
  return way.preset === null ? `the command ${line}` : `the preset ${way.preset}, ${line}`
}

// The setting in the form of the config, for `canvas status`.
export function settingText(setting: AgentChoice): string {
  if (typeof setting === 'string') return `'${setting}'`
  return '{ command, args }'
}

// What the dev server starts.
export type AgentCommand = { command: string; args: string[]; shell: boolean }

// The reason when the way is the clipboard and the editor asks for a start
// all the same.
export const noCommand = 'canvas.config.ts sets no command for the agent: Copy for the agent copies the sentence'

// A character that a shell line reads as more than text, also in double
// quotes (in the sentence, and in the path of the command): the end of the quotes, a variable, a second command, a redirect.
const unsafe = /["%&|<>^`$!\r\n]/

// The command with the sentence as its last argument. On Windows the command
// of a code editor is a `.cmd` script, which only a shell can start; the shell
// gets one line, thus the sentence is in double quotes there, and a sentence
// with a character that the shell reads in a different way is refused, not
// changed. On the other platforms no shell runs, and the sentence is one
// argument as it is.
export function agentCommand(agent: AgentLine, sentence: string, platform: string): AgentCommand {
  if (platform !== 'win32') return { command: agent.command, args: [...agent.args, sentence], shell: false }
  const found = unsafe.exec(sentence) ?? unsafe.exec(agent.command)
  if (found) throw new Error(`the command line has the character ${JSON.stringify(found[0])}, which is not safe in a shell line`)
  // A path with a space is one word of the shell line only in quotes.
  const command = agent.command.includes(' ') ? `"${agent.command}"` : agent.command
  return { command, args: [...agent.args, `"${sentence}"`], shell: true }
}

// The name of the command line of VS Code, the command of the preset
// `vscode`. With this name and no path, the tool also looks for the command
// where VS Code keeps it: many machines do not have it on the path. A
// `{ command, args }` with this name gets the search too, as before the
// presets.
export const codeCommand = vscodeLine.command

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
export function codePlaces(env: Env, platform: string): string[] {
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
  agent: AgentLine,
  env: Env,
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

// The reason for the user when no place of the command started. It names
// the preset that is in use and its next step; for a command of the user it
// names no code editor, only the setting.
export function failedReason(way: Extract<AgentWay, { kind: 'command' }>, reason: string): string {
  const notFound = reason.endsWith('was not found')
  if (way.preset === null) return notFound ? `${reason}; write its full path as \`command\` of \`agent\` in canvas.config.ts` : reason
  const text = `the preset ${way.preset}: ${reason}`
  if (!notFound) return text
  const searched = way.line.command === codeCommand ? ', also not in the folder of VS Code' : ''
  return `${text}${searched}; set \`agent\` in canvas.config.ts to \`{ command, args }\` with the full path of the command, or to 'clipboard'`
}
