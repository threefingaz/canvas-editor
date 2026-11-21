import { ArrowSquareOutIcon, CheckCircleIcon, CheckIcon, LinkBreakIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import type { ScreenEntry } from 'virtual:canvas-screens'
import { screenHash } from '../../frame/screen-link.ts'
import { relationOf } from '../../related/groups.ts'
import { siteEntry } from '../../site/entry.ts'
import { frameWindowOf } from '../frame-window.ts'
import { keepView, type KeepState } from '../edits/keep.ts'
import { edits, useScreenEdits } from '../edits/store.ts'
import { keepEdit } from '../inspector/edit.ts'
import { useIssues } from '../issues/collect.ts'
import { useScreenIssues } from '../issues/store.ts'
import { usePreview } from '../preview/use-preview.ts'
import { toFramePoint } from '../selection/geometry.ts'
import { cn } from '../ui/lib/utils.ts'
import { defaultFrameHeight, measureHeight, type FrameBox } from './layout.ts'
import type { Point } from './viewport.ts'

// One screen on the canvas: its title above, and an iframe with
// `frame.html?screen=<id>` at the width of the screen. The height follows the
// content of the frame document: it is measured at the least height of the
// layout (`measureHeight` in `layout.ts`) on load, on a size change of the
// root, and on a change of the frame document. A transparent layer covers the
// iframe, thus the canvas gets the pointer and the wheel, and a click does not
// operate the screen: a link does not navigate. The layer gives the pointer
// position in frame coordinates, for the selection, and with the Preview
// switch on (`operate.ts`) for the links. The frame keeps the preview of the
// edits of its screen in its document (`usePreview`), and reads the Issues
// list of the screen from it (`useIssues`). The count of issues is next to
// the title. A click on the title or on the count shows the Issues list and
// the Changes list of the screen in the inspector. A button in the title opens
// the screen as a full page of the prototype site, in a new tab. A link of a
// different frame that goes to this screen marks the frame for a short time.
// The title of a state has the mark "State" before it, and the title of an
// option the mark "Option"; a frame with options says how many it has. A
// relation that breaks a rule of the list (`relationError`) has a mark with
// its cause. The title of an option has the button "Keep this option"
// (`keepBase`), off with the reason of `keepState`; while the base has an
// open `keep` of the option, the button says so and the frame has a dashed
// mark. Only the frame of an option reads the edits of its base, thus an edit
// renders only the frames of the options of that screen again.

// The button "Keep this option": its state (`keepState`) and the action that
// adds the `keep` item to the edits of the base.
type KeepControl = { state: KeepState; onKeep: () => void }

// The base of an option: its id and the width of its frame, for the `keep`
// item.
export type KeepBase = { id: string; width: number }

type FrameProps = {
  box: FrameBox<ScreenEntry>
  // The ids of the list of screens: the Issues list reads the links with them.
  screenIds: readonly string[]
  // The scale of the canvas; the title keeps its size on the screen.
  scale: number
  onHeight: (id: string, height: number) => void
  // Called on each load of the frame document. An edit of the screen file
  // reloads the frame, thus the document is new each time.
  onLoad: (id: string, document: Document) => void
  // The pointer moves above the frame (a point) or leaves it (null).
  onHover: (id: string, point: Point | null) => void
  // A click on the frame.
  onPick: (id: string, point: Point) => void
  // A click on the title of the frame.
  onTitle: (id: string) => void
  // The pointer is above a link, with the Preview switch on: the cursor of a
  // link.
  overLink: boolean
  // The frame is the target of the last link: a mark around it.
  marked: boolean
  // The count of the options of this screen (`optionsOf`).
  optionCount: number
  // The base of this screen when it is an option, for the button "Keep this
  // option" and the mark of a kept option; null for a screen that is not an
  // option.
  keepBase: KeepBase | null
  // The Preview switch is on: no button "Keep this option".
  operating: boolean
}

export function Frame({
  box,
  screenIds,
  scale,
  onHeight,
  onLoad,
  onHover,
  onPick,
  onTitle,
  overLink,
  marked,
  optionCount,
  keepBase,
  operating,
}: FrameProps) {
  const { screen } = box
  // The edits of the base of an option; a screen that is not an option reads
  // no list.
  const baseEdits = useScreenEdits(keepBase?.id ?? null)
  const { state: keepNow, kept } = keepView(screen.id, keepBase ? baseEdits : null, operating)
  const keep: KeepControl | null =
    keepBase && keepNow
      ? { state: keepNow, onKeep: () => edits.apply(keepBase.id, keepEdit(keepBase.width, screen.id)) }
      : null
  // Stops the watch of the current frame document.
  const stop = useRef<(() => void) | null>(null)
  // The current frame document; a reload gives a new one.
  const [frameDocument, setFrameDocument] = useState<Document | null>(null)
  usePreview(screen.id, screen.error ? null : frameDocument)
  useIssues(screen, screen.error ? null : frameDocument, screenIds)

  // The watch of the frame lives longer than one render; it calls the latest
  // `onHeight`.
  const heightCallback = useRef(onHeight)
  useLayoutEffect(() => {
    heightCallback.current = onHeight
  })

  // The layer has the size and the place of the iframe on the screen.
  const framePoint = (event: MouseEvent<HTMLDivElement>) =>
    toFramePoint({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect(), scale)

  useEffect(() => () => stop.current?.(), [])

  const attach = (iframe: HTMLIFrameElement) => {
    stop.current?.()
    stop.current = null
    const document = iframe.contentDocument
    // The observers of the frame window: the nodes are in that document.
    const view = frameWindowOf(document)
    if (!document || !view) return

    // The measure writes only the iframe in the editor document, never the
    // frame document, thus it starts no mutation record. A result that is
    // equal to the last one is not reported, and the root keeps its size, thus
    // the size observer does not start a new measure either.
    let last: number | null = null
    let pending = 0
    const measure = () => {
      pending = 0
      const height = measureHeight(iframe)
      if (height === null || height === last) return
      last = height
      heightCallback.current(screen.id, height)
    }
    // At most one measure for each animation frame.
    const schedule = () => {
      if (pending === 0) pending = requestAnimationFrame(measure)
    }
    // The size observer alone is not sufficient: when the content of a
    // `100vh` screen gets smaller, the root keeps the height of the iframe.
    const resize = new view.ResizeObserver(schedule)
    resize.observe(document.documentElement)
    const mutations = new view.MutationObserver(schedule)
    mutations.observe(document, { childList: true, subtree: true, attributes: true, characterData: true })
    stop.current = () => {
      resize.disconnect()
      mutations.disconnect()
      if (pending !== 0) cancelAnimationFrame(pending)
      pending = 0
    }

    measure()
    setFrameDocument(document)
    onLoad(screen.id, document)
  }

  return (
    <Placed
      box={box}
      title={screen.title}
      width={screen.width}
      scale={scale}
      marked={marked}
      optionCount={optionCount}
      keep={keep}
      kept={kept}
      onTitle={() => onTitle(screen.id)}
    >
      {screen.error ? (
        <div
          role="alert"
          className="size-full overflow-auto border border-[color:var(--destructive)] bg-[color:var(--background)] p-6 text-sm"
          data-frame-error=""
        >
          <strong className="text-[color:var(--destructive)]">The screen file cannot be read</strong>
          <pre className="mt-3 font-mono text-xs whitespace-pre-wrap">{screen.error}</pre>
        </div>
      ) : (
        <>
          {/* The measure sets the height (`measureHeight`); it starts at the
              least height. */}
          <iframe
            className="block w-full border-0 bg-white"
            style={{ height: defaultFrameHeight }}
            onLoad={(event) => attach(event.currentTarget)}
            src={`/frame.html?${new URLSearchParams({ screen: screen.id })}`}
            tabIndex={-1}
            title={screen.title}
          />
          <div
            className={cn('absolute inset-0', overLink && 'cursor-pointer')}
            data-frame-overlay={screen.id}
            onPointerMove={(event) => onHover(screen.id, framePoint(event))}
            onPointerLeave={() => onHover(screen.id, null)}
            onClick={(event) => event.button === 0 && onPick(screen.id, framePoint(event))}
          />
        </>
      )}
    </Placed>
  )
}

type PlacedProps = {
  box: FrameBox<ScreenEntry>
  title: string
  width: number
  scale: number
  marked: boolean
  optionCount: number
  keep: KeepControl | null
  kept: boolean
  onTitle: () => void
  children: ReactNode
}

// The mark of a state or an option before the title.
const relationMark = { state: 'State', option: 'Option' } as const

// The width of the mark around a frame, and its distance from the frame, in
// px on the screen.
const markWidth = 3
const markOffset = 4

// The box of a frame in world coordinates, with the title above it.
function Placed({ box, title, width, scale, marked, optionCount, keep, kept, onTitle, children }: PlacedProps) {
  const relation = relationOf(box.screen)
  const { relationError } = box.screen
  return (
    <div
      className="absolute shadow-sm"
      data-frame={box.screen.id}
      data-frame-marked={marked ? '' : undefined}
      data-frame-kept={kept ? '' : undefined}
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        // The mark keeps its size on the screen at each zoom. The mark of a
        // link target wins over the mark of a kept option.
        outline: marked
          ? `${markWidth / scale}px solid var(--link)`
          : kept
            ? `${markWidth / scale}px dashed var(--accent)`
            : undefined,
        outlineOffset: marked || kept ? markOffset / scale : undefined,
      }}
    >
      {/* The title is scaled back, thus its text keeps one size at each zoom.
          The row is as wide as the frame on the screen and clips what does
          not fit, thus at a low zoom it does not cover the title of the next
          frame; the title gets shorter first. */}
      <div
        className="absolute bottom-full left-0 flex origin-bottom-left gap-2 overflow-hidden pb-1.5 text-xs whitespace-nowrap text-[color:var(--muted-foreground)]"
        style={{ width: box.width * scale, transform: `scale(${1 / scale})` }}
      >
        {relation !== 'base' && (
          <span
            className="shrink-0 rounded-sm bg-[color:var(--muted)] px-1 font-medium text-[color:var(--foreground)]"
            data-frame-relation={relation}
          >
            {relationMark[relation]}
          </span>
        )}
        <button
          type="button"
          className="min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-[color:var(--foreground)] hover:underline"
          title="Show the issues and the changes of this screen"
          onClick={(event) => event.button === 0 && onTitle()}
          data-frame-title={box.screen.id}
        >
          {title}
        </button>
        {optionCount > 0 && (
          <span className="shrink-0" data-frame-options={optionCount}>
            {optionCount === 1 ? '1 option' : `${optionCount} options`}
          </span>
        )}
        <span className="shrink-0 tabular-nums">{width}</span>
        {relationError !== undefined && (
          <span
            className="flex min-w-0 shrink items-center gap-1 text-[color:var(--attention)]"
            title={relationError}
            data-frame-relation-error=""
          >
            <LinkBreakIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{relationError}</span>
          </span>
        )}
        <IssueCount screenId={box.screen.id} onClick={onTitle} />
        {keep && <KeepButton {...keep} />}
        <a
          className="flex shrink-0 items-center text-inherit hover:text-[color:var(--foreground)]"
          href={`/${siteEntry}${screenHash(box.screen.id)}`}
          target="_blank"
          rel="noreferrer"
          title="Open as a full page"
          aria-label="Open as a full page"
          data-frame-open={box.screen.id}
        >
          <ArrowSquareOutIcon className="size-3.5" aria-hidden />
        </a>
      </div>
      {children}
    </div>
  )
}

