import { ChatCircleTextIcon, SquaresFourIcon, TrashIcon } from '@phosphor-icons/react'
import { useMemo, type ReactNode } from 'react'
import { screens } from 'virtual:canvas-screens'
import { overlayStrips, type Rect } from '../canvas/viewport.ts'
import { bubble } from '../comments/bubble-store.ts'
import { useFloatingPlace } from '../comments/floating.ts'
import { editBlock } from '../edits/keep.ts'
import { edits, useScreenEdits } from '../edits/store.ts'
import { barKey, typingInActive } from '../focus.ts'
import { useWindowKeys } from '../hooks.ts'
import { removeEdit } from '../inspector/edit.ts'
import { elementOf, siteOf } from '../locate/fiber.ts'
import { Button, PanelSurface } from '../ui'
import { barActions, barPlace, type BarAction } from './bar.ts'
import { selection, type Selected } from './store.ts'
import { selectionTarget } from './target.ts'

// The bar of the selected element, in the selection layer above the frames:
// the name of the element and its actions, Comment (C), Ask for options and
// Remove (Delete or Backspace). The bar is above the element, or below it
// with no room above, and stays in the free part of the canvas (`barPlace`).
// A button that is off says why in its title (`barActions`): the element has
// no place in the code, or the screen has an open request to keep an option.
// An option has no "Ask for options". The keys work while the bar is mounted
// (an element is selected and Preview is off), also when the rectangle of the
// element is not known for a moment (a reload of the frame), and not while a
// field that takes text has the focus or the focus is in the comment bubble,
// the options panel or on a pin; a held key does not repeat its action.
// The bar takes the pointer, thus a click on it is not a pick of the frame
// below it.
//
// Comment opens the comment bubble for a new comment on the element
// (`CommentBubble.tsx`), and Ask for options the options panel of the element
// (`OptionsPanel.tsx`).

// The distance of the bar from the element and from the left and the right
// edge of the canvas, in px on the screen.
const barGap = 6

type SelectionBarProps = {
  selected: Selected
  // The rectangle of the element in canvas coordinates; null while it is not
  // known (the node is not in the current document of its frame). The bar
  // then shows nothing, and its keys still work.
  rect: Rect | null
}

const labels: Record<BarAction, string> = {
  comment: 'Comment (C)',
  options: 'Ask for options',
  remove: 'Remove (Delete)',
}

const icons: Record<BarAction, ReactNode> = {
  comment: <ChatCircleTextIcon />,
  options: <SquaresFourIcon />,
  remove: <TrashIcon />,
}

export function SelectionBar({ selected, rect }: SelectionBarProps) {
  const element = useMemo(() => elementOf(selected.node, selected.loc), [selected.node, selected.loc])
  const site = element && siteOf(element)
  const items = useScreenEdits(selected.screenId)
  const screen = screens.find((entry) => entry.id === selected.screenId)
  const { actions, off } = barActions({ option: screen?.optionOf !== undefined, block: editBlock(items), site: site !== null })

  const run: Record<BarAction, () => void> = {
    comment: () => bubble.send({ type: 'open-new', target: { screenId: selected.screenId, loc: selected.loc } }),
    options: () => bubble.send({ type: 'open-options', target: { screenId: selected.screenId, loc: selected.loc } }),
    // The selection is cleared only when the remove edit went to the store:
    // the preview then hides the element.
    remove: () => {
      if (!site || !screen) return
      if (edits.apply(selected.screenId, removeEdit(selectionTarget(selected, site), screen.width))) selection.clear()
    },
  }
  // Runs an action of the bar that is there and on; false when it is not.
  const runIfOn = (action: BarAction): boolean => {
    if (!actions.includes(action) || off !== null) return false
    run[action]()
    return true
  }
  useBarKeys(runIfOn)

  // The bar is placed before the first paint and again when it or the layer
  // (the canvas) gets a new size: a button that turns off, a new size of the
  // canvas. The node is there only while the rectangle is known.
  const bar = useFloatingPlace((self, canvas) => (rect ? barPlace(rect, self, canvas, barGap, overlayStrips) : null))

  if (!rect) return null

  return (
    <PanelSurface
      ref={bar}
      className="pointer-events-auto invisible absolute top-0 left-0 flex items-center gap-0.5 rounded-lg p-0.5 pl-2 shadow-md"
      data-selection-bar=""
    >
      <span className="max-w-48 min-w-0 truncate pr-1 text-xs font-medium" title={selected.name} data-selection-label="">
        {selected.name}
      </span>
      {actions.map((action) => (
        <span key={action} title={off ?? labels[action]} data-bar-action={action} data-bar-off={off === null ? undefined : ''}>
          <Button size="icon" variant="ghost" aria-label={labels[action]} disabled={off !== null} onClick={run[action]}>
            {icons[action]}
          </Button>
        </span>
      ))}
    </PanelSurface>
  )
}

// True when the focus is in a floating part of the canvas: the comment
// bubble, the options panel or a pin. A key there is about the panel or the
// pin (Delete on a discard button, after a click on a pin that selected its
// element), not about the element.
function inFloatingPart(): boolean {
  return document.activeElement?.closest('[data-comment-bubble], [data-options-panel], [data-pin]') != null
}

// The keys of the bar (`barKey`): Delete and Backspace remove the element,
// and C opens its comment. They do nothing when a field that takes text has
// the focus, when a modifier is down, when the key is held (a repeat: the box
// of the comment has the focus by then and would get the letters), or when a
// different listener prevented the default; they prevent the default only
// when their action ran. `run` is the latest callback of the bar.
function useBarKeys(run: (action: BarAction) => boolean) {
  useWindowKeys((event) => {
    if (event.defaultPrevented || event.repeat || typingInActive() || inFloatingPart()) return
    const action = barKey(event)
    if (action !== null && run(action)) event.preventDefault()
  })
}
