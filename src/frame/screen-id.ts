// The screen of a frame comes from the address: `frame.html?screen=<id>`.
// The id is the path of the screen file in the screens folder, with no
// extension, for example `onboarding/welcome`.
//
// The dev server, the frame and the editor import this module, thus it has no
// imports and reads no DOM.

// The event of the dev server to the frames, with the ids of the changed
// screens (`tools/screens-plugin.ts`).
export const screensChangedEvent = 'canvas:screens-changed'

// The attribute on the root element of a frame document with the text of the
// error of the screen, while the screen shows its error (`RenderError.tsx`).
// The editor reads it for the Issues list.
export const renderErrorAttribute = 'data-canvas-error'

// Reads the id of the screen from the search part of the address. Gives null
// when there is no `screen` parameter or when it is empty.
export function screenIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get('screen')
  return id ? id : null
}

// The address of the frame server (`tools/react-resolve.ts`): the editor
// server gives each address below it to the server of the frames and the
// site, which runs on the React of the project.
export const frameBase = '/__frame/'

// The address of the frame of a screen.
export function frameAddress(id: string): string {
  return `${frameBase}frame.html?${new URLSearchParams({ screen: id })}`
}

// The loader of the module of a screen in the map of
// `virtual:canvas-screen-modules` (`tools/screen-modules.ts`), or null when no
// screen file has this id. The id is only a key of the map, thus an id that
// points out of the screens folder finds no module.
export function screenLoader<T>(id: string, modules: Readonly<Record<string, T>>): T | null {
  return Object.hasOwn(modules, id) ? modules[id] : null
}
