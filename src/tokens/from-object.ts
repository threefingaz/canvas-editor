import type { TextStyle, Token, TokenGroup } from './format.ts'
import { isColorText, isWholeCall, px } from './from-css.ts'

// The tokens of a theme object: a map names, for each group, the paths in the
// object whose values are tokens. A token entry of a pack calls it with the
// theme of the library:
//
//   tokensFromObject(theme, {
//     color: {
//       paths: ['palette.primary', 'palette.text', 'palette.divider'],
//       code: (path) => path.slice(1).join('.'),
//       css: (path) => valueAt(theme.vars, path),
//     },
//   })
//
// A path is a text with dots (`palette.primary.main`) or a list of keys (for a
// key with a dot, `['spacing', '0.5']`). `*` stands for each key of one
// level. At the end of a path, `value` gives the value of the token; when it
// gives none and the node is an object, each child is tried in the same way,
// thus `palette.primary` gives `main`, `light`, `dark` and `contrastText`. The
// tokens of one path keep the sequence of the keys in the object, and the
// paths keep the sequence of the map.

type Path = string[]

export type ObjectGroup = {
  paths: readonly (string | readonly string[])[]
  // The value of the token at a node, or null for a node that is no token.
  // Default: for `color`, a color text; for `spacing`, `radius` and `stroke`,
  // a number (as px) or a px length; for `shadow`, a text that is not `none`.
  // A `textStyle` group must give it.
  value?: (value: unknown, path: Path) => string | TextStyle | null | undefined
  // How the library writes the token in code. Default: the path with dots.
  code?: (path: Path, value: unknown) => string | number
  // The CSS text that the library writes for the token: `var(--x)`, or
  // `calc(2 * var(--x))`. It gives `cssVar` and `factor`. Default: none.
  css?: (path: Path, value: unknown) => unknown
  // The id of the token. Default: the path with dots.
  id?: (path: Path) => string
  // For a text style: the class of the elements that use the style.
  selector?: (path: Path) => string | undefined
}

export type ObjectMap = Partial<Record<TokenGroup, ObjectGroup>>

// The deepest level that a path and its children are followed to.
const depthLimit = 12

function isNode(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// The value at a path of an object, or undefined.
export function valueAt(object: unknown, path: readonly string[]): unknown {
  let node = object
  for (const key of path) {
    if (!isNode(node) || !Object.hasOwn(node, key)) return undefined
    node = node[key]
  }
  return node
}

function lengthValue(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return px(value)
  if (typeof value === 'string' && /^-?\d*\.?\d+px$|^0$/i.test(value.trim())) return value.trim()
  return null
}

function defaultValue(group: TokenGroup): (value: unknown) => string | null {
  if (group === 'color') return (value) => (typeof value === 'string' && isColorText(value.trim()) ? value.trim() : null)
  if (group === 'shadow') {
    return (value) => (typeof value === 'string' && value.trim() !== '' && value.trim().toLowerCase() !== 'none' ? value.trim() : null)
  }
  if (group === 'textStyle') {
    return () => {
      throw new Error('tokensFromObject: the group "textStyle" needs a function "value"')
    }
  }
  return lengthValue
}

// The variable and the factor of a CSS text: `var(--x)`, `var(--x, 8px)`,
// `calc(2 * var(--x))`, `calc(var(--x) * 2)`.
export function cssPartsOf(text: unknown): { cssVar?: string; factor?: number } {
  if (typeof text !== 'string') return {}
  const value = text.trim()
  // One `var()` that is the whole text, not the first of two.
  const single = /^var\(\s*(--[\w-]+)\s*(?:,.*)?\)$/s.exec(value)
  if (single && isWholeCall(value)) return { cssVar: single[1] }
  const before = /^calc\(\s*(-?[\d.]+)\s*\*\s*var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)\s*\)$/.exec(value)
  const after = /^calc\(\s*var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)\s*\*\s*(-?[\d.]+)\s*\)$/.exec(value)
  const cssVar = before?.[2] ?? after?.[1]
  const factor = Number(before?.[1] ?? after?.[2])
  if (!cssVar || !Number.isFinite(factor)) return {}
  return factor === 1 ? { cssVar } : { cssVar, factor }
}

function pathOf(path: string | readonly string[]): Path {
  return typeof path === 'string' ? path.split('.').filter((key) => key !== '') : [...path]
}

// Each node that a path names: `*` gives each key of a level.
function nodesAt(object: unknown, pattern: Path): { path: Path; value: unknown }[] {
  let found: { path: Path; value: unknown }[] = [{ path: [], value: object }]
  for (const key of pattern) {
    const next: typeof found = []
    for (const entry of found) {
      if (!isNode(entry.value)) continue
      const keys = key === '*' ? Object.keys(entry.value) : [key]
      for (const child of keys) {
        if (Object.hasOwn(entry.value, child)) next.push({ path: [...entry.path, child], value: entry.value[child] })
      }
    }
    found = next
  }
  return found
}

// The tokens of the groups of `map` in `theme`, in the sequence of the map. An
// id that two paths give is an error.
export function tokensFromObject(theme: unknown, map: ObjectMap): Token[] {
  const tokens: Token[] = []
  const seen = new Set<string>()

  for (const [group, spec] of Object.entries(map) as [TokenGroup, ObjectGroup | undefined][]) {
    // A group of the map with no spec (`{ color: undefined }`) gives no tokens.
    if (spec === undefined) continue
    const valueOf = spec.value ?? defaultValue(group)

    const take = (path: Path, node: unknown, depth: number, parents: Set<unknown>) => {
      const value = valueOf(node, path)
      if (value === null || value === undefined) {
        if (!isNode(node) || depth >= depthLimit || parents.has(node)) return
        const inside = new Set(parents).add(node)
        for (const key of Object.keys(node)) take([...path, key], node[key], depth + 1, inside)
        return
      }
      const id = spec.id ? spec.id(path) : path.join('.')
      if (seen.has(id)) throw new Error(`tokensFromObject: two paths give the token "${id}"`)
      seen.add(id)
      const code = spec.code ? spec.code(path, node) : path.join('.')
      // The name that the inspector shows: the code when it is a text that is
      // not empty, else the id.
      const name = typeof code === 'string' && code !== '' ? code : id
      const { cssVar, factor } = spec.css ? cssPartsOf(spec.css(path, node)) : {}
      const selector = spec.selector?.(path)
      tokens.push({
        id,
        group,
        name,
        value,
        ...(cssVar ? { cssVar } : {}),
        ...(factor !== undefined ? { factor } : {}),
        code,
        ...(selector ? { selector } : {}),
      })
    }

    for (const pattern of spec.paths) {
      for (const entry of nodesAt(theme, pathOf(pattern))) take(entry.path, entry.value, 0, new Set())
    }
  }
  return tokens
}
