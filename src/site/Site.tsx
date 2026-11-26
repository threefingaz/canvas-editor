import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { screens } from 'virtual:canvas-screens'
import { RenderError } from '../frame/RenderError.tsx'
import { Index } from './Index.tsx'
import { changesPage, hashOf, routeOf, titleOf } from './route.ts'
import { UnknownScreen } from './UnknownScreen.tsx'

// The prototype site: the page of the hash of the address. A link to a screen
// is a plain address (`#/<screen id>`): the browser changes the hash, and the
// site shows the screen of the new hash. Back and Forward work the same way. A
// hash that is not a screen address (`#`, `#top`) is a place on the current
// page: the page stays.
//
// The page of a screen is loaded only when a screen shows: it imports the
// library, and the index and the page of an unknown screen have the styles of
// the site only.
const ScreenPage = lazy(() => import('./ScreenPage.tsx').then(({ ScreenPage }) => ({ default: ScreenPage })))

export function Site() {
  const [hash, setHash] = useState(() => hashOf(window.location.href))
  // The hash of the page that shows: a way back from a place on the page
  // (`#top`) to the same page keeps the place.
  const shown = useRef(hash)

  useEffect(() => {
    const onChange = () => {
      const next = hashOf(window.location.href)
      if (!changesPage(next) || next === shown.current) return
      shown.current = next
      setHash(next)
      // A new page starts at the top, as a page of a different address does.
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const route = routeOf(hash, screens)
  const title = titleOf(route)
  useEffect(() => {
    document.title = title
  }, [title])

  // The page of a screen that does not load (its part of the site, or the
  // library) shows the error, as an error of the screen does.
  if (route.kind === 'screen') {
    return (
      <RenderError key={route.screen.id} screen={route.screen.id}>
        <Suspense fallback={null}>
          <ScreenPage screen={route.screen} />
        </Suspense>
      </RenderError>
    )
  }
  if (route.kind === 'unknown') return <UnknownScreen address={route.address} />
  return <Index />
}
