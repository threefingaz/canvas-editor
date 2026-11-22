// The static facts of a screen file: what the code itself says, read with the
// parser and with no browser. The check of the screens (`check.ts`) and the
// list of screens (`screens.ts`) use them.
//
// - each JSX element with its place, its tag and its origin (the same rule as
//   the element-to-code step);
// - each element with a `style` attribute;
// - each raw value: a text literal in an attribute of an opening tag that is a
//   CSS value with a length in `px`, `rem` or `em`, or with a color (hex, or a
//   color function). A number literal is not a raw value: the scales of a
//   library are numbers (`spacing={2}`), and the file cannot tell a step of a
//   scale from a count of pixels;
// - each element that sets a value in the file (`sets`): it has a raw value,
//   a `style` attribute, or in an object of an attribute a number under a key
//   of the font (`fontSize: 14`) or a text that the code computes (a template
//   literal with an expression).
//   The element-to-code step marks such an element, and the Issues list tells
//   its values from the defaults of the library. The rule is wide on purpose:
//   a wrong mark shows a default of the library as a value of the screen, and
//   a missing mark would hide a deviation;
// - each literal link to a screen (`href="#/<id>"`).
//
// The place of a fact is the place of its element: the `<` of the opening
// tag, 1-based, as the location attribute and a target of a request have it.

import { parseSync, Visitor } from 'vite'
import { screenIdFromHash } from '../src/frame/screen-link.ts'
import type { Origin } from '../src/requests/format.ts'
import { fragmentNames, importSources, isFragment, originOf, position } from './jsx.ts'

export type Place = { line: number; column: number }

export type ElementFact = Place & { tag: string; origin: Origin }

// `attribute` is the name of the attribute that has the literal `text`.
export type RawFact = Place & { tag: string; attribute: string; text: string }

// `id` is the screen id of the address `href`.
export type LinkFact = Place & { tag: string; href: string; id: string }

export type ScreenFacts = {
  elements: ElementFact[]
  // The elements with a `style` attribute.
  styles: (Place & { tag: string })[]
  raw: RawFact[]
  links: LinkFact[]
  // The places of the elements that set a value in the file.
  sets: Place[]
}

const length = /^-?(\d+\.?\d*|\.\d+)(px|rem|em)$/
const hexColor = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const colorFunction = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i
// A part of a CSS value that is not raw: a keyword, a number, a percentage, a
// sign of `calc`, a length of the viewport or of a grid.
const plain = /^([a-z-]*|-?(\d+\.?\d*|\.\d+)(%|vh|vw|dvh|svh|lvh|fr|ch|deg|s|ms)?|[-+*/])$/

