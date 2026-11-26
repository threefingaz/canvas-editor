import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

// Small hooks that more than one part of the editor shares.

// The least width of the editor window; a narrower window shows a message
// over the editor (`App.tsx`), and the keys of the editor do nothing behind
// it.
export const minEditorWidth = 1024
export const narrowQuery = `(max-width: ${minEditorWidth - 1}px)`

// A listener of the keys of the window that calls the latest `handler`, thus
// it is added once and reads the current state of its caller. In a window
// that is too narrow for the editor it calls nothing: the user does not see
// what a key would do.
export function useWindowKeys(handler: (event: KeyboardEvent) => void) {
  const latest = useRef(handler)
  useLayoutEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (window.matchMedia(narrowQuery).matches) return
      latest.current(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

// Gives the text area the focus, with the caret after its text, when the box
// opens with `autoFocus`, and again when `autoFocus` turns on.
export function useFocusAtEnd(area: RefObject<HTMLTextAreaElement | null>, autoFocus: boolean | undefined) {
  useEffect(() => {
    const node = area.current
    if (!autoFocus || !node) return
    node.focus()
    node.setSelectionRange(node.value.length, node.value.length)
  }, [area, autoFocus])
}
