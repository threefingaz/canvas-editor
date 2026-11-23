import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChatCircleTextIcon,
  EyeSlashIcon,
  SquaresFourIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { useMemo, type ReactNode } from 'react'
import { screens } from 'virtual:canvas-screens'
import { overlayStrips, type Point, type Rect, type View } from '../canvas/viewport.ts'
import { bubble } from '../comments/bubble-store.ts'
import { useFloatingPlace } from '../comments/floating.ts'
import { editBlock } from '../edits/keep.ts'
import { edits, useScreenEdits } from '../edits/store.ts'
import { arrowsFree, barKey, focusOnCanvas, typingInActive } from '../focus.ts'
import { useWindowKeys } from '../hooks.ts'
import { removeEdit } from '../inspector/edit.ts'
import { elementOf, siteOf } from '../locate/fiber.ts'
import { Button, PanelSurface } from '../ui'
import { barActions, barPlace, moveSides, type BarAction, type MoveSide } from './bar.ts'
import { moveDrag } from './drag-store.ts'
import { arrowNext, type Arrow, type Flow } from './move.ts'
import { MoveDrag } from './MoveDrag.tsx'
import { selection, type Selected } from './store.ts'
import { selectionTarget } from './target.ts'
import { useMove } from './use-move.ts'

// The bar of the selected element, in the selection layer above the frames:
// the name of the element, the two arrows of a move with the position of the
// element between them (also the arrow keys of the flow), and its actions,
// Comment (C), Ask for options and Remove (Delete or Backspace). The arrows
// are there only for an element that can move among its siblings
// (`useMove`); they point along the flow of the siblings (left and right in
// a row, up and down in a column), and an arrow is off at the end of the
// sequence. With a parent that shows no preview of a move, the position has
// a mark that says so. The bar is above the element, or below it with no
// room above, and stays in the free part of the canvas (`barPlace`).
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
  // The view of the canvas and the top left corner of the frame of the
  // selection in world coordinates, for the line of a drag (`MoveDrag`);
  // null while the frame is not in the layout.
  view: View
  box: Point | null
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

export function SelectionBar({ selected, rect, view, box }: SelectionBarProps) {
  const element = useMemo(() => elementOf(selected.node, selected.loc), [selected.node, selected.loc])
  const site = element && siteOf(element)
  const items = useScreenEdits(selected.screenId)
  const screen = screens.find((entry) => entry.id === selected.screenId)
  const move = useMove(selected, items, screen?.width ?? null)
  const { actions, off } = barActions({
    option: screen?.optionOf !== undefined,
    block: editBlock(items),
    site: site !== null,
  })

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
  // Moves the element one place in the code sequence for an arrow key or an
  // arrow button (`arrowNext` from the position of the plan), along the flow
  // that the frame shows at this moment (`rectsNow`), thus a fast second key
  // reads the flow after the preview of the first one; false when no move
  // ran (no move, `off`, the other axis, the end of the sequence).
  const moveIfOn = (arrow: Arrow): boolean => {
    if (!move || off !== null) return false
    const flow = move.rectsNow()?.flow
    const next = flow ? arrowNext(arrow, flow, move.plan.position, move.plan.count) : null
    return next !== null && move.moveTo(next)
  }
  useBarKeys(runIfOn, moveIfOn)

  // The bar is placed before the first paint and again when it or the layer
  // (the canvas) gets a new size: a button that turns off, a new size of the
  // canvas. The node is there only while the rectangle is known.
  const bar = useFloatingPlace((self, canvas) => (rect ? barPlace(rect, self, canvas, barGap, overlayStrips) : null))

  const drag = move && box && (
    <MoveDrag selected={selected} move={move} canDrag={(move.place?.drag ?? false) && off === null} view={view} box={box} />
  )

  if (!rect) return drag

  return (
    <>
      {drag}
      <PanelSurface
        ref={bar}
        className="pointer-events-auto invisible absolute top-0 left-0 flex items-center gap-0.5 rounded-lg p-0.5 pl-2 shadow-md"
        data-selection-bar=""
      >
        <span className="max-w-48 min-w-0 truncate pr-1 text-xs font-medium" title={selected.name} data-selection-label="">
          {selected.name}
        </span>
        {move?.place && (
          <MoveArrows
            flow={move.place.flow}
            position={move.plan.position}
            count={move.plan.count}
            previewed={move.plan.previewed}
            off={off}
            onMove={moveIfOn}
          />
        )}
        {actions.map((action) => (
          <span key={action} title={off ?? labels[action]} data-bar-action={action} data-bar-off={off === null ? undefined : ''}>
            <Button size="icon" variant="ghost" aria-label={labels[action]} disabled={off !== null} onClick={run[action]}>
              {icons[action]}
            </Button>
          </span>
        ))}
      </PanelSurface>
    </>
  )
}

