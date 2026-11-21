import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { library, screens } from 'virtual:canvas-screens'
import { linkAt, type LinkTarget } from '../frame/screen-link.ts'
import { Canvas } from './canvas/Canvas.tsx'
import { Frame } from './canvas/Frame.tsx'
import { keepKeys, layoutFrames } from './canvas/layout.ts'
import { readMarkersShown, writeMarkersShown } from './canvas/markers.ts'
import { Markers } from './canvas/Markers.tsx'
import { NoLibrary } from './canvas/NoLibrary.tsx'
import { followLink, operate, useOperate } from './canvas/operate.ts'
import { Toolbar } from './canvas/Toolbar.tsx'
import { centerOn, zoomAt, zoomStep, type Point, type Size, type View } from './canvas/viewport.ts'
import { edits } from './edits/store.ts'
import { historyKey, typingInActive } from './focus.ts'
import { Inspector } from './inspector/Inspector.tsx'
import { useMediaQuery } from './media-query.ts'
import { hiddenIn } from './preview/css.ts'
import { useRequestSync } from './requests/sync.ts'
import { hitAt, pickAt, type Hovered } from './selection/pick.ts'
import { SelectionOverlay } from './selection/SelectionOverlay.tsx'
import { selection } from './selection/store.ts'
import { useEditorTheme } from './theme.ts'
import { PanelSurface } from './ui'

// The editor: the canvas with the frames of the screens, the markers of the
// elements that are not from the library, the selection, and the toolbar, and
// the inspector in a column at the right. With the Preview switch on
// (`operate.ts`), a click on a link in a frame moves the view to the frame of
// its screen in place of a selection. The list of screens comes from the
// virtual module; a new screen file updates it with no reload of the editor.
// With no library pack, the canvas shows a message with the sentence for the
// agent. The editor imports nothing from a pack.

// The edits store on the window for a check from the console, in the dev
// server only.
if (import.meta.env.DEV) Object.assign(window, { __canvasEdits: edits })

// Ctrl or Cmd with Z undoes the last edit, and Shift with them redoes it, on
// the edits of all screens. The keys do nothing when a field that takes text
// has the focus: the field undoes its own typing.
function useHistoryKeys() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = historyKey(event)
      if (action === null || event.defaultPrevented) return
      if (typingInActive()) return
      event.preventDefault()
      if (action === 'undo') edits.undo()
      else edits.redo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

// A value that goes back to null a time after it is set: the mark of the
// frame of a link target, the message of a link to an unknown screen. A new
// value starts the time again.
function useFlash<T>(duration: number): [T | null, (value: T) => void] {
  const [value, setValue] = useState<T | null>(null)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const flash = useCallback(
    (next: T) => {
      window.clearTimeout(timer.current)
      setValue(next)
      timer.current = window.setTimeout(() => setValue(null), duration)
    },
    [duration],
  )
  return [value, flash]
}

// How long the frame of a link target keeps its mark, and how long the
// message of a link to an unknown screen shows, in ms.
const markDuration = 1500
const noticeDuration = 4000

// The least width of the editor window; a narrower window shows a message.
const minEditorWidth = 1024
const narrowQuery = `(max-width: ${minEditorWidth - 1}px)`

