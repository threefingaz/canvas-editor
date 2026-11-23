// The virtual module of `tools/screens-plugin.ts`: the list of the screen
// files, read with a parser, and the library pack. The editor imports it in
// place of the screens and of the pack.
declare module 'virtual:canvas-screens' {
  export type ScreenEntry = import('../tools/screens.ts').ScreenEntry
  export const screens: ScreenEntry[]
  // The name of the library pack, or null when no library is connected.
  export const library: import('../tools/screens.ts').LibraryInfo
  // The `flow.json` files that are not valid; the row of such a flow is by
  // name.
  export const flowErrors: import('../tools/flow.ts').FlowError[]
  // The widths of a frame, and the path of the guide of the project for the
  // fixed sentence (relative to the folder where the agent works).
  export const project: import('../tools/screens.ts').ProjectInfo
}

// The virtual module of `tools/screens-plugin.ts` in the frame server and the
// build: the loader of the module of each screen, by its id
// (`tools/screen-modules.ts`).
declare module 'virtual:canvas-screen-modules' {
  export const modules: Record<string, () => Promise<{ default: import('react').ComponentType }>>
}

// The virtual module of `tools/tokens-plugin.ts` in the editor server: the
// text of `tokens.json` of the project, or null when it has none.
declare module 'virtual:canvas-tokens' {
  const text: string | null
  export default text
}
