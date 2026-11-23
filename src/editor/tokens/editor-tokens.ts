import tokenText from 'virtual:canvas-tokens'
import { readTokenFile } from './token-file.ts'
import { tokenStore } from './token-store.ts'

export { useTokenFile } from './token-store.ts'

// `tokens.json` of the project (`tokens` in `canvas.config.ts`), as the text
// of `virtual:canvas-tokens` (`tools/tokens-plugin.ts`); null when the project
// has no file, thus the editor builds and runs without it.

// The tokens of the editor, for the inspector, the preview and the Issues
// list. Read them from the store, not once at the start of a module.
tokenStore.set(readTokenFile(tokenText ?? undefined))

// The dev server writes the file again after a change in the library folder
// (`tools/tokens-plugin.ts`), and updates the virtual module. This module then
// loads again and puts the new file into the store; the modules that read the
// store do not load again.
if (import.meta.hot) import.meta.hot.accept()
