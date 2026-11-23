// The token entry of a pack imports the types of a token and the helpers that
// make the tokens (`tokensFromCss`, `tokensFromObject`) from here, by the
// name `canvas-editor/tokens`: one alias to this file in the Vite config of
// the tool (`tools/react-resolve.ts`, `toolAliases`; also for the token
// script), in `vitest.config.ts`, and in `paths` of `tsconfig.app.json`. A
// relative path into the tool would not hold for a project in a different
// folder.

export {
  tokenGroups,
  textStyleParts,
  parseTokens,
  formatTokens,
  type TextStyle,
  type Token,
  type TokenGroup,
  type TokenMediaValue,
} from './format.ts'
export { tokensFromCss, isColorText, type CssTokenOptions, type CssTokenRule } from './from-css.ts'
export { tokensFromObject, valueAt, cssPartsOf, type ObjectGroup, type ObjectMap } from './from-object.ts'
