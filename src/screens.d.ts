// The virtual module of `tools/screens-plugin.ts`: the list of the screen
// files, read with a parser, and the library pack. The editor imports it in
// place of the screens and of the pack.
declare module 'virtual:canvas-screens' {
  export type ScreenEntry = import('../tools/screens.ts').ScreenEntry
  export const screens: ScreenEntry[]
  // The name of the library pack, or null when no library is connected.
  export const library: import('../tools/screens.ts').LibraryInfo
}
