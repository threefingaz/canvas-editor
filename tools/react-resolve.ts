// The two dev servers of `canvas dev`, and the aliases of the tool.
//
// A frame must have one copy of React, the one of the project, and the editor
// one copy too, the one of the tool. One Vite server cannot give the two: the
// dependency step keys a package by its bare name (`docs/canvas-tool-plan.md`,
// "Results of an independent tool"). Thus `canvas dev` has two
// servers on one origin (`dev.ts`):
//
// - the editor server: the root of Vite is the tool, `resolve.dedupe` gives
//   the React of the tool to the editor and to its packages;
// - the frame server, in middleware mode under `/__frame/` (`frameBase`): the
//   frames and the prototype site, with an alias for `react`, `react-dom` and
//   each sub path that a module imports, to the file that Node resolves from
//   the project (`reactAliases`). The build of the site takes the rule of the
//   frame server.
//
// The editor server gives each `/__frame/` address to the frame server, and
// sends the old address of the site (`/site.html`) there (`frameRoute`). Each
// part here is pure, except `nodeResolver`, which asks Node.

import { createRequire } from 'node:module'
import { posix } from 'node:path'
import { frameBase } from '../src/frame/screen-id.ts'
import { siteEntry } from '../src/site/entry.ts'

export type Role = 'editor' | 'frame'

// The mode of Vite that the command gives the frame server. The config
// function of Vite gets the mode, and a restart of a server keeps it, thus
// the config file reads the role of its server from it.
export const frameMode = 'canvas-frame'

// The role of a server, from what Vite gives the config function: the build
// of the site and the frame server take the rule of the frames; the dev
// server of the editor, `vite` with no mode and `canvas preview` the rule of
// the editor.
export function roleOf(command: 'build' | 'serve', mode: string): Role {
  return command === 'build' || mode === frameMode ? 'frame' : 'editor'
}

// The modules of React that a screen, a library or the frame entry imports.
// `react-dom/client` is for the entries; the two runtimes of JSX for each
// compiled module.
export const reactModules = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client'] as const

export type Resolver = (id: string) => string | null

export type Alias = { find: RegExp; replacement: string }

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}

// One alias for each module of React, all from one source: the first resolver
// (the project, then the tool) that finds both `react` and `react-dom`. A
// project with `react` and no `react-dom` (a library repository) thus takes
// the two from the tool, never one from each: two versions in one frame
// break at the start. A module that the source does not find has no alias,
// and Vite resolves it as usual.
export function reactAliases(resolvers: readonly Resolver[]): Alias[] {
  const source = resolvers.find((resolve) => resolve('react') !== null && resolve('react-dom') !== null)
  if (source === undefined) return []
  const aliases: Alias[] = []
  for (const id of reactModules) {
    const file = source(id)
    if (file !== null) aliases.push({ find: new RegExp(`^${escapeRegExp(id)}$`), replacement: file })
  }
  return aliases
}

// A resolver of Node from a folder: the file of a module as a file in that
// folder would import it, with `/` between the parts; null when the folder
// has no such module.
export function nodeResolver(folder: string): Resolver {
  const require = createRequire(posix.join(folder.replaceAll('\\', '/'), 'package.json'))
  return (id) => {
    try {
      return require.resolve(id).replaceAll('\\', '/')
    } catch {
      return null
    }
  }
}

// The name by which a token entry imports the types and the helpers of the
// tool.
export const tokensModule = 'canvas-editor/tokens'

// The file of the tool that `tokensModule` names.
export const tokensEntryFile = 'src/tokens/index.ts'

// The aliases of the tool for a module that is not a part of the tool (the
// token entry of a pack): `canvas-editor/tokens` to `src/tokens/index.ts`.
export function toolAliases(tool: string): Alias[] {
  return [{ find: new RegExp(`^${escapeRegExp(tokensModule)}$`), replacement: posix.join(tool, tokensEntryFile) }]
}

// What the editor server does with an address: `frame` gives it to the frame
// server, `site` sends the browser to the site under the frame server, and
// null keeps it.
export type FrameRoute = { kind: 'frame' } | { kind: 'site'; location: string } | null

export function frameRoute(url: string): FrameRoute {
  if (url.startsWith(frameBase)) return { kind: 'frame' }
  const site = `/${siteEntry}`
  if (url === site || url.startsWith(`${site}?`)) return { kind: 'site', location: `${frameBase}${url.slice(1)}` }
  return null
}
