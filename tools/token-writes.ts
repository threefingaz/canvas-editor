// The pure rule of the token plugin (`tokens-plugin.ts`): which changes of
// the library folder write the token file again.

import { inFolder } from './screens.ts'

// True when a change of `path` can change the tokens: a code file in the
// library folder (`folder`), not a test file. The dev server then writes the
// token file again.
export function writesTokens(path: string, folder: string): boolean {
  return inFolder(path, folder) && /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)
}
