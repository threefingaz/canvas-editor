import { StrictMode, Suspense, lazy, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { LibraryProvider } from 'virtual:canvas-library'
import { FrameMessage, RenderError } from './RenderError.tsx'
import { screenIdFromSearch, screenModuleKey, screensChangedEvent } from './screen-id.ts'

// The entry of a frame: one screen in the wrapper of the library. It has no
// Tailwind and no editor styles, thus the screen gets only its own styles. The
// wrapper comes from the library pack through `virtual:canvas-library`
// (`tools/library-plugin.ts`); the frame imports nothing from a pack.

type ScreenModule = { default: ComponentType }

// The pattern must be a literal for the dev server. It is the screens folder
// of `canvas.config.ts` (see `screenModuleKey`).
const modules = import.meta.glob<ScreenModule>('/screens/**/*.tsx')

const id = screenIdFromSearch(window.location.search)

function frameContent() {
  if (id === null) {
    return <FrameMessage title="No screen" detail="The address has no `screen` parameter." />
  }
  const key = screenModuleKey(id, Object.keys(modules))
  if (key === null) {
    return <FrameMessage title={`Unknown screen "${id}"`} detail="No file in the screens folder has this id." />
  }
  document.title = id
  const Screen = lazy(modules[key])
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
