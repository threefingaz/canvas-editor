import type { Target } from '../../requests/format.ts'
import { targetOf } from '../inspector/edit.ts'
import type { Site } from '../locate/fiber.ts'
import { codeText } from '../preview/apply.ts'
import { nodesAt } from './pick.ts'
import type { Selected } from './store.ts'

// The target of an edit of the selected element, read from the frame at the
// time of the edit: the count of copies and the text can change. The tag of
// the first DOM node is the `element`, and the label is the text as the code
// renders it: a text edit of the preview does not change the label, thus the
// edit is found again after a reload. The caller gives the width of the frame
// to the edit; this module imports no screen list.
export function selectionTarget(selected: Pick<Selected, 'node' | 'loc'>, site: Site): Target {
  const copies = nodesAt(selected.node.ownerDocument, selected.loc).length
  return targetOf(site, selected.node.tagName.toLowerCase(), Math.max(copies, 1), codeText(selected.node))
}
