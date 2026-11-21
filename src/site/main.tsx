import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './site.css'
import { Site } from './Site.tsx'

// The entry of the prototype site. It only renders the site: the list of
// screens is imported in the modules of the components (`Site.tsx`,
// `Index.tsx`, `ScreenPage.tsx`), which the dev server refreshes in place when
// the list changes. A module that calls `createRoot` cannot be refreshed: if it
// imported the list, each new screen would reload each page, the editor too.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Site />
  </StrictMode>,
)
