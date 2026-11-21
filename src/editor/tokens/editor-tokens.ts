import { readTokenFile } from './token-file.ts'
import { tokenStore } from './token-store.ts'

export { useTokenFile } from './token-store.ts'

// `tokens.json` at the project root (`tokens` in `canvas.config.ts`; a test
// checks the name). A glob, not an import: the file is not in the repository,
// and a glob with no match gives no module, thus the editor builds and runs
// without the file.
const tokenFiles = import.meta.glob<string>('/tokens.json', { eager: true, query: '?raw', import: 'default' })

// The tokens of the editor, for the inspector, the preview and the Issues
// list. Read them from the store, not once at the start of a module.
tokenStore.set(readTokenFile(tokenFiles['/tokens.json']))

// The dev server writes the file again after a change in the library folder
// (`tools/tokens-plugin.ts`). This module then loads again and puts the new
// file into the store; the modules that read the store do not load again.
if (import.meta.hot) import.meta.hot.accept()
