import { useEffect, useState } from 'react'
import { screens } from 'virtual:canvas-screens'
import { Index } from './Index.tsx'
import { routeOf, type Route } from './route.ts'
import { ScreenPage, UnknownScreen } from './ScreenPage.tsx'

// The prototype site: the page of the hash of the address. A link to a screen
// is a plain address (`#/<screen id>`): the browser changes the hash, and the
// site shows the screen of the new hash. Back and Forward work the same way.

function titleOf(route: Route): string {
  if (route.kind === 'screen') return route.screen.title
  if (route.kind === 'unknown') return 'Unknown screen'
  return 'Screens'
}

export function Site() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash)
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

  if (route.kind === 'screen') return <ScreenPage key={route.screen.id} screen={route.screen} />
  if (route.kind === 'unknown') return <UnknownScreen id={route.id} />
  return <Index />
}