export default function App() {
  const { theme, toggle } = useEditorTheme()
  const narrow = useMediaQuery(narrowQuery)
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 })
  const size = useRef<Size | null>(null)
  // True after the first view that centers the content on a canvas with a size.
  const centered = useRef(false)
  // The measured height of each frame, by screen id.
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map())
  // The current document of each frame, for the selection. A reload of a
  // frame gives a new document.
  const [documents, setDocuments] = useState<ReadonlyMap<string, Document>>(() => new Map())
  const [hover, setHover] = useState<Hovered | null>(null)
  // The screen of the last click on a frame or on its title: the inspector
  // shows its Changes list when nothing is selected.
  const [listed, setListed] = useState<string | null>(null)
  // The markers of the elements that are not from the library show or hide.
  const [markers, setMarkers] = useState(() => readMarkersShown())
  // The Preview switch, the frame whose link is below the pointer, the frame
  // of the last link target, and the message of a link to an unknown screen.
  const operating = useOperate()
  const [linkFrame, setLinkFrame] = useState<string | null>(null)
  const [marked, mark] = useFlash<string>(markDuration)
  const [notice, showNotice] = useFlash<string>(noticeDuration)
  useHistoryKeys()
  // The edits of each screen are saved in its request file and loaded from it.
  useRequestSync(screens)
  // A hot update of the virtual module renders the editor again with the new
  // list, and the memo is computed again.
  const layout = useMemo(() => layoutFrames(screens, heights), [heights])
  // The ids of the list, for the links. One array for each list, thus the
  // Issues list of a frame is read again only when the list changes.
  const screenIds = useMemo(() => screens.map((screen) => screen.id), [])
  const bounds = layout.bounds
  // The frames that have a document: the screens with no error. The maps by
  // screen id drop the entries of removed screens at their next change, and
  // the documents of other screens are not used.
  const ids = new Set(screens.map((screen) => screen.id))
  const live = new Set(screens.filter((screen) => !screen.error).map((screen) => screen.id))
  const frameDocuments = keepKeys(documents, live)

  const onHeight = (id: string, height: number) => {
    setHeights((current) => (current.get(id) === height ? current : keepKeys(new Map(current).set(id, height), ids)))
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
  // link.
  const onHover = (id: string, point: Point | null) => {
    if (operating) {
      const over = point !== null && linkUnder(id, point) !== null
      setLinkFrame((current) => (over ? id : current === id ? null : current))
      return
    }
    const document = frameDocuments.get(id)
    const hit = point && document ? hitAt(document, point, hiddenOf(id)) : null
    setHover((current) => {
      if (hit === null) return null
      return current?.screenId === id && current.node === hit.node && current.name === hit.name ? current : { ...hit, screenId: id }
    })
  }

  // With the Preview switch on: a link to a screen moves the view to its frame
  // and marks the frame; a link to an unknown screen shows a message; a
  // different place does nothing (`followLink`).
  const follow = (id: string, point: Point) => {
    const action = followLink(linkUnder(id, point), layout.frames)
    if (action?.kind === 'move' && size.current) {
      setView(centerOn(action.box, size.current))
      mark(action.box.screen.id)
    } else if (action?.kind === 'notice') {
      showNotice(action.text)
    }
  }

  const onPick = (id: string, point: Point) => {
    if (operating) {
      follow(id, point)
      return
    }
    const document = frameDocuments.get(id)
    const picked = document ? pickAt(document, point, hiddenOf(id)) : null
    setListed(id)
    if (picked) selection.select({ ...picked, screenId: id })
    else selection.clear()
  }

  // A click on the title of a frame shows the Changes list of its screen.
  const onTitle = (id: string) => {
    setListed(id)
    selection.clear()
  }

  const onResize = useCallback(
    (next: Size) => {
      size.current = next
      // Center the content when the canvas gets its first size that is not empty.
      if (!centered.current && next.width > 0 && next.height > 0) {
        centered.current = true
        setView(centerOn(bounds, next))
      }
    },
    [bounds],
  )

  const toggleMarkers = () => {
    setMarkers(!markers)
    writeMarkersShown(!markers)
  }

  // The selection and the outline go away when the Preview switch turns on.
  const toggleOperate = () => {
    operate.toggle()
    selection.clear()
    setHover(null)
    setLinkFrame(null)
  }

  const middle = () => ({ x: (size.current?.width ?? 0) / 2, y: (size.current?.height ?? 0) / 2 })

  return (
    <main className="relative flex h-full">
      <div className="relative h-full min-w-0 flex-1">
        <Canvas
          view={view}
          onViewChange={setView}
          onResize={onResize}
          overlay={
            <>
              <Markers view={view} frames={layout.frames} documents={frameDocuments} shown={markers && !operating} />
              <SelectionOverlay
                view={view}
                frames={layout.frames}
                documents={frameDocuments}
                hover={hover}
                shown={!operating}
              />
              {library === null && <NoLibrary />}
              <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-center" role="status">
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
                onZoomOut={() => setView((current) => zoomStep(current, -1, middle()))}
                onZoomIn={() => setView((current) => zoomStep(current, 1, middle()))}
                onZoomReset={() => setView((current) => zoomAt(current, 1 / current.scale, middle()))}
                onCenter={() => size.current && setView(centerOn(bounds, size.current))}
                markers={markers}
                onToggleMarkers={toggleMarkers}
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
              overLink={operating && linkFrame === box.screen.id}
              marked={marked === box.screen.id}
            />
          ))}
        </Canvas>
      </div>
      <Inspector screenId={listed !== null && ids.has(listed) ? listed : null} documents={frameDocuments} />
      {narrow && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[color:var(--background)] p-6 text-center text-sm">
          The editor needs a window that is {minEditorWidth}px wide or more.
        </div>
      )}
    </main>
  )
}
