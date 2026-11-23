import { Suspense, lazy, useEffect, type ComponentType, type LazyExoticComponent } from 'react'
import { LibraryProvider } from 'virtual:canvas-library'
// The list is imported here only for the dev server: a new screen file changes
// the list, the update of the list refreshes this module, and the map of the
// screen modules below then has the new file (the screens plugin gives its
// address a new query). A module with no import of the list keeps the old map
// until a full reload.
import 'virtual:canvas-screens'
import type { ScreenEntry } from 'virtual:canvas-screens'
import { modules } from 'virtual:canvas-screen-modules'
import { RenderError } from '../frame/RenderError.tsx'
import { screenLoader, screensChangedEvent } from '../frame/screen-id.ts'
import { UnknownScreen } from './UnknownScreen.tsx'

// One screen of the prototype site as the full page: the screen in the wrapper
// of the library, with the width of the browser window. It has no editor
// styles and no styles of the site, as in a frame of the canvas. It is the only
// module of the site that imports the library: `Site.tsx` loads it only for a
// screen, thus the index and the page of an unknown screen get no styles of
// the library.

// One lazy component for each screen module, by the id of the screen; it
// loads the module only when it renders the first time.
const components: Record<string, LazyExoticComponent<ComponentType>> = Object.fromEntries(
  Object.entries(modules).map(([id, load]) => [id, lazy(load)]),
)

export function ScreenPage({ screen }: { screen: ScreenEntry }) {
  const { id } = screen

  // In the dev server, a change of the screen file reloads the page, as it
  // reloads the frame of the screen on the canvas (`tools/screens-plugin.ts`).
  useEffect(() => {
    const hot = import.meta.hot
    if (!hot) return
    const onChange = ({ ids }: { ids: string[] }) => {
      if (ids.includes(id)) window.location.reload()
    }
    hot.on(screensChangedEvent, onChange)
    return () => hot.off(screensChangedEvent, onChange)
  }, [id])

  if (screenLoader(id, components) === null) return <UnknownScreen id={id} />
  const Screen = components[id]
  return (
    <RenderError key={id} screen={id}>
      <Suspense fallback={null}>
        <LibraryProvider>
          <Screen />
        </LibraryProvider>
      </Suspense>
    </RenderError>
  )
}
