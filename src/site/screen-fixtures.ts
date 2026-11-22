import type { ScreenEntry } from 'virtual:canvas-screens'

// A screen of the list for the tests of the site: the flow and the name come
// from the id, the title is the id.
export function screenEntry(id: string): ScreenEntry {
  const slash = id.lastIndexOf('/')
  return {
    id,
    flow: slash === -1 ? '' : id.slice(0, slash),
    name: id.slice(slash + 1),
    title: id,
    width: 1440,
    file: `screens/${id}.tsx`,
    links: [],
  }
}
