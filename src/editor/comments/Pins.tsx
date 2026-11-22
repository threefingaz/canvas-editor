import type { CSSProperties } from 'react'
import { FrameLayer } from '../canvas/FrameLayer.tsx'
import type { FrameBox } from '../canvas/layout.ts'
import type { View } from '../canvas/viewport.ts'
import { selectPlace } from '../inspector/select-place.ts'
import { canvasRectOf } from '../selection/geometry.ts'
import { cn } from '../ui/lib/utils.ts'
import { openPin } from './bubble-store.ts'
import { lostPin, pinPoint, pinSize, screenPin, type Pin } from './pins.ts'
import { useScreenPins } from './use-pins.ts'

// The layer of the pins of the comments, above the frames and the markers and
// below the selection layer: one pin at the top right corner of each element
// with comments, with its number, the count when it has more than one comment,
// and a mark when the agent replied. The comments on the screen and the lost
// ones are pins of the title row of the frame (`Frame.tsx`). The layer does
// not get the pointer; each pin does, thus a click on a pin is not a pick of
// the frame below it. A click on a pin selects its element and then opens
// the bubble with its comments (`CommentBubble.tsx`); the inspector then lists
// the screen of the pin, and its tab stays. With the Preview switch
// on (`shown` false) the layer draws nothing.
//
// One child for each frame reads the edits of its screen (`useScreenPins`),
// thus an edit renders only the pins of its screen again. The rectangles
// come from the shared measure of the screen; each render places them in the
// coordinates of the canvas (a new view, a new layout).

type PinsProps = {
  view: View
  frames: readonly FrameBox[]
  // The current document of each frame, by screen id.
  documents: ReadonlyMap<string, Document>
  shown: boolean
  // A click on a pin selected an element of this screen: the inspector lists
  // the screen.
  onList: (screenId: string) => void
}

export function Pins({ view, frames, documents, shown, onList }: PinsProps) {
  return (
    <FrameLayer frames={frames} documents={documents} shown={shown} layer="pin-layer">
      {(box, document) => <FramePins view={view} box={box} document={document} onList={onList} />}
    </FrameLayer>
  )
}

type FramePinsProps = { view: View; box: FrameBox; document: Document | null; onList: (screenId: string) => void }

function FramePins({ view, box, document, onList }: FramePinsProps) {
  const pins = useScreenPins(box.screen.id, document, true, (nodeRect) => canvasRectOf(view, box, nodeRect))
  if (!pins) return null
  return (
    <>
      {pins.map((pin) => {
        if (!pin.rect) return null
        const point = pinPoint(pin.rect, pinSize)
        return (
          <PinButton
            key={pin.key}
            pin={pin}
            screenId={box.screen.id}
            className="absolute"
            style={{ left: point.x, top: point.y }}
            onClick={() => {
              // The selection first: a new element closes an open bubble.
              if (document && selectPlace(box.screen.id, document, pin.key)) onList(box.screen.id)
              openPin(box.screen.id, pin)
            }}
          />
        )
      })}
    </>
  )
}

// The text of a pin for its title and for a screen reader.
function pinTitle(pin: Pin): string {
  const comments = pin.ids.length === 1 ? '1 comment' : `${pin.ids.length} comments`
  const where = pin.key === screenPin ? ' on the screen' : pin.key === lostPin ? ' whose element is not found' : ''
  return `Pin ${pin.number}: ${comments}${where}${pin.replied ? ', the agent replied' : ''}. Click to open.`
}

// One pin: a round mark with its number, the count of its comments when it
// has more than one, and a dot when the agent replied. The canvas layer and
// the title row of a frame draw it.
export function PinButton({
  pin,
  screenId,
  className,
  style,
  onClick,
}: {
  pin: Pin
  screenId: string
  className?: string
  style?: CSSProperties
  onClick: () => void
}) {
  const title = pinTitle(pin)
  return (
    <button
      type="button"
      className={cn(
        'pointer-events-auto relative flex h-5 min-w-5 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-full rounded-bl-none border-0 bg-[color:var(--accent)] px-1 text-[10px] leading-none font-semibold text-white tabular-nums shadow-sm',
        className,
      )}
      style={style}
      onClick={(event) => event.button === 0 && onClick()}
      title={title}
      aria-label={title}
      data-pin={pin.key}
      data-pin-screen={screenId}
      data-pin-number={pin.number}
      data-pin-replied={pin.replied ? '' : undefined}
    >
      {pin.number}
      {pin.ids.length > 1 && <span className="font-normal opacity-80">·{pin.ids.length}</span>}
      {pin.replied && (
        <span
          className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[color:var(--attention)] ring-1 ring-[color:var(--background)]"
          aria-hidden
        />
      )}
    </button>
  )
}
