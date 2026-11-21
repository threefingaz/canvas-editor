import { useSyncExternalStore } from 'react'
import type { TokenFile } from './token-file.ts'

// The token file of the editor, in a store. The dev server writes the token
// file again after a change in the library folder; `editor-tokens.ts` then
// loads again and puts the new file here. This module does not load again, thus
// each reader keeps the same store and gets the new tokens: the inspector
// renders again, the preview is applied again, and the Issues list is read
// again. A file with the same content changes nothing.

export type TokenStore = {
  get: () => TokenFile
  set: (file: TokenFile) => void
  subscribe: (listener: () => void) => () => void
}

export function createTokenStore(initial: TokenFile): TokenStore {
  let current = initial
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set: (file) => {
      if (file === current || JSON.stringify(file) === JSON.stringify(current)) return
      current = file
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// The tokens of the editor. Empty until `editor-tokens.ts` reads the file.
export const tokenStore = createTokenStore({ tokens: [], error: null })

export function useTokenFile(): TokenFile {
  return useSyncExternalStore(tokenStore.subscribe, tokenStore.get, tokenStore.get)
}
