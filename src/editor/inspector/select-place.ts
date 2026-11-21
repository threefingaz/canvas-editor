import { edits } from '../edits/store.ts'
import { hiddenIn } from '../preview/css.ts'
import { findAgain, nodesAt } from '../selection/pick.ts'
import { selection } from '../selection/store.ts'

// Selects the first visible copy of a place in the code (`loc`) in the frame
// document of a screen, for a click on an item of the Changes list or of the
// Issues list. A copy that a remove edit hides cannot be selected. Gives false
// when no copy is visible.
export function selectPlace(screenId: string, document: Document, loc: string): boolean {
  const hidden = hiddenIn(edits.get(screenId))
  const index = nodesAt(document, loc).findIndex((node) => !hidden(node))
  const picked = index === -1 ? null : findAgain(document, loc, index)
  if (picked) selection.select({ ...picked, screenId })
  return picked !== null
}
