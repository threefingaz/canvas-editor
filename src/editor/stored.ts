// A choice of the user that the editor keeps in the browser (the theme, the
// markers, the arrows of the links). `localStorage` can be missing (Node in
// the tests) or blocked by the browser: then a read gives null, and a choice
// is kept for this session only.

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

// Writes the value, or removes it for null.
export function writeStored(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // The choice is kept for this session only.
  }
}
