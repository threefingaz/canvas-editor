// The config of the canvas tool. Plain data only: the editor and the Node
// tools read it, and it must not load the library. All that is specific to
// the library is in its pack, `packs/<name>/`, which the tool finds by itself
// (`tools/pack.ts`).

export type CanvasConfig = {
  // The frame widths that a screen can have, in px.
  widths: readonly number[]
  // The folder of the screen files, relative to the project root.
  screens: string
  // The token file, relative to the project root.
  tokens: string
  // The work folder of the tool (request and issues files), relative to the
  // project root. Git ignores it.
  work: string
}

export const config = {
  widths: [1440, 1024, 390],
  screens: 'screens',
  tokens: 'tokens.json',
  work: '.canvas',
} as const satisfies CanvasConfig
