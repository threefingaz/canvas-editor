import type { ScreenEntry } from 'virtual:canvas-screens'
import { screenIdFromHash } from '../frame/screen-link.ts'

// The page of the prototype site for the hash of the address: the index of the
// screens, one screen, or the message for an id that no screen has.
export type Route =
  | { kind: 'index' }
  | { kind: 'screen'; screen: ScreenEntry }
  | { kind: 'unknown'; id: string }

// No hash, `#`, `#/` and a hash that is not a screen address (`#top`) give the
// index; `#/<screen id>` gives that screen when the list has it.
export function routeOf(hash: string, screens: readonly ScreenEntry[]): Route {
  const id = screenIdFromHash(hash)
  if (id === null) return { kind: 'index' }
  const screen = screens.find((entry) => entry.id === id)
  return screen ? { kind: 'screen', screen } : { kind: 'unknown', id }
}
