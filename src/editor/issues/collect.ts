import { useEffect } from 'react'
import type { ScreenEntry } from 'virtual:canvas-screens'
import { renderErrorAttribute } from '../../frame/screen-id.ts'
import { linkTarget, screenPrefix, type LinkNode } from '../../frame/screen-link.ts'
import type { Issue } from '../../requests/format.ts'
import { messageOf, type Token } from '../../tokens/format.ts'
import type { Item } from '../edits/model.ts'
import { edits } from '../edits/store.ts'
import { frameWindowOf } from '../frame-window.ts'
import { targetOf } from '../inspector/edit.ts'
import { inspectorModel } from '../inspector/model.ts'
import type { Site } from '../locate/fiber.ts'
import { codeText } from '../preview/apply.ts'
import { hiddenIn } from '../preview/css.ts'
import { fileErrors } from '../requests/file-errors.ts'
import { screenRendered, sitesIn } from '../selection/pick.ts'
import { useTokenFile } from '../tokens/token-store.ts'
import { frameTokens } from '../tokens/frame-tokens.ts'
import { readStyles } from '../tokens/read-styles.ts'
import { overflowText, screenIssues, type Crossing, type IssueElement } from './model.ts'
import { issues } from './store.ts'

// Reads the Issues list of a screen from its frame document: the screen
// elements (the first copy of each place in the code), their styles with the
// open previews applied, and the text of a render error. The list is read
// again 500 ms after the last change of the frame document: a load, a render,
// and each change of the preview write into the document. The list goes to
// the issues store (`store.ts`).

// A place in the code: the first DOM node of its first visible copy, its
// site, and the count of its copies. `inner` is true when the place is the
// inner element of its node: of the elements that share one first node (a
// local component that returns a library element), only the inner one gives
// the rows of the styles, thus a value is not counted two times.
export type ScreenPlace<N> = { node: N; site: Site; copies: number; inner: boolean }

// The location of the inner screen element of each node: the first site of
// the node, because `sites` are inner first for the elements of one node
// (`sitesIn`).
export function innerLocs<N>(sites: readonly { node: N; site: Site }[]): Map<N, string> {
  const innerOf = new Map<N, string>()
  for (const { node, site } of sites) if (!innerOf.has(node)) innerOf.set(node, site.loc)
  return innerOf
}

// The places of the screen elements of a document, in the sequence of their
// first visible copy. `sites` are in document order, inner first for the
// elements of one node (`sitesIn`); `innerOf` is `innerLocs(sites)`. A place
// whose copies the preview hides all (a removed element) is left out: it goes
// away when the agent applies the request.
export function placesOf<N>(
  sites: readonly { node: N; site: Site }[],
  hidden: (node: N) => boolean,
  innerOf: ReadonlyMap<N, string> = innerLocs(sites),
): ScreenPlace<N>[] {

  const places = new Map<string, { node: N | null; site: Site; copies: number }>()
  for (const { node, site } of sites) {
    let place = places.get(site.loc)
    if (!place) {
      place = { node: null, site, copies: 0 }
      places.set(site.loc, place)
    }
    place.copies += 1
    if (place.node === null && !hidden(node)) place.node = node
  }

  const result: ScreenPlace<N>[] = []
  for (const { node, site, copies } of places.values()) {
    if (node !== null) result.push({ node, site, copies, inner: innerOf.get(node) === site.loc })
  }
  return result
}

// The screen elements that go over the right edge of a screen `width` wide,
// scrolled by `scrolled` to the side: each visible copy, not only the first
// copy of a place, because a later item of a list can be the wide one.
export function crossingSites<N>(
  sites: readonly { node: N; site: Site }[],
  hidden: (node: N) => boolean,
  rectOf: (node: N) => { right: number; width: number },
  width: number,
  scrolled: number,
): Crossing[] {
  const crossing: Crossing[] = []
  for (const { node, site } of sites) {
    if (hidden(node)) continue
    const rect = rectOf(node)
    if (rect.width > 0 && rect.right + scrolled - width >= 1) crossing.push({ tag: site.tag, file: site.file, line: site.line, width: rect.width })
  }
  return crossing
}

// The selector of the links to a screen address. It finds each link of the
// document, also a link that a library part draws inside its own nodes.
export const screenLinkSelector = `a[href^="${screenPrefix}"]`

// The addresses of the broken links of a document, by the location of the
// screen element that each link belongs to: the inner screen element of the
// link node or of its nearest parent node that is the first node of a screen
// element. `sites` are as `sitesIn` gives them, `links` are the link nodes,
// `innerOf` is `innerLocs(sites)`. A link to a screen of the list, or to an
// address that is not a screen address, is not broken. A link that the preview
// hides (a removed element), or that belongs to no screen element, is left
// out. Each address comes once for a place, also when its copies have the same
// link.
export function brokenLinks<N extends LinkNode>(
  sites: readonly { node: N; site: Site }[],
  links: readonly N[],
  ids: readonly string[],
  hidden: (node: N) => boolean,
  innerOf: ReadonlyMap<LinkNode, string> = innerLocs<LinkNode>(sites),
): Map<string, string[]> {
  const result = new Map<string, string[]>()
  for (const link of links) {
    const href = link.getAttribute('href')
    if (href === null || hidden(link) || linkTarget(href, ids).kind !== 'unknown-screen') continue
    let loc: string | undefined
    for (let node: LinkNode | null = link; node && loc === undefined; node = node.parentElement) loc = innerOf.get(node)
    if (loc === undefined) continue
    const list = result.get(loc)
    if (!list) result.set(loc, [href])
    else if (!list.includes(href)) list.push(href)
  }
  return result
}

