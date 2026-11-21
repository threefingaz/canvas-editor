import { library, screens, type ScreenEntry } from 'virtual:canvas-screens'
import { connectSentence } from '../frame/library-setup.ts'
import { screenHash } from '../frame/screen-link.ts'
import { flowGroups, flowTitle } from './index-model.ts'
import { indexTitle } from './route.ts'

// The index of the prototype site: the screens by flow, each as a link to its
// full page. A base screen has its states below it, indented; the options are
// not in the index. It has the styles of `site.css` only, thus it is the same
// with each library and with no library.
export function Index() {
  const flows = flowGroups(screens)
  return (
    <main className="site-page">
      <h1 className="site-heading">{indexTitle}</h1>
      {library === null ? <p className="site-note">No library is connected. {connectSentence}</p> : null}
      {flows.length === 0 ? <p className="site-note">There is no screen yet.</p> : null}
      {flows.map((flow) => (
        <section key={flow.flow} className="site-flow">
          <h2 className="site-flow-title">{flowTitle(flow.flow)}</h2>
          <ul className="site-list">
            {flow.groups.map((group) => (
              <li key={group.base.id}>
                <ScreenLink screen={group.base} />
                {group.states.length > 0 ? (
                  <ul className="site-states" aria-label={`States of ${group.base.title}`}>
                    {group.states.map((state) => (
                      <li key={state.id}>
                        <ScreenLink screen={state} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}

// The link of one screen, with the error of its file below it.
function ScreenLink({ screen }: { screen: ScreenEntry }) {
  return (
    <>
      <a className="site-link" href={screenHash(screen.id)}>
        <span className="site-link-title">{screen.title}</span>
        <span className="site-link-width">{screen.width} px</span>
      </a>
      {screen.error ? <p className="site-error">{screen.error}</p> : null}
    </>
  )
}
