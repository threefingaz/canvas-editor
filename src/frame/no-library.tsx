import type { ReactNode } from 'react'
import { connectSentence } from './library-setup.ts'
import { FrameMessage } from './RenderError.tsx'

// The wrapper of a screen when no library is connected (`tools/library.ts`).
// A screen needs the library, thus the frame shows this message in place of
// the screen.
export function LibraryProvider(_props: { children: ReactNode }) {
  return <FrameMessage title="No library is connected" detail={connectSentence} />
}
