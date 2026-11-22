// From a DOM node in a frame to the JSX element of the screen file that made it.
//
// This module reads internal records of React, not a public interface: the
// key `__reactFiber$<random>` on a DOM node, and the fields `type`,
// `memoizedProps`, `return`, `child`, `sibling` and `stateNode` of a record.
// A new React version can need a change here. Keep all such reads in this
// module.
//
// The build step adds
// `data-loc-<line>-<column>={"<file>:<line>:<column> <Tag> <origin>"}` to each
// JSX element of a screen file (see `tools/source-location.ts`). The value is
// read from the props of the record, not from the DOM, because a component
// does not always pass an unknown prop on to the DOM. The identity of an
// element is the location part, `<file>:<line>:<column>`: each compare of two
// elements uses it, not the full value.
//
// A record can carry more than one location: a component that passes its
// props on gives its location to the records below it, and a wrapper that
// clones its child with its own props gives the child its location next to
// the location of the child. The own location of a record is the one that its
// nearest parent with a location does not carry. A record with no own
// location belongs to the element of that parent.
//
// The nodes come from the document of a frame, thus this module uses no
// `instanceof` with the classes of the editor window.
//
// Limit: React keeps two copies of a record, the current one and the old one
// (`alternate`), and sets the record key of a node only when it makes the
// node. `fiberOf` uses the props key, which React sets at each commit, to take
// the current copy of the record of the node. The walks up (`return`) and down
// (`child`, `sibling`) from it can still pass through an old copy in a part of
// the tree that did not render again; on a screen that changes its structure
// after the first render, a node or an index can then be wrong.

import { origins, type Origin } from '../../requests/format.ts'

// The same text as `locationPrefix` in `tools/source-location.ts`: the start
// of the name of each location prop. That module is for Node, thus the editor
// does not import it; a test of the build step checks that the two are equal.
export const locationPrefix = 'data-loc-'

const fiberKeyPrefix = '__reactFiber$'
const propsKeyPrefix = '__reactProps$'

// The fields of a React record that this module reads.
export type Fiber = {
  type: unknown
  memoizedProps: Record<string, unknown> | null
  return: Fiber | null
  child: Fiber | null
  sibling: Fiber | null
  stateNode: unknown
  // The other copy of the record.
  alternate?: Fiber | null
}

export type CodeLocation = { loc: string; file: string; line: number; column: number }

// A place in a screen file, the tag name that is written there (`Stack`,
// `Card.Header`, `div`) and its origin.
// `set` is true for an element that sets a value in the screen file (the
// last word of the value, `setMark`).
export type Site = CodeLocation & { tag: string; origin: Origin; set?: true }

// The same text as `setMark` in `tools/source-location.ts`; a test checks
// that they are equal.
export const setMark = 'set'

// A DOM node, as far as this module reads it.
type NodeLike = object & { parentNode?: unknown }

// The copy of a host record whose props are the props that React set last on
// its node: that copy is the current one.
function currentCopy(fiber: Fiber, props: unknown): Fiber {
  const other = fiber.alternate
  if (!other || props === undefined || fiber.memoizedProps === props) return fiber
  return other.memoizedProps === props ? other : fiber
}

// The React record of a node. A node that React did not make (for example a
// node that a library adds) gives the record of the nearest parent node.
export function fiberOf(node: NodeLike | null | undefined): Fiber | null {
  for (let current = node; current; current = current.parentNode as NodeLike | null | undefined) {
    const key = Object.keys(current).find((name) => name.startsWith(fiberKeyPrefix))
    if (!key) continue
    const values = current as Record<string, unknown>
    const fiber = values[key] as Fiber | undefined
    return fiber ? currentCopy(fiber, values[propsKeyPrefix + key.slice(fiberKeyPrefix.length)]) : null
  }
  return null
}

// The location part, `file:line:column`; the file can have a colon (a Windows
// drive), thus the line and the column are read from the end.
export function parseLocation(loc: string): CodeLocation | null {
  const match = /^(.+):(\d+):(\d+)$/.exec(loc)
  if (!match) return null
  return { loc, file: match[1], line: Number(match[2]), column: Number(match[3]) }
}

// The value of a location prop, `file:line:column Tag origin`, read from the
// end: the last word is the origin, the word before it is the tag, the rest is
// the location (the file can have a space). An element that sets a value in
// the file has the word `set` after the origin. Null for a different text.
export function parseLoc(value: string): Site | null {
  // The last word of a value with no mark is an origin, never `set`.
  const marked = value.endsWith(` ${setMark}`)
  const match = /^(.+) (\S+) (\S+)$/.exec(marked ? value.slice(0, -setMark.length - 1) : value)
  if (!match || !(origins as readonly string[]).includes(match[3])) return null
  const location = parseLocation(match[1])
  if (!location) return null
  return { ...location, tag: match[2], origin: match[3] as Origin, ...(marked ? { set: true as const } : {}) }
}

