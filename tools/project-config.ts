// The settings of a project from its own `canvas.config.ts`: `widths` and
// `agent`. The names of the folders in a project (`screens`, `components`,
// `tokens`, `work`) stay fixed in the config of the tool, which many modules
// import.
//
// `settingsOf` is pure: it checks the module of the file and takes the
// default (`projectDefaults`: the widths of the tool and `agent: 'auto'`) for
// each field that the file does not have. `readProjectSettings` loads the
// file through the module runner of Vite. The project of the tool itself
// (standalone) has the settings of the config of the tool.

import { existsSync } from 'node:fs'
import { posix } from 'node:path'
import { runnerImport } from 'vite'
import { config } from '../canvas.config.ts'
import { isRecord } from '../src/tokens/format.ts'
import { choiceOf, isPreset, type AgentChoice } from './agent.ts'
import { projectConfigName, samePath, toolRoot } from './project.ts'

export type ProjectSettings = { widths: readonly number[]; agent: AgentChoice }

// The settings of the project of the tool itself: its own config.
export const toolSettings: ProjectSettings = { widths: config.widths, agent: choiceOf(config.agent) }

// The defaults of a project in a different folder, for a field that its
// config does not have, and with no config: `agent` is `'auto'`.
export const projectDefaults: ProjectSettings = { widths: config.widths, agent: 'auto' }

// The settings of the loaded module of a `canvas.config.ts`: its export
// `config` (or the default export). A field that is not there gets the
// default; a field that is not valid throws with the file in the message.
export function settingsOf(module: unknown, file: string, defaults: ProjectSettings = projectDefaults): ProjectSettings {
  const fail = (text: string): never => {
    throw new Error(`${file}: ${text}`)
  }
  const exported = isRecord(module) ? (module.config ?? module.default) : undefined
  if (exported === undefined) fail('the file has no export `config`')
  if (!isRecord(exported)) return fail('`config` must be an object')
  const settings = { ...defaults }
  if (exported.widths !== undefined) {
    const widths = exported.widths
    if (!Array.isArray(widths) || widths.length === 0 || !widths.every((width) => Number.isInteger(width) && width > 0)) {
      fail('`widths` must be a list of whole numbers of px, with one or more')
    }
    settings.widths = widths as number[]
  }
  if (exported.agent !== undefined) {
    const agent = exported.agent
    if (agent === null || agent === 'auto' || agent === 'clipboard' || isPreset(agent)) settings.agent = choiceOf(agent)
    else if (
      isRecord(agent) &&
      typeof agent.command === 'string' &&
      agent.command !== '' &&
      Array.isArray(agent.args) &&
      agent.args.every((arg) => typeof arg === 'string')
    ) {
      settings.agent = { command: agent.command, args: agent.args as string[] }
    } else {
      fail("`agent` must be 'auto', 'clipboard', the name of a preset ('vscode'), `{ command, args }` with a text and a list of texts, or null")
    }
  }
  return settings
}

// The settings of the project at `project` (with `/` between the parts).
export async function readProjectSettings(project: string): Promise<ProjectSettings> {
  if (samePath(project, toolRoot)) return toolSettings
  const file = posix.join(project, projectConfigName)
  if (!existsSync(file)) return projectDefaults
  const { module } = await runnerImport<unknown>(file)
  return settingsOf(module, file)
}
