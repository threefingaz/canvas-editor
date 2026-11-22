import { Fragment, type ReactNode } from 'react'
import type { FrameBox } from './layout.ts'

// A layer of the overlay of the canvas with one part for each frame that has
// a document (a frame of a screen file that cannot be read has none): the
// pins of the comments, the marks of the open edits. The layer clips to the
// canvas and does not get the pointer; a part can take it. With `shown`
// false (the Preview switch, the markers switch) it draws nothing. `layer`
// is the name of its data attribute, for a check from the console.

export type FrameLayerName = 'pin-layer' | 'edit-mark-layer'

type FrameLayerProps = {
  frames: readonly FrameBox[]
  // The current document of each frame, by screen id.
  documents: ReadonlyMap<string, Document>
  shown: boolean
  layer: FrameLayerName
  children: (box: FrameBox, document: Document | null) => ReactNode
}

export function FrameLayer({ frames, documents, shown, layer, children }: FrameLayerProps) {
  if (!shown) return null
  return (
    <div className="pointer-events-none absolute inset-0 overflow-clip" {...{ [`data-${layer}`]: '' }}>
      {frames.map((box) =>
        box.screen.error ? null : <Fragment key={box.screen.id}>{children(box, documents.get(box.screen.id) ?? null)}</Fragment>,
      )}
    </div>
  )
}
