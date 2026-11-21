import { tokensAt, type Token } from '../../tokens/format.ts'
import { frameWindowOf } from '../frame-window.ts'

// The tokens with the values that hold in the frame of a document: a token
// with media values (see `Token.media`) takes the value of the width of the
// frame. With no window, the tokens as they are.
export function frameTokens(
  tokens: readonly Token[],
  document: Pick<Document, 'defaultView'> | null,
): readonly Token[] {
  const window = frameWindowOf(document)
  if (!window) return tokens
  return tokensAt(tokens, (query) => window.matchMedia(query).matches)
}
