import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { flowErrors, library, screens } from 'virtual:canvas-screens'
import { linkAt, type LinkTarget } from '../frame/screen-link.ts'
import type { AppliedAction } from '../requests/api.ts'
import { optionTotals } from '../related/groups.ts'
import { flowPairs } from '../related/links.ts'
import { Canvas } from './canvas/Canvas.tsx'
import { EditMarks } from './canvas/EditMarks.tsx'
import { readLinksShown, writeLinksShown } from './canvas/flow.ts'
import { FlowLayer } from './canvas/FlowLayer.tsx'
import { Frame, type KeepBase } from './canvas/Frame.tsx'
import { keepKeys, layoutFrames, shownRect, type FrameBox } from './canvas/layout.ts'
import { readMarkersShown, writeMarkersShown } from './canvas/markers.ts'
import { Markers } from './canvas/Markers.tsx'
import { NoLibrary, NoTokens } from './canvas/NoLibrary.tsx'
import { followLink, operate, useOperate } from './canvas/operate.ts'
import { croppedParts, inCrop, partRects, wholeShown } from './canvas/part.ts'
import { titleRowHeight } from './canvas/title.ts'
import { Toolbar } from './canvas/Toolbar.tsx'
import {
  centerOn,
  overlayStrips,
  resized,
  revealView,
  titleRowRect,
  toolbarStrip,
  zoomAnchor,
  zoomAt,
  zoomStep,
  type Point,
  type Rect,
  type Size,
  type Strips,
  type View,
} from './canvas/viewport.ts'
import { bubbleScreen } from './comments/bubble.ts'
import { bubble } from './comments/bubble-store.ts'
import { CommentBubble } from './comments/CommentBubble.tsx'
import { Pins } from './comments/Pins.tsx'
import { edits } from './edits/store.ts'
import { escapeAction, historyKey, typingInActive, viewKey } from './focus.ts'
import { inLiveFrame } from './frame-window.ts'
import { minEditorWidth, narrowQuery, useWindowKeys } from './hooks.ts'
import { Inspector } from './inspector/Inspector.tsx'
import { clearsSelection, tabAfter, type Tab, type TabEvent } from './inspector/tabs.ts'
import { useMediaQuery } from './media-query.ts'
import { hiddenIn } from './preview/css.ts'
import { RequestSync } from './requests/RequestSync.tsx'
import { ScreenDialogs } from './screens/ScreenMenu.tsx'
import { viewAfter } from './screens/screen-actions.ts'
import { moveDrag } from './selection/drag-store.ts'
import { canvasCropOf, canvasRectOf } from './selection/geometry.ts'
import { hitAt, pickAt, type Hovered } from './selection/pick.ts'
import { SelectionOverlay } from './selection/SelectionOverlay.tsx'
import { selection } from './selection/store.ts'
import { useEditorTheme } from './theme.ts'
import { useTokenFile } from './tokens/editor-tokens.ts'
import { Alert, AlertDescription, AlertTitle, PanelSurface } from './ui'

// The editor: the canvas with the frames of the screens, the markers of the
// elements that are not from the library, the pins of the comments, the
// arrows of the links between the screens and the names of the flows
// (`FlowLayer.tsx`), the selection with its bar, the bubble of the comments, and the toolbar, and
// the inspector in a column at the right. With the Preview switch on
// (`operate.ts`), a click on a link in a frame moves the view to the frame of
// its screen in place of a selection, and the inspector is closed: the canvas
// has the full width, and a new size keeps the middle of the view. The list
// of screens comes from the virtual module; a new screen file updates it with
// no reload of the editor. With no library pack, the canvas shows a message
// with the sentence for the agent; with a library whose tokens are not set up
// (the level `connected`), a message with the sentence of that step. The editor imports nothing from a pack.
// The title of an option frame has the button "Keep this option": it adds a
// `keep` item to the edits of the base, and the kept frame has a mark while
// the item is open. An option of one element shows cropped to its block
// (`canvas/part.ts`): the measure of its frame gives the rectangle of the
// block, and the layout places the frame by its crop.

