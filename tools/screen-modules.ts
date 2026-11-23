// The virtual modules that give a frame, the site and the editor the files of
// the project, in place of a literal glob below the root of Vite. The project
// can be a folder outside the tool (`project.ts`), and a glob of Vite reads
// only below its root.
//
// - `virtual:canvas-screen-modules`: a map from the id of each screen to a
//   function that imports its file by its absolute path. The screens plugin
//   writes it from the files of the screens folder (`screens-plugin.ts`); the
//   frame entry and the screen page of the site import it.
// - `virtual:canvas-tokens`: the text of `tokens.json` of the project, or null
//   when it has none. The tokens plugin writes it and updates it when the file
//   changes (`tokens-plugin.ts`); the editor imports it.
//
// The functions here are pure: they give the text of each module.

export const screenModulesId = 'virtual:canvas-screen-modules'
export const tokensModuleId = 'virtual:canvas-tokens'

// One screen file: its id, and its absolute path with `/` between the parts.
export type ScreenModuleFile = { id: string; path: string }

// The text of `virtual:canvas-screen-modules`, in the sequence of the ids.
// Vite resolves an absolute path that exists in the dev server (an address
// `/@fs/…` for a file outside its root) and in the build. The map is built
// with `Object.fromEntries`, thus each id is an own key, also a name such as
// `__proto__`.
export function screenModulesCode(files: readonly ScreenModuleFile[]): string {
  const lines = [...files]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(({ id, path }) => `  [${JSON.stringify(id)}, () => import(${JSON.stringify(path)})],`)
  return `export const modules = Object.fromEntries([\n${lines.join('\n')}\n])\n`
}

// The text of `virtual:canvas-tokens`.
export function tokensModuleCode(text: string | null): string {
  return `export default ${JSON.stringify(text)}\n`
}