type NamedType = {
  displayName?: unknown
  name?: unknown
  render?: unknown
  type?: unknown
}

function typeName(type: unknown, depth = 0): string | null {
  if (typeof type === 'string') return type
  if ((typeof type !== 'function' && typeof type !== 'object') || type === null || depth > 3) return null
  const named = type as NamedType
  if (typeof named.displayName === 'string' && named.displayName) return named.displayName
  if (typeof type === 'function') return typeof named.name === 'string' && named.name ? named.name : null
  // `forwardRef` keeps the function in `render`; `memo` keeps the inner type in `type`.
  return typeName(named.render, depth + 1) ?? typeName(named.type, depth + 1)
}

// The tag of a host element (`div`), else the name of the component.
export function fiberName(fiber: Fiber): string {
  return typeName(fiber.type) ?? 'Anonymous'
}

// The sites that a record carries, in the order of its props. A value that
// cannot be read does not count.
function sitesOf(fiber: Fiber): Site[] {
  const props = fiber.memoizedProps
  if (!props) return []
  const result: Site[] = []
  for (const [name, value] of Object.entries(props)) {
    const site = name.startsWith(locationPrefix) && typeof value === 'string' ? parseLoc(value) : null
    if (site) result.push(site)
  }
  return result
}

// `fiber` when it carries a location, else its nearest parent that does.
function nearestLocated(fiber: Fiber | null): Fiber | null {
  for (let current = fiber; current; current = current.return) {
    if (sitesOf(current).length > 0) return current
  }
  return null
}

// The site of `fiber` whose location `parent` (its nearest parent with a
// location) does not carry; null when it carries none or only those of the
// parent.
function newSite(fiber: Fiber, parent: Fiber | null): Site | null {
  const inherited = new Set(parent ? sitesOf(parent).map((site) => site.loc) : [])
  return sitesOf(fiber).find((site) => !inherited.has(site.loc)) ?? null
}

// The element of the screen file for a record: the nearest record with an own
// location. The records below it that carry only its locations (the parts of
// a component that passes its props on) and the records with no location (a
// context provider, an inner part of a library component) belong to it. Null
// when no record up to the root has a location.
export function screenElement(fiber: Fiber | null): Fiber | null {
  for (let current = nearestLocated(fiber); current; ) {
    const parent = nearestLocated(current.return)
    if (newSite(current, parent) !== null) return current
    current = parent
  }
  return null
}

// The screen elements above the screen element of `fiber`, each as its outer
// record, inner first.
export function breadcrumb(fiber: Fiber | null): Fiber[] {
  const result: Fiber[] = []
  for (let current = screenElement(fiber); current; ) {
    const parent = screenElement(current.return)
    if (!parent) break
    result.push(parent)
    current = parent
  }
  return result
}

// The own location of a record, with the tag name and the origin that the
// screen file gives it; null when it has none. The name of the component of
// the record can be different (`fiberName`).
export function siteOf(fiber: Fiber): Site | null {
  return newSite(fiber, nearestLocated(fiber.return))
}

// The first DOM node of a record: its own node for a host element, else the
// first host node of its children, depth first. Null when it renders no node.
export function hostNode(fiber: Fiber): Element | null {
  if (typeof fiber.type === 'string' && fiber.stateNode) return fiber.stateNode as Element
  for (let child = fiber.child; child; child = child.sibling) {
    const node = hostNode(child)
    if (node) return node
  }
  return null
}

// The screen elements whose first DOM node is `node`, inner first. An element
// that renders no node of its own (a component of the screen file that renders
// another element of the file, or a library wrapper that passes its props to
// its child) has the first node of an inner element. An outer element whose
// first node is a different node ends the list: its first node comes before.
export function elementsAt(node: Element): Fiber[] {
  const result: Fiber[] = []
  for (let current = screenElement(fiberOf(node)); current && hostNode(current) === node; ) {
    result.push(current)
    current = screenElement(current.return)
  }
  return result
}

// The screen element with the location `loc` (the location part, with no tag)
// whose first DOM node is `node`; null when there is none.
export function elementOf(node: Element, loc: string): Fiber | null {
  return elementsAt(node).find((element) => siteOf(element)?.loc === loc) ?? null
}
