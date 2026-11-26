import { Component, type ErrorInfo, type ReactNode } from 'react'
import { renderErrorAttribute } from './screen-id.ts'

// The frame has no editor styles and no Tailwind, thus the message has inline
// styles only. No `100vh` here: the frame takes the height of its document,
// and a document that grows with its frame grows with no end.
const messageStyle = {
  boxSizing: 'border-box',
  margin: 0,
  padding: 24,
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
  lineHeight: 1.5,
  color: '#7f1d1d',
  background: '#fef2f2',
} as const

const detailStyle = {
  margin: '12px 0 0',
  whiteSpace: 'pre-wrap',
  // A long address of a stack breaks, thus a narrow frame shows it whole.
  overflowWrap: 'anywhere',
  fontFamily: 'ui-monospace, monospace',
  fontSize: 12,
} as const

// A message in place of the screen: an unknown id, or an error of the screen.
export function FrameMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <div role="alert" data-frame-message="" style={messageStyle}>
      <strong>{title}</strong>
      {detail ? <pre style={detailStyle}>{detail}</pre> : null}
    </div>
  )
}

type Props = { screen: string; children: ReactNode }
// `failed` and not the error itself says that there is an error: a screen can
// throw `null` or `undefined` too.
type State = { failed: false } | { failed: true; error: unknown }

// The short text of an error: its message, for the Issues list. It is never
// empty: an issue needs a text.
function errorText(error: unknown): string {
  let text: string
  try {
    text = error instanceof Error ? error.message || error.name : String(error)
  } catch {
    // A value with no text form: a symbol is fine, an object with no
    // prototype (`Object.create(null)`) throws.
    text = Object.prototype.toString.call(error)
  }
  return text.trim() === '' ? 'The screen failed with no message' : text
}

// Catches an error when the screen loads or renders, and shows its text in the
// frame in place of the screen. While it shows the error, the root element of
// the frame document has the error text in `data-canvas-error`; when the
// screen renders, the attribute goes.
export class RenderError extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`The screen "${this.props.screen}" failed`, error, info.componentStack)
  }

  componentDidMount() {
    this.markError()
  }

  componentDidUpdate() {
    this.markError()
  }

  componentWillUnmount() {
    document.documentElement.removeAttribute(renderErrorAttribute)
  }

  private markError() {
    const state = this.state
    const root = document.documentElement
    if (!state.failed) root.removeAttribute(renderErrorAttribute)
    else root.setAttribute(renderErrorAttribute, errorText(state.error))
  }

  render() {
    const state = this.state
    if (!state.failed) return this.props.children
    const { error } = state
    const detail = error instanceof Error ? error.stack || errorText(error) : errorText(error)
    return <FrameMessage title={`The screen "${this.props.screen}" failed`} detail={detail} />
  }
}
