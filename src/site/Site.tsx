import { Suspense, lazy, useEffect, useState } from 'react'
import { screens } from 'virtual:canvas-screens'
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

  useEffect(() => {
    const onChange = () => {
      const next = hashOf(window.location.href)
      if (!changesPage(next)) return
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

  if (route.kind === 'screen') {
    return (
      <Suspense fallback={null}>
        <ScreenPage key={route.screen.id} screen={route.screen} />
      </Suspense>
    )
  }
  if (route.kind === 'unknown') return <UnknownScreen id={route.id} />
  return <Index />
}
