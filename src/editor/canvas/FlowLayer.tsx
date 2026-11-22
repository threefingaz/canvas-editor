import type { LinkPair } from '../../related/links.ts'
import { rowGap } from './layout.ts'
import { flowArrows, flowFrames, flowLabels, headHalf, headLength, type FlowBox } from './flow.ts'
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

// The distance of an arrow from the top edge of a frame: the title row and a
// little more, thus the title stays free.
const clearance = titleRowHeight + 4
// The distance of the name of a flow from its first frame.
const labelGap = 16

type FlowLayerProps = {
  view: View
  frames: readonly FlowBox[]
  // The links between the screens (`linkPairs`).
  pairs: readonly LinkPair[]
  // False hides the arrows.
  arrows: boolean
}

export function FlowLayer({ view, frames, pairs, arrows }: FlowLayerProps) {
  const placed = flowFrames(frames, view)
  return (
    <div className="pointer-events-none absolute inset-0 overflow-clip" data-flow-layer="">
      {arrows && (
        <svg className="absolute inset-0 size-full" aria-hidden>
          {flowArrows(placed, pairs, clearance, rowGap * view.scale - clearance).map((arrow) => (
            <g key={`${arrow.from} ${arrow.to}`} opacity={0.7} data-flow-arrow={`${arrow.from} ${arrow.to}`}>
              <path d={arrow.d} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinecap="round" />
              <path
                d={`M 0 0 L ${-headHalf} ${-headLength} L ${headHalf} ${-headLength} Z`}
                fill="var(--accent)"
                transform={`translate(${arrow.tip.x} ${arrow.tip.y}) rotate(${arrow.angle})`}
              />
            </g>
          ))}
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