const arrowIcons: Record<Arrow, ReactNode> = {
  left: <ArrowLeftIcon />,
  right: <ArrowRightIcon />,
  up: <ArrowUpIcon />,
  down: <ArrowDownIcon />,
}

const noPreview =
  'The parent is not a flex or grid container, thus the frame cannot show a new sequence. The edit is saved.'

type MoveArrowsProps = {
  // The flow of the siblings that the frame shows (`useMove`), and the
  // position of the plan in the code sequence with the count of siblings.
  flow: Flow
  position: number
  count: number
  previewed: boolean
  off: string | null
  onMove: (arrow: Arrow) => void
}

// The two arrows of a move and the position between them, in the code
// sequence (the position of the plan). The arrow at the left (or at the top)
// moves the element to the left (or up) on the screen; in a reversed flow
// that is a step later in the code (`stepOf`). An arrow is on as `arrowNext`
// says, and a click runs the same move as its key.
function MoveArrows({ flow, position, count, previewed, off, onMove }: MoveArrowsProps) {
  const [first, second] = moveSides(flow)
  const button = ({ arrow, label }: MoveSide) => {
    const on = off === null && arrowNext(arrow, flow, position, count) !== null
    return (
      <span key={arrow} title={off ?? label} data-bar-move={arrow} data-bar-off={off === null ? undefined : ''}>
        <Button
          size="icon"
          variant="ghost"
          aria-label={label}
          disabled={!on}
          onClick={() => onMove(arrow)}
        >
          {arrowIcons[arrow]}
        </Button>
      </span>
    )
  }
  return (
    <>
      {button(first)}
      <span
        className="flex shrink-0 items-center gap-0.5 font-mono text-[11px] text-[color:var(--muted-foreground)] tabular-nums"
        title={previewed ? `Position ${position + 1} of ${count}` : noPreview}
        data-move-position={position}
        data-move-previewed={previewed ? undefined : 'false'}
      >
        {position + 1} of {count}
        {!previewed && <EyeSlashIcon aria-label="No preview for this parent" />}
      </span>
      {button(second)}
    </>
  )
}

// True when the focus is in a floating part of the canvas: the comment
// bubble, the options panel or a pin, or in the menu or a dialog of the
// screen actions. A key there is about the panel or the pin (Delete on a
// discard button, after a click on a pin that selected its element), not
// about the element.
function inFloatingPart(): boolean {
  return (
    document.activeElement?.closest(
      '[data-comment-bubble], [data-options-panel], [data-pin], [data-screen-menu], [data-screen-dialog]',
    ) != null
  )
}

// The keys of the bar (`barKey`): Delete and Backspace remove the element,
// C opens its comment, and an arrow key moves it one place along the flow of
// its siblings. They do nothing when a field that takes text has the focus,
// when the focus is in a floating part, when a modifier is down, when the key
// is held (a repeat: the box of the comment has the focus by then and would
// get the letters; a held arrow moves one place only), or when a different
// listener prevented the default; they prevent the default only when their
// action ran, thus an arrow of the other axis or at the end of the sequence
// is left alone. They do nothing while a drag of the element runs
// (`moveDrag`). An arrow works only with the focus on the canvas or on the
// body (`arrowsFree`): a control of the panel uses the arrows for its own
// work. `run` and `move` are the latest callbacks of the bar.
function useBarKeys(run: (action: BarAction) => boolean, move: (arrow: Arrow) => boolean) {
  useWindowKeys((event) => {
    if (event.defaultPrevented || event.repeat || moveDrag.dragging()) return
    const typing = typingInActive()
    const floating = inFloatingPart()
    const action = barKey(event)
    if (action === null) return
    if (typeof action === 'object') {
      const onCanvas = focusOnCanvas(document.activeElement)
      if (arrowsFree({ typing, floating, onCanvas }) && move(action.move)) event.preventDefault()
      return
    }
    if (typing || floating) return
    if (run(action)) event.preventDefault()
  })
}
