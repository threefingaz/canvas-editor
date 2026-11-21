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
type State = { error: unknown }

// The short text of an error: its message, for the Issues list.
function errorText(error: unknown): string {
  return error instanceof Error ? error.message || error.name : String(error)
}

// Catches an error when the screen loads or renders, and shows its text in the
// frame in place of the screen. While it shows the error, the root element of
// the frame document has the error text in `data-canvas-error`; when the
// screen renders, the attribute goes.
export class RenderError extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error }
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
    const { error } = this.state
    const root = document.documentElement
    if (error === null) root.removeAttribute(renderErrorAttribute)
    else root.setAttribute(renderErrorAttribute, errorText(error))
  }

  render() {
    const { error } = this.state
    if (error === null) return this.props.children
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
    return <FrameMessage title={`The screen "${this.props.screen}" failed`} detail={detail} />
  }
}
