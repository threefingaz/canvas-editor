// The virtual module `virtual:canvas-screens`: the list of the screen files,
// for the editor and the prototype site, and the library pack (its name, or
// null when no library is connected). It reads each file with a parser and
// never imports it.
//
// It also handles a change in the screens folder, and a change of an own
// component of the project (the components folder): the frames of the
// screens that import the changed file reload. A screen file exports `meta`
// and a component, thus the dev server cannot replace it in place, and its
// usual answer is a reload of each page, the editor too. In place of that, the
// plugin tells the pages which screens changed, and only the frames of those
// screens (`src/frame/main.tsx`) and a site page that shows one of them
// (`src/site/ScreenPage.tsx`) reload. The editor and the index of the site
// (`src/site/Site.tsx`, `src/site/Index.tsx`) get a new list of screens from
// the virtual module when a file is added or removed, or when its `meta`
// changes, with no reload. A `flow.json` in the folder (`tools/flow.ts`) gives
// the sequence of a row: a change of it gives the editor a new list too, and
// reloads no frame.
//
// The level of the library (`levelOf` in `pack.ts`) depends on the token
// file of the project: a change of that file gives the editor a new list when
// the level changes.
//
// The screens are in the screens folder of the project (`project.ts`), and
// each path of the list is relative to the project. The module also gives the
// editor the settings of the project that it needs (`project`): the widths of
// a frame, and the path of the guide for the fixed sentence.
//
// The plugin runs in the two servers of `canvas dev` (`react-resolve.ts`):
// each server gives the list to its own pages (the editor; the index of the
// site). With `frames`, in the frame server and the build, it also gives
// `virtual:canvas-screen-modules` (`screen-modules.ts`), the loader of each
// screen file, and tells the frames and the site pages which screens changed.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { normalizePath, type Plugin } from 'vite'
import { config } from '../canvas.config.ts'
import { screensChangedEvent } from '../src/frame/screen-id.ts'
import { parseTokens } from '../src/tokens/format.ts'
import { flowErrors, flowFileName, type FlowFile } from './flow.ts'
import type { Pack } from './pack.ts'
import { screenModulesCode, screenModulesId } from './screen-modules.ts'
import {
  affectedScreenIds,
  inFolder,
  libraryInfo,
  screenExtension,
  screenIdOf,
  screenList,
  screensModuleCode,
  type LibraryInfo,
  type ProjectInfo,
  type ScreenFile,
} from './screens.ts'

const publicId = 'virtual:canvas-screens'
const resolvedId = `\0${publicId}`
const resolvedModulesId = `\0${screenModulesId}`

// The files in the folder and its sub folders, as paths in it with `/`
// between the parts. A folder (also one whose name ends with `.tsx`) and a
// path that cannot be read (a link to nothing) are left out.
function filesIn(folder: string): string[] {
  if (!existsSync(folder)) return []
  return readdirSync(folder, { recursive: true, encoding: 'utf8' })
    .filter((name) => {
      try {
        return statSync(join(folder, name)).isFile()
      } catch {
        return false
      }
    })
    .map((name) => name.split(sep).join('/'))
}

// The screen files in the folder, as paths in it with `/` between the parts:
// 'onboarding/welcome.tsx'.
export function screenNames(folder: string): string[] {
  return filesIn(folder).filter((name) => name.endsWith(screenExtension))
}

