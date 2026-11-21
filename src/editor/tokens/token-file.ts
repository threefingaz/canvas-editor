import { messageOf, parseTokens, type Token } from '../../tokens/format.ts'

// The tokens of the editor from the text of `tokens.json`. The file is not in
// the repository (`npm run tokens` writes it), thus a new clone has none. A
// file that is absent or not correct gives a message for the inspector, not
// an error of the editor. The inspector shows the message only when a
// library is connected: with none, the canvas says so, and there is no token
// to write.

export type TokenFile = { tokens: Token[]; error: null } | { tokens: null; error: string }

const writeAgain = 'Run `npm run tokens` to write it from the library pack.'

export function readTokenFile(text: string | undefined): TokenFile {
  if (text === undefined) return { tokens: null, error: `There is no tokens.json. ${writeAgain}` }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    return { tokens: null, error: `tokens.json is not correct JSON (${messageOf(error)}). ${writeAgain}` }
  }
  try {
    return { tokens: parseTokens(json), error: null }
  } catch (error) {
    return { tokens: null, error: `${messageOf(error)}. ${writeAgain}` }
  }
}
