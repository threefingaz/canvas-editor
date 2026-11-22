import { useSyncExternalStore } from 'react'
import type { LinkPair } from '../../related/links.ts'
import { rowGap } from './layout.ts'
import { flowArrows, flowFrames, flowLabels, flowLinks, headHalf, headLength, type FlowBox, type FlowFocus } from './flow.ts'
import { linkRects } from './link-rects.ts'
import { titleRowHeight } from './title.ts'
import type { View } from './viewport.ts'

// The layer of the flow, the lowest layer of the overlay of the canvas: an
// arrow for each link between two screens, as an arc above the title rows of
// the frames, and the name of each flow at the left of its row (`flow.ts`).
// It is in the editor document and writes nothing into a frame. Neither the
// layer nor a part of it gets the pointer, thus a click goes to the frame or
// the title below it. The arrows show with the Preview switch on too: they
// help to review a flow. The switch of the toolbar hides them (`arrows`
// false); the names always show.
//
// An arrow starts at the link element of its link: a dot at the middle of
// the element and a thin stem from it to the arc. The layer reads the
// rectangles of the link elements from the store that the measure of each
// frame writes (`link-rects.ts`); it reads no frame, thus a pan step only
// places them. With a listed screen, the arrows that leave it are strong,
// the arrows that reach it are strong and dashed, and the other arrows are
// weak.

// The distance of an arrow from the top edge of a frame: the title row and a
// little more, thus the title stays free.
const clearance = titleRowHeight + 4
// The distance of the name of a flow from its first frame.
const labelGap = 16

// The look of an arrow by its focus (`flowFocus`); null is an arrow with no
// listed screen.
const looks: Record<FlowFocus | 'none', { opacity: number; width: number; dash?: string }> = {
  none: { opacity: 0.55, width: 1.5 },
  out: { opacity: 1, width: 2 },
  in: { opacity: 1, width: 2, dash: '5 4' },
  off: { opacity: 0.18, width: 1 },
}

// The radius of the dot at a link element, in px on the screen.
const dotRadius = 2.5

type FlowLayerProps = {
  view: View
  frames: readonly FlowBox[]
  // The links between the screens (`linkPairs`).
  pairs: readonly LinkPair[]
  // False hides the arrows.
  arrows: boolean
  // The screen of the Changes tab, or null: its arrows are strong.
  listed: string | null
}

export function FlowLayer({ view, frames, pairs, arrows, listed }: FlowLayerProps) {
  const rects = useSyncExternalStore(linkRects.subscribe, linkRects.get, linkRects.get)
  const placed = flowFrames(frames, view)
  // The room for the arcs above a row: the space between two rows less the
  // title row, and a little less, thus an arc does not touch the row above.
  const room = rowGap * view.scale - clearance - 4
  const drawn = arrows ? flowArrows(placed, pairs, clearance, room, flowLinks(frames, view, rects), listed) : []
  // The arrows of the listed screen are drawn last, above the weak ones.
  const ordered = [...drawn.filter((arrow) => arrow.focus === null || arrow.focus === 'off'), ...drawn.filter((arrow) => arrow.focus === 'out' || arrow.focus === 'in')]
  return (
    <div className="pointer-events-none absolute inset-0 overflow-clip" data-flow-layer="">
      {arrows && (
        <svg className="absolute inset-0 size-full" aria-hidden>
          {ordered.map((arrow) => {
            const look = looks[arrow.focus ?? 'none']
            const focus = arrow.focus === 'out' || arrow.focus === 'in' ? arrow.focus : undefined
            return (
              <g key={`${arrow.from} ${arrow.to}`} opacity={look.opacity} data-flow-arrow={`${arrow.from} ${arrow.to}`} data-flow-focus={focus}>
                {arrow.stem !== null && <path d={arrow.stem} fill="none" stroke="var(--accent)" strokeWidth={1} strokeLinecap="round" data-flow-stem="" />}
                {arrow.dot !== null && <circle cx={arrow.dot.x} cy={arrow.dot.y} r={dotRadius} fill="var(--accent)" data-flow-dot="" />}
                <path
                  d={arrow.d}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={look.width}
                  strokeLinecap="round"
                  strokeDasharray={look.dash}
                />
                <path
                  d={`M 0 0 L ${-headHalf} ${-headLength} L ${headHalf} ${-headLength} Z`}
                  fill="var(--accent)"
                  transform={`translate(${arrow.tip.x} ${arrow.tip.y}) rotate(${arrow.angle})`}
                />
              </g>
            )
          })}
        </svg>
      )}
      {flowLabels(placed, titleRowHeight, labelGap).map((label) => (
        <span
          key={label.flow}
          className="absolute flex -translate-x-full items-end pb-1.5 text-xs whitespace-nowrap text-[color:var(--muted-foreground)]"
          style={{ left: label.x, top: label.y, height: titleRowHeight }}
          data-flow-label={label.flow}
        >
          {label.flow}
        </span>
      ))}
    </div>
  )
}
