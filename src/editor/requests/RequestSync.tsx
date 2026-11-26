import { useRequestSync, type ScreenRef } from './sync.ts'

// Keeps the edits of the editor and the request files of `list` the same, and
// writes the issues files of `list` (`useRequestSync`). It renders nothing.
//
// It is a component of its own, in a module that does not import
// `virtual:canvas-screens`, not a hook of `App`: a hot update of the list
// refreshes `App.tsx` in place, and a refresh runs each effect of the
// refreshed components again, with no regard to their dependencies. In `App`
// the syncs would then stop and start again at each new list: a hold of a
// screen action, the bases of its new ids and each save that waits would be
// lost. A child of a module that the update does not change keeps its
// effects, and only gets the new list.
export function RequestSync({ list }: { list: readonly ScreenRef[] }) {
  useRequestSync(list)
  return null
}
