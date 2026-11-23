// The pure rule of the token plugin (`tokens-plugin.ts`): which changes of
// the watched folders write the token file again.

import { inFolder } from './screens.ts'

// True when a change of `path` can change the tokens: a code file or a
// stylesheet in one of the watched folders (the library folder of the pack,
// and its folder sources: `watchedFolders`), not a test file. The dev server
// then writes the token file again.
export function writesTokens(path: string, folders: readonly string[]): boolean {
  return folders.some((folder) => inFolder(path, folder)) && /\.(tsx?|css)$/.test(path) && !/\.test\.tsx?$/.test(path)
}
