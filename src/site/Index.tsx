import { library, screens } from 'virtual:canvas-screens'
import { connectSentence } from '../frame/library-setup.ts'
import { screenHash } from '../frame/screen-link.ts'
import { flowGroups, flowTitle } from './index-model.ts'

// The index of the prototype site: the screens by flow, each as a link to its
// full page. It has the styles of `site.css` only, thus it is the same with
// each library and with no library.
export function Index() {
  const groups = flowGroups(screens)
  return (
    <main className="site-page">
      <h1 className="site-heading">Screens</h1>
      {library === null ? <p className="site-note">No library is connected. {connectSentence}</p> : null}
      {groups.length === 0 ? <p className="site-note">There is no screen yet.</p> : null}
      {groups.map((group) => (
        <section key={group.flow} className="site-flow">
          <h2 className="site-flow-title">{flowTitle(group.flow)}</h2>
          <ul className="site-list">
            {group.screens.map((screen) => (
              <li key={screen.id}>
                <a className="site-link" href={screenHash(screen.id)}>
                  <span className="site-link-title">{screen.title}</span>
                  <span className="site-link-width">{screen.width} px</span>
                </a>
                {screen.error ? <p className="site-error">{screen.error}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
