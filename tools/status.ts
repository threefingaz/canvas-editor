// `canvas status`: the state of a project as a list that a person and an
// agent read. It is the proof of the setup that needs no page: the library and
// its level, the provider, the tokens by group, the library skill, the
// `AGENTS.md` of the pack, the screens, the findings of the check, the command of the agent, and the
// version of the tool that wrote the copy of the guide.
//
// `readStatus` reads the project from the disk; `statusText` (pure) gives the
// text.

import { existsSync } from 'node:fs'
import { posix } from 'node:path'
import { config } from '../canvas.config.ts'
import { counted } from '../src/words.ts'
import { connectSentence, librarySetupSkill, tokensSentence } from '../src/frame/library-setup.ts'
import { messageOf, parseTokens, tokenGroups, type TokenGroup } from '../src/tokens/format.ts'
import { agentOf, settingText, wayText, type AgentChoice, type AgentWay } from './agent.ts'
import { checkProject, readProjectScreens, type FindingKind } from './check.ts'
import { devRecordName, readDevServer } from './dev-record.ts'
import { diskOf, guideVersion, syncPlan, toolVersionOf } from './init.ts'
import { levelOf, librarySources, packErrorText, providerPath, readPackState, type Level } from './pack.ts'
import { projectDefaults, readProjectSettings, type ProjectSettings } from './project-config.ts'
import { guideName, hostRoot, projectConfigName, samePath } from './project.ts'

export type TokenState =
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; groups: Partial<Record<TokenGroup, number>>; count: number }

export type Status = {
  project: string
  // The host root, or null in standalone.
  host: string | null
  // The pack, or null with none; an error of the pack state as its text.
  library: { name: string; sources: string[]; folder: string } | null
  packError: string | null
  level: Level
  // The provider of the pack, relative to the project, and whether it exists.
  provider: { path: string; exists: boolean } | null
  tokens: TokenState
  // The library skill of the pack, relative to the project, or null with none.
  skill: string | null
  // The `AGENTS.md` of the pack, relative to the project, and whether it
  // exists. Null with no pack.
  packGuide: { path: string; exists: boolean } | null
  screens: { count: number; flows: number }
  check: { findings: number; kinds: Partial<Record<FindingKind, number>> }
  // The setting `agent` and its way in the environment of this command.
  agent: { setting: AgentChoice; way: AgentWay }
  // The dev server of the project that runs (`dev-record.ts`), or null.
  dev: { url: string } | null
  tool: string
  // The copy of the guide in a host: the version that wrote it (null when the
  // copy has no version line), the count of files that `canvas sync` would
  // write (null when it refuses: no project), and the error of that plan
  // (a guide of the tool that is missing, a skill with a bad head). Null in
  // standalone.
  guide: { version: string | null; changes: number | null; error: string | null } | null
  // The error of the `canvas.config.ts` of the project, or null. The status
  // then reads the defaults.
  settingsError: string | null
}

