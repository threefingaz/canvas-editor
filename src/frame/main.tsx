import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { LibraryProvider } from 'virtual:canvas-library'
import { modules } from 'virtual:canvas-screen-modules'
import { FrameMessage, RenderError } from './RenderError.tsx'
import { screenIdFromSearch, screenLoader, screensChangedEvent } from './screen-id.ts'

// The entry of a frame: one screen in the wrapper of the library. It has no
// Tailwind and no editor styles, thus the screen gets only its own styles. The
// wrapper comes from the library pack through `virtual:canvas-library`
// (`tools/library-plugin.ts`); the frame imports nothing from a pack. The
// screen files are those of the project, through
// `virtual:canvas-screen-modules` (`tools/screens-plugin.ts`). The frame
// server serves this entry with the React of the project
// (`tools/react-resolve.ts`).

const id = screenIdFromSearch(window.location.search)

function frameContent() {
  if (id === null) {
    return <FrameMessage title="No screen" detail="The address has no `screen` parameter." />
  }
  const load = screenLoader(id, modules)
  if (load === null) {
    return <FrameMessage title={`Unknown screen "${id}"`} detail="No file in the screens folder has this id." />
  }
  document.title = id
  const Screen = lazy(load)
  return (
    <RenderError screen={id}>
      <Suspense fallback={null}>
        <LibraryProvider>
          <Screen />
        </LibraryProvider>
      </Suspense>
    </RenderError>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode>{frameContent()}</StrictMode>)

// A change in the screens folder reloads only the frames of the changed
// screens; the dev server sends their ids (`tools/screens-plugin.ts`).
if (import.meta.hot) {
  import.meta.hot.on(screensChangedEvent, ({ ids }: { ids: string[] }) => {
    if (id !== null && ids.includes(id)) window.location.reload()
  })
}