// The button "Keep this option" in the title of an option. Off with the
// reason in its title when the option cannot be kept; with the open `keep` of
// this option it shows "Kept" and is off too: undo or discard takes it away.
function KeepButton({ state, onKeep }: KeepControl) {
  const kept = state.kind === 'kept'
  const reasonId = useId()
  const title =
    state.kind === 'blocked'
      ? state.reason
      : kept
        ? 'The request to keep this option is open. The agent writes it into its base screen.'
        : 'Ask the agent to write this option into its base screen and remove the other options'
  return (
    <button
      type="button"
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-sm border-0 px-1 font-medium',
        kept
          ? 'bg-[color:var(--accent)] text-[color:var(--accent-foreground)]'
          : 'bg-[color:var(--muted)] text-[color:var(--foreground)]',
        state.kind === 'free' ? 'cursor-pointer hover:underline' : 'cursor-default',
        state.kind === 'blocked' && 'opacity-60',
      )}
      title={title}
      aria-disabled={state.kind !== 'free'}
      aria-describedby={reasonId}
      onClick={() => state.kind === 'free' && onKeep()}
      data-frame-keep={state.kind}
    >
      {kept && <CheckIcon className="size-3.5" aria-hidden />}
      {kept ? 'Kept' : 'Keep this option'}
      {/* The reason of the title for a screen reader too. */}
      <span id={reasonId} className="sr-only">
        {title}
      </span>
    </button>
  )
}

// The count of issues of a screen, next to its title; nothing before the
// first reading. A click shows the Issues list of the screen.
function IssueCount({ screenId, onClick }: { screenId: string; onClick: () => void }) {
  const list = useScreenIssues(screenId)
  if (list === undefined) return null
  const count = list.length
  return (
    <button
      type="button"
      className={cn(
        'flex shrink-0 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 tabular-nums hover:underline',
        count > 0 ? 'text-[color:var(--attention)]' : 'text-inherit',
      )}
      title={`${count === 1 ? '1 issue' : `${count} issues`}: show the Issues list of this screen`}
      aria-label={count === 1 ? '1 issue' : `${count} issues`}
      onClick={(event) => event.button === 0 && onClick()}
      data-frame-issues={count}
    >
      {count > 0 ? <WarningCircleIcon className="size-3.5" aria-hidden /> : <CheckCircleIcon className="size-3.5" aria-hidden />}
      {count}
    </button>
  )
}