function count(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

function readTokenState(file: string, read: (path: string) => string | null): TokenState {
  const text = read(file)
  if (text === null) return { kind: 'missing' }
  try {
    const tokens = parseTokens(JSON.parse(text))
    return { kind: 'ok', groups: count(tokens.map((token) => token.group)), count: tokens.length }
  } catch (error) {
    return { kind: 'error', message: messageOf(error) }
  }
}

// The library skill of a pack, relative to the project.
function skillPath(pack: { name: string; folder: string }): string {
  return posix.join(pack.folder, 'skills', `canvas-library-${pack.name}`, 'SKILL.md')
}

// The state of the project. `tool` is the folder of the tool; the project is
// standalone when it is that folder.
export async function readStatus(project: string, tool: string): Promise<Status> {
  const disk = diskOf()
  const standalone = samePath(project, tool)
  const host = standalone ? null : hostRoot(project, existsSync)
  const state = readPackState(project)
  const pack = state.kind === 'one' ? state.pack : null
  const packError = state.kind === 'error' ? packErrorText(state.message) : null
  const tokens = readTokenState(posix.join(project, config.tokens), disk.read)
  const level = packError !== null ? 'none' : levelOf(pack, tokens.kind === 'ok' ? tokens.count : null)
  let settings: ProjectSettings = projectDefaults
  let settingsError: string | null = null
  try {
    settings = await readProjectSettings(project)
  } catch (error) {
    settingsError = messageOf(error)
  }
  const screens = readProjectScreens(project, config.screens, settings.widths)
  const entries = screens.entries
  const result = checkProject(project, screens, {
    library: pack === null ? null : librarySources(pack, project, host ?? project),
    scaleKeys: pack?.scaleKeys ?? null,
    widths: settings.widths,
  })
  const skill = pack === null ? null : skillPath(pack)
  const packGuide = pack === null ? null : posix.join(pack.folder, guideName)
  const dev = readDevServer(project)
  let guide: Status['guide'] = null
  if (host !== null) {
    const version = guideVersion(disk.read(posix.join(project, guideName)))
    try {
      const plan = syncPlan({ disk, tool, host, project, library: null })
      guide = { version, changes: plan.refusals.length > 0 ? null : plan.writes.length + plan.removes.length, error: null }
    } catch (error) {
      guide = { version, changes: null, error: messageOf(error) }
    }
  }
  return {
    project,
    host,
    library: pack === null ? null : { name: pack.name, sources: pack.sources, folder: pack.folder },
    packError,
    level,
    provider: pack === null ? null : { path: posix.relative(project, providerPath(pack, project)), exists: existsSync(providerPath(pack, project)) },
    tokens,
    skill: skill !== null && existsSync(posix.join(project, skill)) ? skill : null,
    packGuide: packGuide === null ? null : { path: packGuide, exists: existsSync(posix.join(project, packGuide)) },
    screens: { count: entries.length, flows: new Set(entries.map((entry) => entry.flow)).size },
    check: { findings: result.findings.length, kinds: count(result.findings.map((finding) => finding.kind)) },
    agent: { setting: settings.agent, way: agentOf(settings.agent, process.env) },
    dev: dev === null ? null : { url: dev.url },
    tool: toolVersionOf(disk.read(posix.join(tool, 'package.json'))),
    guide,
    settingsError,
  }
}

// The line of the next step of the setup, or null when the setup is done.
// The level `ready` is not the end of level 2: the setup is done when the
// library skill and the `AGENTS.md` of the pack are there too.
export function nextStep(status: Status): string | null {
  if (status.packError !== null) return 'Fix the pack: the dev server, the build and the check stop on this error.'
  if (status.settingsError !== null) return `Fix ${projectConfigName}: the dev server and the build stop on this error.`
  if (status.level === 'none') return `Connect a library: canvas init --library <package>, or give the agent: ${connectSentence}`
  if (status.provider !== null && !status.provider.exists) return `Write the provider ${status.provider.path}: the screens cannot render without it.`
  if (status.tokens.kind !== 'ok') return 'Write the token file: canvas tokens.'
  if (status.level === 'connected') return `Set up the tokens (level 2): give the agent: ${tokensSentence} You can create screens meanwhile.`
  if (status.library !== null && status.skill === null) {
    return `Write the library skill ${skillPath(status.library)} (level 2, step 5 of the skill ${librarySetupSkill}). The tokens are set up; the agent has no library skill yet.`
  }
  if (status.packGuide !== null && !status.packGuide.exists) {
    return `Write ${status.packGuide.path} (level 2, step 6 of the skill ${librarySetupSkill}): the instructions of the library for the agent, with the link to the library skill.`
  }
  return null
}

// Pure: the text of a status.
export function statusText(status: Status): string {
  const lines: string[] = []
  lines.push(`Project: ${status.project}${status.host === null ? ' (standalone)' : `, in the host ${status.host}`}`)
  if (status.settingsError !== null) lines.push(`Config: ${projectConfigName} is not valid: ${status.settingsError}`)
  if (status.packError !== null) lines.push(`Library: the pack is not valid: ${status.packError}`)
  else if (status.library === null) lines.push('Library: none is connected (level none)')
  else lines.push(`Library: ${status.library.sources.join(', ')}, the pack ${status.library.folder} (level ${status.level})`)
  if (status.provider !== null) lines.push(`Provider: ${status.provider.path}${status.provider.exists ? '' : ' is missing'}`)
  const tokens = status.tokens
  if (tokens.kind === 'missing') lines.push(`Tokens: no ${config.tokens}`)
  else if (tokens.kind === 'error') lines.push(`Tokens: ${config.tokens} is not valid: ${tokens.message}`)
  else if (tokens.count === 0) lines.push('Tokens: none yet; the editor has no token controls and counts no value as a deviation')
  else {
    const groups = tokenGroups.map((group) => `${group} ${tokens.groups[group] ?? 0}`).join(', ')
    lines.push(`Tokens: ${tokens.count} (${groups})`)
  }
  if (status.library !== null) lines.push(`Library skill: ${status.skill ?? 'none yet'}`)
  if (status.packGuide !== null) lines.push(`Pack guide: ${status.packGuide.exists ? status.packGuide.path : `none yet (${status.packGuide.path})`}`)
  lines.push(`Screens: ${counted(status.screens.count, 'screen')} in ${counted(status.screens.flows, 'flow')}`)
  const kinds = Object.entries(status.check.kinds)
    .map(([kind, n]) => `${kind} ${n}`)
    .join(', ')
  lines.push(`Check: ${status.check.findings === 0 ? 'no finding' : `${counted(status.check.findings, 'finding')} (${kinds}); canvas check lists them`}`)
  // `'auto'` is decided in the terminal of the dev server, which can be a
  // different one.
  const auto = status.agent.setting === 'auto' ? ', in this terminal; the dev server decides it in its own' : ''
  lines.push(`Agent: ${wayText(status.agent.way)} (agent ${settingText(status.agent.setting)}${auto})`)
  lines.push(`Dev server: ${status.dev === null ? `no record of a running one (${posix.join(config.work, devRecordName)})` : `${status.dev.url} (running)`}`)
  if (status.guide === null) lines.push(`Guide: the guide of the tool, canvas-editor ${status.tool}`)
  else {
    const written = status.guide.version === null ? 'the copy has no version line' : `written by canvas-editor ${status.guide.version}`
    const { changes, error } = status.guide
    let state: string
    if (error !== null) state = `canvas sync cannot run: ${error}`
    else if (changes === null) state = 'no copy: run canvas init'
    else if (changes === 0) state = 'up to date'
    else state = `canvas sync writes ${counted(changes, 'file')} (the tool is canvas-editor ${status.tool})`
    lines.push(`Guide: ${written}; ${state}`)
  }
  const next = nextStep(status)
  lines.push(next === null ? 'Next: the setup is done.' : `Next: ${next}`)
  return lines.join('\n')
}

export async function statusCommand(project: string, tool: string): Promise<number> {
  const status = await readStatus(project, tool)
  console.log(statusText(status))
  return 0
}
