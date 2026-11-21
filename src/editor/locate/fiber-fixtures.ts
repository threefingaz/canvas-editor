// Test helpers for the modules that read React records: plain objects in place
// of the records, and the location prop that the build step writes.

import type { Origin } from '../../requests/format.ts'
import { locationPrefix, type Fiber } from './fiber.ts'

// A plain object in place of a React record. `parent` links it as the child
// of that record, after the children that the parent already has.
export function record(
  type: unknown,
  props: Record<string, unknown> | null = null,
  parent: Fiber | null = null,
  stateNode: unknown = null,
): Fiber {
  const fiber: Fiber = { type, memoizedProps: props, return: parent, child: null, sibling: null, stateNode }
  if (parent) {
    if (!parent.child) parent.child = fiber
    else {
      let last = parent.child
      while (last.sibling) last = last.sibling
      last.sibling = fiber
    }
  }
  return fiber
}

// The location prop of an element, as the build step writes it: the location
// `file:line:column`, the tag name and the origin.
export const loc = (location: string, tag = 'Element', origin: Origin = 'local') => ({
  [`${locationPrefix}${location.split(':').slice(-2).join('-')}`]: `${location} ${tag} ${origin}`,
})
