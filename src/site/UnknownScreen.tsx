import { screenPrefix } from '../frame/screen-link.ts'
import { unknownTitle } from './route.ts'

// The page for an id that no screen has, with a link to the index. It imports
// nothing from the library, as the index. The address is written as the
// address has it (`address` of the route): an encoding of the decoded id
// would write an escape that cannot be decoded a second time.
export function UnknownScreen({ address }: { address: string }) {
  return (
    <main className="site-page">
      <h1 className="site-heading">{unknownTitle}</h1>
      <p className="site-note">No screen has the address “{address}”.</p>
      <p>
        <a className="site-back" href={screenPrefix}>
          All screens
        </a>
      </p>
    </main>
  )
}