// The issues of a screen from its frame document, with the edits of the
// screen applied as a preview. `ids` are the ids of the list of screens, for
// the links; `relation` is the cause of a broken relation of the screen, or
// null. Null while the screen is not rendered yet and shows no error.
export function collectIssues(
  document: Document,
  items: readonly Item[],
  tokens: readonly Token[],
  ids: readonly string[],
  relation: string | null,
): Issue[] | null {
  const error = document.documentElement.getAttribute(renderErrorAttribute)
  if (error === null && !screenRendered(document)) return null
  const hidden = hiddenIn(items)
  const sites = sitesIn(document)
  const innerOf = innerLocs<Element>(sites)
  const links = brokenLinks(sites, Array.from(document.querySelectorAll(screenLinkSelector)), ids, hidden, innerOf)
  const places = placesOf(sites, hidden, innerOf)
  const elements: IssueElement[] = places.map((place) => ({
    target: targetOf(place.site, place.node.tagName.toLowerCase(), place.copies, codeText(place.node)),
    rows: place.inner ? inspectorModel(readStyles(place.node), tokens).sections.flatMap((section) => section.rows) : [],
    links: links.get(place.site.loc) ?? [],
    set: place.site.set === true,
    ...(place.site.values ? { values: place.site.values } : {}),
  }))
  // The content against the width of the screen. A scroll to the side is
  // what an agent cannot see in its code. A screen with a render error shows
  // the message of the frame, not the screen: its width says nothing.
  // The width of the screen is the width of the frame window, not the width
  // less a scroll bar: a frame that is lower than its content for a moment
  // has a scroll bar at its side.
  const root = document.documentElement
  const frameWindow = frameWindowOf(document)
  const width = frameWindow?.innerWidth ?? root.clientWidth
  let layout: string | null = null
  if (error === null && root.scrollWidth - width >= 1) {
    const scrolled = frameWindow?.scrollX ?? 0
    const crossing = crossingSites(sites, hidden, (node) => node.getBoundingClientRect(), width, scrolled)
    layout = overflowText(width, root.scrollWidth, crossing)
  }
  return screenIssues(elements, error, relation, layout)
}

// The time after the last change of a frame document before its issues are
// read again.
const collectDelay = 500

// Keeps the Issues list of a screen in the issues store. A screen whose file
// cannot be read (an `error` in the list of screens) has no frame document:
// its list is the render error. The cause of a broken relation
// (`relationError` of the entry) is an issue of the list too. `ids` are the
// ids of the list of screens: a new list reads the links again.
export function useIssues(screen: ScreenEntry, document: Document | null, ids: readonly string[]) {
  const { id, error } = screen
  const relation = screen.relationError ?? null
  // New tokens can link a value or take a link away: the list is read again.
  const tokenFile = useTokenFile()
  useEffect(() => {
    if (error !== undefined) {
      issues.set(id, screenIssues([], error, relation))
      return
    }
    const frameWindow = frameWindowOf(document)
    if (!document || !frameWindow) return

    let timer: ReturnType<typeof setTimeout> | undefined
    // An error of the reading shows in the toolbar, as an error of a save:
    // the Issues list and its file then stay old.
    const errorKey = `collect:${id}`
    const run = () => {
      timer = undefined
      // A frame that started to load again: the new document reads its list.
      if (!frameWindowOf(document)) return
      try {
        const list = collectIssues(document, edits.get(id), frameTokens(tokenFile.tokens ?? [], document), ids, relation)
        if (list) issues.set(id, list)
        fileErrors.report(errorKey, null)
      } catch (error) {
        console.error(error)
        fileErrors.report(errorKey, `Cannot read the issues of ${id}: ${messageOf(error)}`)
      }
    }
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(run, collectDelay)
    }

    const observer = new frameWindow.MutationObserver(schedule)
    observer.observe(document, { childList: true, subtree: true, attributes: true, characterData: true })
    // An image or a font that loads later can make the content wider than
    // the screen, and changes no node.
    document.addEventListener('load', schedule, true)
    document.fonts?.addEventListener('loadingdone', schedule)
    schedule()
    return () => {
      observer.disconnect()
      document.removeEventListener('load', schedule, true)
      document.fonts?.removeEventListener('loadingdone', schedule)
      clearTimeout(timer)
      fileErrors.report(errorKey, null)
    }
  }, [id, error, relation, document, tokenFile, ids])
}
