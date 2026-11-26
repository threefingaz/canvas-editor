import type { ScreenEntry } from 'virtual:canvas-screens'
import { screenIdFromHash, screenPrefix } from '../frame/screen-link.ts'

// The page of the prototype site for the hash of the address: the index of the
// screens, one screen, or the message for an id that no screen has.
export type Route =
  | { kind: 'index' }
  | { kind: 'screen'; screen: ScreenEntry }
  // `address`: the hash as the address has it, which the page shows: an
  // escape that cannot be decoded stays as it was written.
  | { kind: 'unknown'; id: string; address: string }

// No hash, `#`, `#/` and a hash that is not a screen address (`#top`) give the
// index; `#/<screen id>` gives that screen when the list has it. The site
// reads a hash that is not a screen address only when it opens: after that,
// such a hash keeps the current page (`changesPage`).
export function routeOf(hash: string, screens: readonly ScreenEntry[]): Route {
  const id = screenIdFromHash(hash)
  if (id === null) return { kind: 'index' }
  const screen = screens.find((entry) => entry.id === id)
  return screen ? { kind: 'screen', screen } : { kind: 'unknown', id, address: hash }
}

// The hash of an address: the text from the first `#`, also a lone `#`, which
// `location.hash` gives as an empty text. Empty for an address with no hash.
export function hashOf(href: string): string {
  const at = href.indexOf('#')
  return at === -1 ? '' : href.slice(at)
}

// True when a new hash goes to a different page: no hash (the index) and a
// hash that starts with `#/` (the index or a screen). A different hash (`#`,
// `#top`) is a place on the current page, for example a placeholder link
// `href="#"` or an anchor in a screen: the page stays.
export function changesPage(hash: string): boolean {
  return hash === '' || hash.startsWith(screenPrefix)
}

// The titles of the index and of the page for an unknown id: the heading of
// the page and the title of the browser tab. `site.html` has the title of the
// index before the site renders.
export const indexTitle = 'Screens'
export const unknownTitle = 'Unknown screen'

// The title of the browser tab for a route.
export function titleOf(route: Route): string {
  if (route.kind === 'screen') return route.screen.title
  if (route.kind === 'unknown') return unknownTitle
  return indexTitle
}
