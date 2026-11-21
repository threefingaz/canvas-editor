// The address of a screen in a link: `#/<screen id>`, for example
// `<Button href="#/onboarding/workspace">`. The same address works in the
// prototype site, where the browser changes the hash, and on the canvas, where
// the editor reads the link under the pointer and moves the view.
//
// The editor, the site and the Issues list import this module, thus it has no
// imports and reads no DOM: a node is a plain object with the few fields that
// the lookup reads.

// The start of each screen address.
const screenPrefix = '#/'

// Reads the id from a screen address: the rest after `#/`, decoded, with no
// slash at the end. Gives null for a text that is not a screen address. An
// escape that cannot be decoded gives the raw text, which no screen has; it
// does not throw.
function addressId(href: string): string | null {
  if (!href.startsWith(screenPrefix)) return null
  const raw = href.slice(screenPrefix.length).replace(/\/+$/, '')
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

// Reads the id of the screen from the hash of the address. Gives null for the
// index (``, `#`, `#/`) and for a hash that is not a screen address (`#top`).
export function screenIdFromHash(hash: string): string | null {
  const id = addressId(hash)
  return id ? id : null
}

// Gives the address of a screen: `onboarding/welcome` gives
// `#/onboarding/welcome`. Each part of the path is encoded, thus
// `screenIdFromHash` gives the id back.
export function screenHash(id: string): string {
  return screenPrefix + id.split('/').map(encodeURIComponent).join('/')
}

export type LinkTarget =
  | { kind: 'screen'; id: string }
  | { kind: 'unknown-screen'; id: string }
  // An address that is not a screen address: no address, `#`, `#top`, `#/`
  // (the index of the site), a web address, `mailto:`.
  | { kind: 'other' }

// Gives the target of a link address, with the ids of the list of screens.
export function linkTarget(href: string | null, ids: readonly string[]): LinkTarget {
  const id = href === null ? null : addressId(href)
  if (!id) return { kind: 'other' }
  return ids.includes(id) ? { kind: 'screen', id } : { kind: 'unknown-screen', id }
}

// The fields of a DOM element that `linkAt` reads.
export type LinkNode = {
  localName: string
  getAttribute(name: string): string | null
  parentElement: LinkNode | null
}

// Gives the target of the link of a node: the node itself or its nearest
// parent that is a link (an `a` element with an `href`, also the `a` of SVG).
// Gives null when no node up to the root is a link. Only an `a` counts: other
// elements have an `href` too (the `use` of an icon), and they are not links.
export function linkAt(node: LinkNode | null, ids: readonly string[]): LinkTarget | null {
  for (let current = node; current; current = current.parentElement) {
    if (current.localName !== 'a') continue
    const href = current.getAttribute('href')
    if (href !== null) return linkTarget(href, ids)
  }
  return null
}