// The parts of a CSS value: the words between spaces, commas, brackets and
// the signs `/`, `*` and `!` (`14px/20px`, `2*8px`, `16px !important`). The
// address of `url(#fade)` is not a part: it reads as a hex color.
function partsOf(value: string): string[] {
  return value
    .replace(/url\([^)]*\)/gi, ' ')
    .split(/[\s,()/*!]+/)
    .filter((part) => part !== '')
}

// True for a text that is a CSS value with a raw length or a raw color:
// `'16px'`, `'24px 64px'`, `'#667085'`, `'1px solid #ccc'`,
// `'calc(100% - 16px)'`, `'rgba(0, 0, 0, 0.2)'`. `'100vh'`, `'100%'` and
// `'1fr'` are layout, not raw values.
//
// A text directly in an attribute can be a text for a person, thus each of
// its parts must be a part of a CSS value: "Up to 20px" is not one. A text in
// an object of an attribute (`wide`) is a value of a style object: one raw
// part is enough (`'1px solid currentColor'`, `'translateY(-2px)'`).
export function isRawValue(text: string, wide = false): boolean {
  const value = text.trim()
  if (value === '') return false
  if (colorFunction.test(value)) return true
  let raw = false
  for (const part of partsOf(value)) {
    if (length.test(part) || hexColor.test(part)) raw = true
    else if (!wide && !plain.test(part)) return false
  }
  return raw
}

// The attributes that have an address, a name or a text for a person, not a
// value of a style: a fragment address such as `#fade` and a label such as
// `#1234` read as a hex color.
const noValue: ReadonlySet<string> = new Set([
  'href', 'to', 'id', 'htmlFor', 'key', 'name', 'src', 'label', 'title', 'alt', 'placeholder', 'helperText',
  'aria-label', 'aria-description', 'value', 'defaultValue', 'primary', 'secondary', 'subheader', 'children',
  'text', 'content', 'description', 'message', 'caption', 'name',
])

type Node = { type: string; start: number; end: number; [key: string]: unknown }

// A text literal of an attribute value; `nested` when it is in an object.
type Literal = { text: string; nested: boolean }

// The text literals of an attribute value, at each depth of an object, an
// array, a condition and the arguments of a call. A nested JSX element is not
// read here: its own opening tag has its own facts. A function is not read.
function literalTexts(node: Node | null | undefined, into: Literal[], nested = false): void {
  if (!node) return
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') into.push({ text: node.value, nested })
      return
    case 'TemplateLiteral': {
      const quasis = node.quasis as { value: { cooked: string | null } }[]
      if ((node.expressions as Node[]).length === 0 && quasis[0]?.value.cooked) into.push({ text: quasis[0].value.cooked, nested })
      return
    }
    case 'JSXExpressionContainer':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      literalTexts(node.expression as Node, into, nested)
      return
    case 'ObjectExpression':
      for (const property of node.properties as Node[]) {
        if (property.type === 'Property') literalTexts(property.value as Node, into, true)
      }
      return
    case 'ArrayExpression':
      for (const element of node.elements as (Node | null)[]) literalTexts(element, into, nested)
      return
    case 'ConditionalExpression':
      literalTexts(node.consequent as Node, into, nested)
      literalTexts(node.alternate as Node, into, nested)
      return
    case 'LogicalExpression':
      literalTexts(node.left as Node, into, nested)
      literalTexts(node.right as Node, into, nested)
      return
    case 'CallExpression':
      for (const argument of node.arguments as Node[]) literalTexts(argument, into, nested)
      return
  }
}

// The keys of a style object whose number is a size of the font, not a step
// of a scale.
const fontKey = /^(fontSize|lineHeight|letterSpacing|font-size|line-height|letter-spacing)$/

// True when an attribute value has a number under a key of the font, or a
// text that the code computes, at each depth of an object.
function computes(node: Node | null | undefined, key: string | null = null): boolean {
  if (!node) return false
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'number' && key !== null && fontKey.test(key)
    case 'TemplateLiteral':
      // Only as a value of an object: a computed text of an attribute itself
      // is a label for a person (`aria-label`).
      return key !== null && (node.expressions as Node[]).length > 0
    case 'JSXExpressionContainer':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return computes(node.expression as Node, key)
    case 'ObjectExpression':
      return (node.properties as Node[]).some((property) => {
        if (property.type !== 'Property') return false
        const name = property.key as Node
        const text = name.type === 'Identifier' ? (name.name as string) : typeof name.value === 'string' ? name.value : null
        // A key of the font stays for the values below it: the keys of a
        // responsive object (`fontSize: { xs: 12, md: 14 }`).
        return computes(property.value as Node, key !== null && fontKey.test(key) ? key : (text ?? key))
      })
    case 'ArrayExpression':
      return (node.elements as (Node | null)[]).some((element) => computes(element, key))
    case 'ConditionalExpression':
      return computes(node.consequent as Node, key) || computes(node.alternate as Node, key)
    case 'LogicalExpression':
      return computes(node.left as Node, key) || computes(node.right as Node, key)
    case 'CallExpression':
      return (node.arguments as Node[]).some((argument) => computes(argument, key))
    default:
      return false
  }
}

// What the attributes of one opening tag say: `node` is a `JSXOpeningElement`
// of the parser.
export type TagValues = {
  style: boolean
  raw: { attribute: string; text: string }[]
  hrefs: string[]
  // The element sets a value in the file (see the head of this module).
  sets: boolean
}

export function tagValues(node: { attributes: readonly unknown[] }, code: string): TagValues {
  const values: TagValues = { style: false, raw: [], hrefs: [], sets: false }
  for (const attribute of node.attributes as Node[]) {
    if (attribute.type !== 'JSXAttribute') continue
    const name = code.slice((attribute.name as Node).start, (attribute.name as Node).end)
    const texts: Literal[] = []
    literalTexts(attribute.value as Node | null, texts)
    if (name === 'style') values.style = true
    if (name === 'href') values.hrefs.push(...texts.map((literal) => literal.text))
    if (noValue.has(name)) continue
    for (const { text, nested } of texts) {
      if (isRawValue(text, nested)) values.raw.push({ attribute: name, text })
    }
    // Each attribute with an object can be the style object of a library:
    // the name of the override is different in each library.
    if (computes(attribute.value as Node | null)) values.sets = true
  }
  if (values.style || values.raw.length > 0) values.sets = true
  return values
}

// Throws with the message of the parser when the code has a syntax error.
// `libraryPackage` is the npm package of the library, or null when no library
// is connected: then no element has the origin `library`.
export function screenFacts(code: string, file: string, libraryPackage: string | null): ScreenFacts {
  const { program, errors } = parseSync(file, code)
  if (errors.length > 0) throw new Error(`${file}: ${errors[0].message}`)

  const fragments = fragmentNames(program)
  const imports = importSources(program)
  const facts: ScreenFacts = { elements: [], styles: [], raw: [], links: [], sets: [] }

  new Visitor({
    JSXOpeningElement(node) {
      const name = code.slice(node.name.start, node.name.end)
      if (isFragment(name, fragments)) return
      const tag = name.replaceAll(/\s+/g, '')
      const place = position(code, node.start)
      facts.elements.push({ ...place, tag, origin: originOf(tag, imports, libraryPackage) })

      const values = tagValues(node, code)
      if (values.style) facts.styles.push({ ...place, tag })
      if (values.sets) facts.sets.push(place)
      for (const raw of values.raw) facts.raw.push({ ...place, tag, ...raw })
      for (const href of values.hrefs) {
        const id = screenIdFromHash(href)
        if (id !== null) facts.links.push({ ...place, tag, href, id })
      }
    },
  }).visit(program)

  return facts
}

// The ids of the screens that the file links to, in the order of the code,
// each one time.
export function linkIds(facts: ScreenFacts): string[] {
  return [...new Set(facts.links.map((link) => link.id))]
}
