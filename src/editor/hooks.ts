import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

// Small hooks that more than one part of the editor shares.

// A listener of the keys of the window that calls the latest `handler`, thus
// it is added once and reads the current state of its caller.
export function useWindowKeys(handler: (event: KeyboardEvent) => void) {
  const latest = useRef(handler)
  useLayoutEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => latest.current(event)
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
