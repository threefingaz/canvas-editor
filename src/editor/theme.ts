import { useCallback, useLayoutEffect, useState } from 'react'
import { useMediaQuery } from './media-query.ts'

// The editor theme follows the light or dark setting of the system. The user
// can choose a theme with the switch; the choice is kept in `localStorage`.
// A switch back to the theme of the system clears the choice, thus the editor
// follows the system again.

export type EditorTheme = 'light' | 'dark'

// null: no choice, follow the system.
export type ThemeChoice = EditorTheme | null

const storageKey = 'canvas-editor-theme'
const darkQuery = '(prefers-color-scheme: dark)'

// The choice after a click on the switch: it always shows the other theme.
export function nextChoice(system: EditorTheme, choice: ThemeChoice): ThemeChoice {
  const next: EditorTheme = (choice ?? system) === 'dark' ? 'light' : 'dark'
  return next === system ? null : next
}

export function parseChoice(value: string | null): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : null
}

// `localStorage` can be missing (Node in the tests) or blocked by the browser:
// then there is no choice, and a choice is kept for this session only.
export function readChoice(): ThemeChoice {
  try {
    return parseChoice(window.localStorage.getItem(storageKey))
  } catch {
    return null
  }
}

export function writeChoice(choice: ThemeChoice) {
  try {
    if (choice === null) window.localStorage.removeItem(storageKey)
    else window.localStorage.setItem(storageKey, choice)
  } catch {
    // The choice is kept for this session only.
  }
}

// The theme scope is the root element, thus popups in a portal get it too.
// The copied components also use the `dark:` variant, which needs the class.
export function applyTheme(root: HTMLElement, theme: EditorTheme) {
  root.dataset.editorTheme = theme
  root.classList.toggle('dark', theme === 'dark')
}

export function useEditorTheme() {
  const system: EditorTheme = useMediaQuery(darkQuery) ? 'dark' : 'light'
  const [choice, setChoice] = useState<ThemeChoice>(() => readChoice())
  const theme = choice ?? system

  useLayoutEffect(() => {
    applyTheme(document.documentElement, theme)
  }, [theme])

  const toggle = useCallback(() => {
    const next = nextChoice(system, choice)
    setChoice(next)
    writeChoice(next)
  }, [system, choice])

  return { theme, toggle }
}