// An error of the token file, at the top of the canvas: it shows with the
// Preview switch on and off, while the inspector is closed too. A child of
// its own, thus a new token file does not render the editor again.
function TokenFileError() {
  const { error } = useTokenFile()
  if (error === null) return null
  return (
    <PanelSurface className="max-w-md rounded-lg shadow-lg" data-token-file-error="">
      <Alert variant="destructive">
        <AlertTitle>The tokens are not loaded</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    </PanelSurface>
  )
}

// The edits store on the window for a check from the console, in the dev
// server only.
if (import.meta.env.DEV) Object.assign(window, { __canvasEdits: edits })

// True while a dialog of the screen actions is open: it is modal, thus the
// keys of the history and of the view do nothing behind it.
function screenDialogOpen(): boolean {
  return document.querySelector('[data-screen-dialog]') !== null
}

// Ctrl or Cmd with Z undoes the last edit, and Shift with them redoes it, on
// the edits of all screens. The keys do nothing when a field that takes text
// has the focus (the field undoes its own typing) or a dialog is open.
function useHistoryKeys() {
  useWindowKeys((event) => {
    const action = historyKey(event)
    if (action === null || event.defaultPrevented) return
    if (typingInActive() || screenDialogOpen()) return
    event.preventDefault()
    if (action === 'undo') edits.undo()
    else edits.redo()
  })
}

// A value that goes back to null a time after it is set: the mark of the
// frame of a link target, the message of a link to an unknown screen. A new
// value starts the time again.
//
// The time is an effect of the value: a refresh of this module in the dev
// server runs each effect again, and the value then still goes back to null.
// Each flash is a new object, thus the same value flashed again starts a new
// time.
function useFlash<T>(duration: number): [T | null, (value: T) => void] {
  const [flashed, setFlashed] = useState<{ value: T } | null>(null)
  useEffect(() => {
    if (flashed === null) return
    const timer = window.setTimeout(() => setFlashed(null), duration)
    return () => window.clearTimeout(timer)
  }, [flashed, duration])
  const flash = useCallback((value: T) => setFlashed({ value }), [])
  return [flashed?.value ?? null, flash]
}

// How long the frame of a link target keeps its mark, and how long the
// message of a link to an unknown screen shows, in ms.
const markDuration = 1500
const noticeDuration = 4000

// The strips of the canvas that a fit leaves free, in px on the screen: the
// title row above a frame (it keeps its size at each zoom) and the toolbar at
// the bottom with its distance from the edge.
// The free space around all frames after a fit of all of them, in px on the
// screen: the name of each flow is at the left of its row, and the arrows of
// the links are above it.
const fitAllPadding = 120

const fitStrips: Strips = { top: titleRowHeight, bottom: toolbarStrip }
// The least distance of the middle of an element from the edges of the free
// part of the canvas (the canvas less the notice and the toolbar) for a click
// on a row of a list: closer, the view moves to the element.
const revealMargin = 48
// The largest width of the part of the title row of a frame that a panel of
// the screen needs in the view, in px on the screen; its height is the strip
// of the title row (`fitStrips.top`).
const titleRowWidth = 320

