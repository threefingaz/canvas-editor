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

// Gives the key of the screen module in the list of `import.meta.glob`, or null
// when no module has this id. The id is only a key in this list, thus an id
// that points out of the screens folder finds no module. The folder is a
// literal here and in the globs of `main.tsx` and of
// `src/site/ScreenPage.tsx`; a test checks that it is the folder of
// `canvas.config.ts`.
export function screenModuleKey(id: string, keys: readonly string[]): string | null {
  const key = `/screens/${id}.tsx`
  return keys.includes(key) ? key : null
}
