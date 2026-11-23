import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { posix } from 'node:path'
import { defineConfig, normalizePath, type UserConfig } from 'vite'
import { config } from './canvas.config.ts'
import { frameBase } from './src/frame/screen-id.ts'
import { agentPlugin } from './tools/agent-plugin.ts'
import { libraryPlugin } from './tools/library-plugin.ts'
import { packOf, providerPath, readPackState } from './tools/pack.ts'
import { packPlugin } from './tools/pack-plugin.ts'
import { readProjectSettings } from './tools/project-config.ts'
import { projectPlugin } from './tools/project-plugin.ts'
import { cacheMatcher, currentProject, distFolder, guidePathOf, hostProblem, hostRoot, toolRoot } from './tools/project.ts'
import { nodeResolver, reactAliases, roleOf, toolAliases, type Role } from './tools/react-resolve.ts'
import { requestsPlugin } from './tools/requests-plugin.ts'
import { screensPlugin } from './tools/screens-plugin.ts'
import { siteEntry, sitePlugin } from './tools/site-plugin.ts'
import { sourceLocationPlugin } from './tools/source-location-plugin.ts'
import { tokensPlugin } from './tools/tokens-plugin.ts'

// Three entries: `index.html` is the editor (at `/`), `frame.html` is one
// screen in a frame of the canvas, `site.html` is the prototype site. The
// build has only the site: the editor and the frame need the dev server (the
// element-to-code step and the file API). The site plugin writes the built
// `site.html` as `index.html`.
//
// The command of the tool (`bin/canvas.js`, `tools/dev.ts`, `tools/build.ts`)
// gives this file to Vite as its config file, also when a different folder is
// the current one; plain `vite` reads it too. `root` is the folder of the
// tool (`toolRoot`, the folder of this file), thus the root of Vite is the
// folder of the tool in each way.
const root = toolRoot

// The config of the tool. The project (`tools/project.ts`) is the folder of
// the content: the command sets `CANVAS_PROJECT`, and with no variable it is
// the nearest folder upward from the current one with a `canvas.config.ts`,
// else the tool. Each plugin reads the content from the project, not from the
// root of Vite; `widths` and `agent` come from the `canvas.config.ts` of the
// project when it has one (`tools/project-config.ts`). The host is the folder
// where the agent works; the fixed sentence names the guide relative to it.
//
// The library pack (`packs/<name>/` of the project) is read each time Vite
// reads the config and given to each plugin that needs it; null when no
// library is connected. An error of the pack state (two packs, a manifest that
// is not valid) stops the server or the build. The pack plugin restarts the
// dev server when the pack changes, and the config is read again.
//
// `canvas dev` has two servers on one origin (`tools/react-resolve.ts`,
// `tools/dev.ts`), and the role of each one decides its part of the config:
//
// - `editor`: the editor (`index.html`) on the React of the tool
//   (`resolve.dedupe`), with the list of the screens, the file API, the agent,
//   the token file and the pack. Its cache is `.canvas/vite-editor` of the
//   project.
// - `frame`: the frames and the site, below `/__frame/`, on the React of the
//   project (`reactAliases`: the project, then the tool), with the place in
//   the code of each element, the wrapper of the library, the list and the
//   modules of the screens, and the pack. Its cache is `.canvas/vite-frame`.
//   The build of the site has this role too.
//
// Each plugin runs in the server whose pages need it, thus each event of the
// file watcher is handled one time for each kind of page. The list of the
// screens, the pack (each server restarts itself) and the watch of the
// project are in the two.
export async function canvasConfig(role: Role, command: 'build' | 'serve'): Promise<UserConfig> {
  const project = currentProject()
  const host = hostRoot(project, existsSync)
  const settings = await readProjectSettings(project)
  const guide = guidePathOf(project, host)
  const pack = packOf(readPackState(project))
  const work = posix.join(project, config.work)
  const input = { site: posix.join(root, siteEntry) }
  const shared: UserConfig = {
    root,
    server: {
      // The dev server serves the files of the tool, of the project and of
      // the host (a library that is a folder of the host, its packages). A
      // host that is the home folder or the root of the file system
      // (`hostProblem`) is left out: it would serve each file there.
      fs: { allow: hostProblem(host, homedir()) === null ? [root, project, host] : [root, project] },
      // The caches of the dependency step in the work folder of the project
      // are no events.
      watch: { ignored: [cacheMatcher(project, config.work)] },
    },
    // The site is built into `dist/` of the project. Vite empties a folder
    // outside its root only when it is told to.
    build: {
      outDir: posix.join(project, distFolder),
      emptyOutDir: true,
      rolldownOptions: { input },
    },
  }
  if (role === 'frame') {
    const provider = pack === null ? [] : [normalizePath(providerPath(pack, project))]
    return {
      ...shared,
      // The source location step runs before the React plugin (dev server
      // only). The library plugin gives the frame and the site the wrapper of
      // the library pack. The screens plugin gives the list and the modules
      // of the screens, and reloads the frames of a changed screen. The pack
      // plugin restarts this server when the pack changes; the project plugin
      // adds the project to its file watcher (dev server only). The site
      // plugin writes the entry of the site as `index.html` (build only).
      plugins: [
        sourceLocationPlugin(pack, project, host),
        react(),
        screensPlugin(pack, { project, widths: settings.widths, guide, frames: true }),
        libraryPlugin(pack, project),
        packPlugin(pack, project, 'frame server'),
        projectPlugin(project),
        sitePlugin(),
      ],
      resolve: { alias: [...reactAliases([nodeResolver(project), nodeResolver(root)]), ...toolAliases(root)] },
      cacheDir: posix.join(work, 'vite-frame'),
      // Relative addresses in the built site, thus its folder works at each
      // address of a static host, also in a sub folder. In the dev server the
      // frame server is below `/__frame/` of the editor server.
      base: command === 'build' ? './' : frameBase,
      // The dependency step finds the packages to prepare in the entries, the
      // screens and the wrapper of the project: with no list it would find
      // the packages of a screen when its frame first loads, prepare them and
      // reload the frames.
      optimizeDeps: {
        entries: ['frame.html', siteEntry, posix.join(project, config.screens, '**/*.tsx'), ...provider],
      },
    }
  }
  return {
    ...shared,
    // The agent plugin starts the command that opens the chat of the agent;
    // it is before the requests plugin, which answers 404 for each other
    // address of the file API. The tokens plugin gives the editor the token
    // file and writes it again after a change in the library folder. The
    // pack plugin restarts this server when the pack changes. Each is for the
    // dev server only.
    plugins: [
      react(),
      tailwindcss(),
      screensPlugin(pack, { project, widths: settings.widths, guide, frames: false }),
      agentPlugin({ host, agent: settings.agent, guide }),
      requestsPlugin({ project, widths: settings.widths }),
      tokensPlugin(pack, project, host),
      packPlugin(pack, project, 'dev server'),
      projectPlugin(project),
    ],
    // The React of the tool for the editor and for each package of the
    // editor, also when the project has a React of its own.
    resolve: { dedupe: ['react', 'react-dom'] },
    cacheDir: posix.join(work, 'vite-editor'),
    // The dependency step finds the packages of the editor in its entry; with
    // no list it reads only the input of the build, the site.
    optimizeDeps: { entries: ['index.html'] },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => canvasConfig(roleOf(command, mode), command))