export default function App() {
  const { theme, toggle } = useEditorTheme()
  const narrow = useMediaQuery(narrowQuery)
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 })
  const size = useRef<Size | null>(null)
  // The last size of the canvas that is not empty: a new size keeps the
  // middle of the view against it, also after a time with no room.
  const shownSize = useRef<Size | null>(null)
  // True after the first view that centers the content on a canvas with a size.
  const centered = useRef(false)
  // The measured height of each frame, by screen id.
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map())
  // The current document of each frame, for the selection. A reload of a
  // frame gives a new document.
  const [documents, setDocuments] = useState<ReadonlyMap<string, Document>>(() => new Map())
  const [hover, setHover] = useState<Hovered | null>(null)
  // The screen of the last click on a frame, on its title or on a pin: the
  // Changes tab of the inspector shows it. The open tab of the inspector
  // follows the clicks on the canvas (`tabAfter`).
  const [listed, setListed] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('design')
  // The markers of the elements that are not from the library show or hide.
  const [markers, setMarkers] = useState(() => readMarkersShown())
  // The arrows of the links between the screens show or hide.
  const [links, setLinks] = useState(() => readLinksShown())
  // The Preview switch, the frame whose link is below the pointer, the frame
  // of the last link target, and the message of a link to an unknown screen.
  const operating = useOperate()
  const [linkFrame, setLinkFrame] = useState<string | null>(null)
  const [marked, mark] = useFlash<string>(markDuration)
  const [notice, showNotice] = useFlash<string>(noticeDuration)
  useHistoryKeys()
  // A hot update of the virtual module renders the editor again with the new
  // list, and the memo is computed again.
  // The rectangle of the block of each option with a part, from the measure
  // of its frame, and the screens that show whole all the same: the layout
  // crops the others.
  const parts = useSyncExternalStore(partRects.subscribe, partRects.get)
  const whole = useSyncExternalStore(wholeShown.subscribe, wholeShown.get)
  const layout = useMemo(() => layoutFrames(screens, heights, croppedParts(parts, whole)), [heights, parts, whole])
  // The ids of the list, for the links. One array for each list, thus the
  // Issues list of a frame is read again only when the list changes.
  const screenIds = useMemo(() => screens.map((screen) => screen.id), [])
  // The count of the options of each frame, and each screen by its id: read
  // once for the list, not once for each frame.
  const totals = useMemo(() => optionTotals(screens), [])
  const byId = useMemo(() => new Map(screens.map((screen) => [screen.id, screen])), [])
  // The links between the screens, for the arrows of the canvas.
  const pairs = useMemo(() => flowPairs(screens), [])
  // The error of each `flow.json` that is not valid, by flow, for the name
  // of its row.
  const flowFileErrors = useMemo(() => new Map(flowErrors.map((item) => [item.flow, `${item.file}: ${item.error}`])), [])
  const bounds = layout.bounds
  // The frames that have a document: the screens with no error. The maps by
  // screen id drop the entries of removed screens at their next change, and
  // the documents of other screens are not used.
  const ids = new Set(screens.map((screen) => screen.id))
  // The listed screen when it is still in the list: the Changes tab shows it,
  // and its frame has a ring.
  const listedId = listed !== null && ids.has(listed) ? listed : null
  const live = useMemo(() => new Set(screens.filter((screen) => !screen.error).map((screen) => screen.id)), [])
  // The document of a screen that is removed or has an error goes out of the
  // state, thus a screen that comes back shows no old document before its
  // frame loads, and the map stays the same object at each render.
  const [prunedFor, setPrunedFor] = useState(live)
  if (prunedFor !== live) {
    setPrunedFor(live)
    setDocuments((current) => keepKeys(current, live))
    // A screen with an error has the height of an error frame, not its last
    // measured height.
    setHeights((current) => keepKeys(current, live))
  }
  const frameDocuments = useMemo(() => keepKeys(documents, live), [documents, live])

  const onHeight = (id: string, height: number) => {
    setHeights((current) => (current.get(id) === height ? current : keepKeys(new Map(current).set(id, height), live)))
  }

  const onFrameLoad = (id: string, document: Document) => {
    setDocuments((current) => keepKeys(new Map(current).set(id, document), live))
  }

  // A node that a remove edit of the screen hides cannot be picked.
  const hiddenOf = (id: string) => hiddenIn(edits.get(id))

  // The target of the link below a point of a frame, or null when the node
  // there is in no link. A node that a remove edit hides is left out.
  const linkUnder = (id: string, point: Point): LinkTarget | null => {
    const node = frameDocuments.get(id)?.elementFromPoint(point.x, point.y) ?? null
    if (!node || hiddenOf(id)(node)) return null
    return linkAt(node, screenIds)
  }

  // The outline needs no index; the state stays when the element is the same.
  // With the Preview switch on there is no outline, and the cursor shows a
  // link that a click follows (`followLink`): not a link to a different
  // address. A frame with no element under the point (the pointer left it)
  // clears only its own outline: the leave of a frame can come after the
  // hover of the next one.
  const onHover = (id: string, point: Point | null) => {
    if (operating) {
      const over = point !== null && followLink(linkUnder(id, point), layout.frames) !== null
      setLinkFrame((current) => (over ? id : current === id ? null : current))
      return
    }
    const document = frameDocuments.get(id)
    const hit = point && document ? hitAt(document, point, hiddenOf(id)) : null
    setHover((current) => {
      if (hit === null) return current?.screenId === id ? null : current
      return current?.screenId === id && current.node === hit.node && current.name === hit.name ? current : { ...hit, screenId: id }
    })
  }

  // With the Preview switch on: a link to a screen moves the view to its frame
  // and marks the frame; a link to an unknown screen shows a message; a
  // different place does nothing (`followLink`).
  const follow = (id: string, point: Point) => {
    const action = followLink(linkUnder(id, point), layout.frames)
    if (action?.kind === 'move' && size.current) {
      setView(centerOn(shownRect(action.box), size.current, fitStrips))
      mark(action.box.screen.id)
    } else if (action?.kind === 'notice') {
      showNotice(action.text)
    }
  }

  // The frame of a screen in the layout.
  const boxOf = (id: string) => layout.frames.find((frame) => frame.screen.id === id)

  // Fits the frame of the screen with its title row: a double click on the
  // title, and Shift with 2. True when the view moved. A frame with a crop
  // fits by the part of it that shows.
  const fitFrame = (id: string): boolean => {
    const box = boxOf(id)
    if (!box || !size.current) return false
    setView(centerOn(shownRect(box), size.current, fitStrips))
    return true
  }

  // Moves the view to the frame of the screen and marks it: a click on a
  // `keep` item in the Changes list shows its option.
  const showScreen = (id: string) => {
    if (fitFrame(id)) mark(id)
  }

  const fitAll = () => {
    if (size.current) setView(centerOn(bounds, size.current, fitStrips, fitAllPadding))
  }

  // The rectangle of the selected node in the frame document and the place
  // of its frame, read at the moment of a zoom; null with no selection, or
  // when the node is not in the current document of its frame. The editor
  // does not subscribe to the selection: it reads the store.
  const selectedPlace = (): { box: FrameBox; nodeRect: Rect } | null => {
    const selected = selection.get()
    if (!selected || !inLiveFrame(selected.node)) return null
    if (selected.node.ownerDocument !== frameDocuments.get(selected.screenId)) return null
    const box = boxOf(selected.screenId)
    return box ? { box, nodeRect: selected.node.getBoundingClientRect() } : null
  }
  // The rectangle of the selection on the canvas in a view: the part in the
  // crop of a frame of an option with a part, as the selection frame shows
  // it; null when the crop does not show it.
  const selectedRect = (view: View, place: { box: FrameBox; nodeRect: Rect }): Rect | null =>
    inCrop(canvasRectOf(view, place.box, place.nodeRect), canvasCropOf(view, place.box))

  // A zoom of the toolbar or of a key keeps the selection in its place when
  // it is in the view, else the middle of the canvas (`zoomAnchor`).
  const zoomBy = (zoom: (current: View, anchor: Point) => View) => {
    const place = selectedPlace()
    const canvas = size.current ?? { width: 0, height: 0 }
    setView((current) => zoom(current, zoomAnchor(canvas, place ? selectedRect(current, place) : null)))
  }
  // Moves the view to the selected element when its middle is not in the
  // free part of the canvas, at least `revealMargin` px from each edge; the
  // scale stays. A click on a row of a list in the inspector selected it.
  const reveal = () => {
    const place = selectedPlace()
    const canvas = size.current
    if (!place || !canvas) return
    setView((current) => {
      const rect = selectedRect(current, place)
      return rect ? revealView(current, rect, canvas, revealMargin, overlayStrips) : current
    })
  }

  // Moves the view to the title row of the frame of a screen when it is not
  // in the view, as `reveal` does: a panel of the screen (a bubble, the
  // options panel) opens from the Changes tab next to that row.
  const showTitle = (id: string) => {
    const box = boxOf(id)
    const canvas = size.current
    if (!box || !canvas) return
    setView((current) =>
      revealView(current, titleRowRect(current, shownRect(box), fitStrips.top, titleRowWidth), canvas, revealMargin, overlayStrips),
    )
  }

  const zoomIn = () => zoomBy((current, anchor) => zoomStep(current, 1, anchor))
  const zoomOut = () => zoomBy((current, anchor) => zoomStep(current, -1, anchor))
  const zoomReset = () => zoomBy((current, anchor) => zoomAt(current, 1 / current.scale, anchor))

  // The base of an option, for the button "Keep this option" of its frame;
  // null for a screen that is not an option. The frame reads the edits of
  // the base itself.
  const keepBaseOf = (screen: (typeof screens)[number]): KeepBase | null => {
    const base = screen.optionOf === undefined ? undefined : byId.get(screen.optionOf)
    return base ? { id: base.id, width: base.width } : null
  }

  const onPick = (id: string, point: Point) => {
    if (operating) {
      follow(id, point)
      return
    }
    const document = frameDocuments.get(id)
    const picked = document ? pickAt(document, point, hiddenOf(id)) : null
    setListed(id)
    setTab(tabAfter('pick'))
    if (picked) selection.select({ ...picked, screenId: id })
    else selection.clear()
  }

  // A click on the title of a frame, on its count of issues, on its mark of
  // the asked options or on a pin of its title row shows the Changes tab of
  // its screen, and clears the selection, except for a pin of the title row
  // with a selection in its screen (`clearsSelection`).
  const onTitle = (id: string, event: Exclude<TabEvent, 'pick'>) => {
    setListed(id)
    setTab(tabAfter(event))
    if (clearsSelection(event, selection.get()?.screenId ?? null, id)) selection.clear()
  }

  // A click on a row of the Project tab: the Changes tab lists the screen, as
  // after a click on its title, and the view fits its frame, which is marked
  // for a short time.
  const openScreen = (id: string) => {
    onTitle(id, 'title')
    showScreen(id)
  }

  // After a screen action of the menu of a frame: the Changes tab follows the
  // new id of its screen, or lists none after a delete; the selection and the
  // bubble of a screen whose id changed clear, because its frame is a new one
  // (`viewAfter`).
  const onScreenAction = (plan: AppliedAction) => {
    const view = { selected: selection.get()?.screenId ?? null, bubble: bubbleScreen(bubble.get()) }
    const after = viewAfter(plan.screens, { ...view, listed: null })
    setListed((current) => viewAfter(plan.screens, { ...view, listed: current }).listed)
    if (after.clearSelection) selection.clear()
    if (after.closeBubble) bubble.send({ type: 'close' })
  }

  const onResize = useCallback(
    (next: Size) => {
      size.current = next
      if (next.width <= 0 || next.height <= 0) return
      const before = shownSize.current
      shownSize.current = next
      // Center the content when the canvas gets its first size that is not
      // empty; after that a new size keeps the middle of the view.
      if (!centered.current) {
        centered.current = true
        setView(centerOn(bounds, next, fitStrips, fitAllPadding))
      } else if (before) {
        setView((current) => resized(current, before, next))
      }
    },
    [bounds],
  )

  const toggleMarkers = () => {
    setMarkers(!markers)
    writeMarkersShown(!markers)
  }

  const toggleLinks = () => {
    setLinks(!links)
    writeLinksShown(!links)
  }

  // The selection, the outline and the bubble go away when the Preview switch
  // turns on.
  const toggleOperate = () => {
    operate.toggle()
    selection.clear()
    bubble.send({ type: 'close' })
    setHover(null)
    setLinkFrame(null)
  }

  // The one Escape of the editor (`escapeAction`): it cancels a drag of the
  // selected element (`moveDrag`, read at the key), else closes the comment
  // bubble or the options panel and keeps the selection, else turns the
  // Preview switch off, else clears the selection. A field that uses Escape
  // for its own work prevents the default; an Escape of a composition and one
  // behind a dialog of the screen actions do nothing. The keys of the view (`viewKey`)
  // do nothing while a field that takes text has the focus. The keys of the
  // bar of the selection (C, Delete) are its own (`SelectionBar.tsx`).
  useWindowKeys((event) => {
    if (event.defaultPrevented) return
    if (event.key === 'Escape') {
      // An Escape that ends the composition of a text, or one behind an open
      // dialog of the screen actions, is theirs.
      if (event.isComposing || screenDialogOpen()) return
      const action = escapeAction({
        dragging: moveDrag.dragging(),
        floating: bubble.get().kind !== 'closed',
        operating,
        selected: selection.get() !== null,
      })
      if (action === null) return
      event.preventDefault()
      if (action === 'cancel-drag') moveDrag.send({ type: 'cancel' })
      else if (action === 'close-floating') bubble.send({ type: 'close' })
      else if (action === 'operate-off') toggleOperate()
      else if (action === 'clear-selection') selection.clear()
      return
    }
    const key = viewKey(event)
    if (key === null || typingInActive() || screenDialogOpen()) return
    if (key === 'fit-all') fitAll()
    else if (key === 'actual') zoomReset()
    else {
      const id = selection.get()?.screenId ?? listedId
      if (id === null) return
      fitFrame(id)
    }
    event.preventDefault()
  })

  return (
    <main className="relative flex h-full">
      <div className="relative h-full min-w-0 flex-1">
        <Canvas
          view={view}
          onViewChange={setView}
          onResize={onResize}
          overlay={
            <>
              <FlowLayer
                view={view}
                frames={layout.frames}
                pairs={pairs}
                arrows={links}
                listed={operating ? null : listedId}
                flowErrors={flowFileErrors}
              />
              <Markers view={view} frames={layout.frames} documents={frameDocuments} shown={markers && !operating} />
              <EditMarks view={view} frames={layout.frames} documents={frameDocuments} shown={markers && !operating} />
              <Pins
                view={view}
                frames={layout.frames}
                documents={frameDocuments}
                shown={!operating}
                onList={setListed}
              />
              <SelectionOverlay
                view={view}
                frames={layout.frames}
                documents={frameDocuments}
                hover={hover}
                shown={!operating}
              />
              <CommentBubble view={view} frames={layout.frames} documents={frameDocuments} shown={!operating} />
              {library === null && <NoLibrary />}
              <div className="pointer-events-none absolute inset-x-4 top-4 flex flex-col items-center gap-2" role="status">
                {library !== null && <TokenFileError />}
                {library?.level === 'connected' && <NoTokens />}
                {notice && (
                  <PanelSurface className="rounded-lg px-3 py-2 text-xs shadow-lg" data-operate-notice="">
                    {notice}
                  </PanelSurface>
                )}
              </div>
              <Toolbar
                operate={operating}
                onToggleOperate={toggleOperate}
                scale={view.scale}
                onZoomOut={zoomOut}
                onZoomIn={zoomIn}
                onZoomReset={zoomReset}
                onFitAll={fitAll}
                markers={markers}
                onToggleMarkers={toggleMarkers}
                links={links}
                onToggleLinks={toggleLinks}
                theme={theme}
                onToggleTheme={toggle}
              />
            </>
          }
        >
          {layout.frames.map((box) => (
            <Frame
              key={box.screen.id}
              box={box}
              screenIds={screenIds}
              scale={view.scale}
              onHeight={onHeight}
              onLoad={onFrameLoad}
              onHover={onHover}
              onPick={onPick}
              onTitle={onTitle}
              onTitleFit={fitFrame}
              overLink={operating && linkFrame === box.screen.id}
              marked={marked === box.screen.id}
              listed={!operating && listedId === box.screen.id}
              optionCount={totals.get(box.screen.id) ?? 0}
              keepBase={keepBaseOf(box.screen)}
              operating={operating}
            />
          ))}
        </Canvas>
      </div>
      {!operating && (
        <Inspector
          screenId={listedId}
          documents={frameDocuments}
          tab={tab}
          onTab={setTab}
          onShowScreen={showScreen}
          onOpenScreen={openScreen}
          onShowTitle={showTitle}
          onReveal={reveal}
        />
      )}
      <ScreenDialogs onApplied={onScreenAction} />
      {/* The edits of each screen are saved in its request file and loaded
          from it (`RequestSync`: a child, thus a refresh of this module keeps
          the syncs). */}
      <RequestSync list={screens} />
      {narrow && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[color:var(--background)] p-6 text-center text-sm">
          The editor needs a window that is {minEditorWidth}px wide or more.
        </div>
      )}
    </main>
  )
}
