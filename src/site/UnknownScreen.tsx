import { screenHash, screenPrefix } from '../frame/screen-link.ts'
import { unknownTitle } from './route.ts'

// The page for an id that no screen has, with a link to the index. It imports
// nothing from the library, as the index. The address is written as the editor
// writes it (`screenHash`).
export function UnknownScreen({ id }: { id: string }) {
  return (
    <main className="site-page">
      <h1 className="site-heading">{unknownTitle}</h1>
      <p className="site-note">No screen has the address “{screenHash(id)}”.</p>
      <p>
        <a className="site-back" href={screenPrefix}>
          All screens
        </a>
      </p>
    </main>
  )
}