// The text of a file that the list of the folder named, or null when it is
// gone since (a fast change of the screens folder); each other error throws.
function readListed(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export function readScreenFiles(root: string, folder: string): ScreenFile[] {
  return screenNames(folder).flatMap((name) => {
    const path = join(folder, name)
    const code = readListed(path)
    return code === null ? [] : [{ file: relative(root, path).split(sep).join('/'), code }]
  })
}

// The `flow.json` files in the folder, also in a sub folder, with the flow of
// each. `root` is the project root.
export function readFlowFiles(root: string, folder: string): FlowFile[] {
  return filesIn(folder)
    .filter((name) => isFlowName(name))
    .flatMap((name) => {
      const path = join(folder, name)
      const text = readListed(path)
      if (text === null) return []
      return [{ flow: name.slice(0, -flowFileName.length).replace(/\/$/, ''), file: relative(root, path).split(sep).join('/'), text }]
    })
}

// The tokens of the token file, or null when there is no file or a file that
// is not valid (`levelOf` in `pack.ts`).
export function readTokenList(file: string): unknown[] | null {
  try {
    return parseTokens(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    return null
  }
}

// True for a path that ends in `flow.json` as a whole file name.
export function isFlowName(path: string): boolean {
  return path === flowFileName || path.endsWith(`/${flowFileName}`)
}

// What the plugin does for one change of a file (pure):
//
// - `invalidateModules`: invalidate `virtual:canvas-screen-modules` (a screen
//   file is added or removed, frame server only). It is never returned: the
//   frame entry calls `createRoot`, and an update would reload each page.
// - `send`: the ids of the changed screens for `screensChangedEvent` (frame
//   server only), or null for no event.
// - `result`: what the hook gives back. `pass` gives nothing (the usual
//   update of the other plugins), `none` an empty list (no module updates),
//   `list` the list module alone (a screen file or a `flow.json`: the editor
//   gets a new list, no frame reloads), `withList` the modules of the update
//   and the list module (the token file, when the level changes; its own
//   module is updated by `tokens-plugin.ts`).
//
// `listChanged` builds the code of the list again and tells whether it
// differs from the code that the module gave last; it is called only when the
// change can change the list. `affected` gives the ids of the screens that
// the file changes (`affectedScreenIds`).
export type ScreensUpdate = { invalidateModules: boolean; send: string[] | null; result: 'pass' | 'none' | 'list' | 'withList' }

export type UpdateInput = {
  file: string
  type: 'create' | 'update' | 'delete'
  folder: string
  tokenFile: string
  frames: boolean
  // The folder of the own components of the project.
  components: string
  listChanged: () => boolean
  affected: () => string[]
}

export function screensUpdate({ file, type, folder, tokenFile, frames, components, listChanged, affected }: UpdateInput): ScreensUpdate {
  const nothing: ScreensUpdate = { invalidateModules: false, send: null, result: 'pass' }
  if (file === tokenFile) return { ...nothing, result: listChanged() ? 'withList' : 'pass' }
  // An own component: the frames of the screens that import it reload, as
  // for a shared file of the screens folder, thus the editor reads the new
  // places of its elements from a new document.
  if (inFolder(file, components)) {
    const ids = frames ? affected() : []
    return ids.length > 0 ? { invalidateModules: false, send: ids, result: 'none' } : nothing
  }
  if (!inFolder(file, folder)) return nothing
  const isScreen = screenIdOf(file, folder) !== null
  const ids = frames ? affected() : []
  const list = (isScreen || isFlowName(file)) && listChanged()
  return {
    invalidateModules: frames && isScreen && type !== 'update',
    send: ids.length > 0 ? ids : null,
    result: list ? 'list' : 'none',
  }
}

// The project root (with `/` between the parts), the widths of its config,
// the path of its guide relative to the host root, and `frames`: true in the
// frame server and the build.
export type ScreensOptions = { project: string; widths: readonly number[]; guide: string; frames: boolean }

export function screensPlugin(pack: Pack | null, { project, widths, guide, frames }: ScreensOptions): Plugin {
  const root = project
  // The absolute path of the screens folder, with `/` between the parts.
  const folder = normalizePath(join(root, config.screens))
  // The code that the module gave last, to skip an update when a change of a
  // screen file does not change the list (an edit outside `meta`).
  let lastCode: string | undefined
  // The token file of the project: the level of the library depends on it.
  const tokenFile = normalizePath(join(root, config.tokens))
  const componentsFolder = normalizePath(join(root, config.components))
  const info: ProjectInfo = { widths, guide }

  const moduleCode = () => {
    const flows = readFlowFiles(root, folder)
    // The library pack, which the Vite config reads once, with its level.
    const library: LibraryInfo = libraryInfo(pack, readTokenList(tokenFile))
    return screensModuleCode(
      screenList(readScreenFiles(root, folder), widths, undefined, null, flows),
      library,
      flowErrors(flows),
      info,
    )
  }

  const modulesCode = () =>
    screenModulesCode(
      screenNames(folder).map((name) => ({ id: name.slice(0, -screenExtension.length), path: `${folder}/${name}` })),
    )

  return {
    name: 'canvas-screens',
    resolveId(id) {
      if (id === publicId) return resolvedId
      if (frames && id === screenModulesId) return resolvedModulesId
    },
    load(id) {
      if (id === resolvedModulesId) return modulesCode()
      if (id !== resolvedId) return
      lastCode = moduleCode()
      return lastCode
    },
    hotUpdate: {
      // After the plugins of the dev server, thus the module of
      // `import.meta.glob` that they add for a new file is in `modules` too.
      order: 'post',
      handler({ type, file, modules, timestamp }) {
        if (this.environment.name !== 'client') return
        const graph = this.environment.moduleGraph
        const listModule = graph.getModuleById(resolvedId)
        const path = normalizePath(file)
        const update = screensUpdate({
          file: path,
          type,
          folder,
          tokenFile,
          frames,
          components: componentsFolder,
          listChanged: () => {
            if (!listModule) return false
            const code = moduleCode()
            if (code === lastCode) return false
            lastCode = code
            return true
          },
          affected: () => affectedScreenIds(path, modules, folder),
        })
        const modulesModule = graph.getModuleById(resolvedModulesId)
        // The time of the update gives the address of the map a new query in a
        // module that imports it again (the screen page of the site).
        if (update.invalidateModules && modulesModule) graph.invalidateModule(modulesModule, new Set(), timestamp, true)
        if (update.send !== null) this.environment.hot.send(screensChangedEvent, { ids: update.send })
        if (update.result !== 'pass' && update.result !== 'none' && listModule) graph.invalidateModule(listModule)
        switch (update.result) {
          case 'pass':
            return
          case 'none':
            return []
          case 'list':
            return [listModule!]
          case 'withList':
            return [...modules, listModule!]
        }
      },
    },
  }
}
