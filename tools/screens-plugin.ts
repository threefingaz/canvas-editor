// The virtual module `virtual:canvas-screens`: the list of the screen files,
// for the editor and the prototype site, and the library pack (its name, or
// null when no library is connected). It reads each file with a parser and
// never imports it.
//
// It also handles a change in the screens folder. A screen file exports `meta`
// and a component, thus the dev server cannot replace it in place, and its
// usual answer is a reload of each page, the editor too. In place of that, the
// plugin tells the pages which screens changed, and only the frames of those
// screens (`src/frame/main.tsx`) and a site page that shows one of them
// (`src/site/ScreenPage.tsx`) reload. The editor and the index of the site
// (`src/site/Site.tsx`, `src/site/Index.tsx`) get a new list of screens from
// the virtual module when a file is added or removed, or when its `meta`
// changes, with no reload.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { normalizePath, type Plugin } from 'vite'
import { config } from '../canvas.config.ts'
import { screensChangedEvent } from '../src/frame/screen-id.ts'
import type { Pack } from './pack.ts'
import {
  affectedScreenIds,
  inFolder,
  libraryInfo,
  screenExtension,
  screenIdOf,
  screenList,
  screensModuleCode,
  type LibraryInfo,
  type ScreenFile,
} from './screens.ts'

const publicId = 'virtual:canvas-screens'
const resolvedId = `\0${publicId}`

// The screen files in the folder, as paths in it with `/` between the parts:
// 'onboarding/welcome.tsx'.
export function screenNames(folder: string): string[] {
  if (!existsSync(folder)) return []
  return readdirSync(folder, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith(screenExtension))
    .map((name) => name.split(sep).join('/'))
}

export function readScreenFiles(root: string, folder: string): ScreenFile[] {
  return screenNames(folder).map((name) => {
    const path = join(folder, name)
    return { file: relative(root, path).split(sep).join('/'), code: readFileSync(path, 'utf8') }
  })
}

export function screensPlugin(pack: Pack | null): Plugin {
  let root = process.cwd()
  // The absolute path of the screens folder, with `/` between the parts.
  let folder = normalizePath(join(root, config.screens))
  // The code that the module gave last, to skip an update when a change of a
  // screen file does not change the list (an edit outside `meta`).
  let lastCode: string | undefined
  // The library pack, which the Vite config reads once.
  const library: LibraryInfo = libraryInfo(pack)

  const moduleCode = () => screensModuleCode(screenList(readScreenFiles(root, folder), undefined, undefined, pack?.package ?? null), library)

  return {
    name: 'canvas-screens',
    configResolved(resolved) {
      root = resolved.root
      folder = normalizePath(join(root, config.screens))
    },
    resolveId(id) {
      if (id === publicId) return resolvedId
    },
    load(id) {
      if (id !== resolvedId) return
      lastCode = moduleCode()
      return lastCode
    },
    hotUpdate: {
      // After the plugins of the dev server, thus the module of
      // `import.meta.glob` that they add for a new file is in `modules` too.
      order: 'post',
      handler({ type, file, modules }) {
        if (this.environment.name !== 'client' || !inFolder(file, folder)) return
        const graph = this.environment.moduleGraph
        // A file that is added or removed changes the list of `import.meta.glob`
        // in the frame entry: the next frame that loads must get the new list.
        if (type !== 'update') {
          for (const module of modules) graph.invalidateModule(module)
        }
        const ids = affectedScreenIds(file, modules, folder)
        if (ids.length > 0) this.environment.hot.send(screensChangedEvent, { ids })

        // The editor updates only when the list of screens changes. The
        // virtual module is the one module that this update gives to the
        // editor; no other module reloads.
        const listModule = graph.getModuleById(resolvedId)
        if (screenIdOf(file, folder) === null || !listModule) return []
        const code = moduleCode()
        if (code === lastCode) return []
        lastCode = code
        graph.invalidateModule(listModule)
        return [listModule]
      },
    },
  }
}
