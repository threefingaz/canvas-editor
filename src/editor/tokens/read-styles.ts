import { textStyleParts, type TextStyle } from '../../tokens/format.ts'
import { frameWindowOf, type FrameWindow } from '../frame-window.ts'
import {
  declaredValue,
  matchingSelector,
  ruleKind,
  walkRules,
  type DeclarationsLike,
  type DeclaredValue,
  type RuleLike,
  type StyleSource,
  type ValueSource,
} from './declarations.ts'
import type { TextDeclared, ValueGroup } from './match.ts'

// Reads the style values of an element of a frame document: for each property
// that the inspector shows, the computed value and the declaration that wins.
//
// The element is in a different document than the editor, thus this module
// gets `getComputedStyle` and `matchMedia` from the window of that document,
// and uses no `instanceof` with the classes of the editor window.

// The properties that the inspector shows, with the token group of each.
// Null: the property has no tokens (layout).
export const styleProperties = [
  { property: 'background-color', group: 'color' },
  { property: 'color', group: 'color' },
  { property: 'border-top-width', group: 'stroke' },
  { property: 'border-right-width', group: 'stroke' },
  { property: 'border-bottom-width', group: 'stroke' },
  { property: 'border-left-width', group: 'stroke' },
  { property: 'border-top-color', group: 'color' },
  { property: 'border-right-color', group: 'color' },
  { property: 'border-bottom-color', group: 'color' },
  { property: 'border-left-color', group: 'color' },
  { property: 'box-shadow', group: 'shadow' },
  { property: 'padding-top', group: 'spacing' },
  { property: 'padding-right', group: 'spacing' },
  { property: 'padding-bottom', group: 'spacing' },
  { property: 'padding-left', group: 'spacing' },
  { property: 'margin-top', group: 'spacing' },
  { property: 'margin-right', group: 'spacing' },
  { property: 'margin-bottom', group: 'spacing' },
  { property: 'margin-left', group: 'spacing' },
  { property: 'row-gap', group: 'spacing' },
  { property: 'column-gap', group: 'spacing' },
  { property: 'border-top-left-radius', group: 'radius' },
  { property: 'border-top-right-radius', group: 'radius' },
  { property: 'border-bottom-right-radius', group: 'radius' },
  { property: 'border-bottom-left-radius', group: 'radius' },
  { property: 'display', group: null },
  { property: 'flex-direction', group: null },
  { property: 'flex-wrap', group: null },
  { property: 'align-items', group: null },
  { property: 'justify-content', group: null },
] as const satisfies readonly { property: string; group: ValueGroup | null }[]

export type StyleProperty = (typeof styleProperties)[number]['property']

export type StyleValue = {
  group: ValueGroup | null
  computed: string
  // The text of the declaration that wins, then the texts of the variables
  // that it follows; see `declaredValue`. Empty when nothing declares the
  // property.
  declared: string[]
  // Where the winning declaration is. Null when nothing declares the
  // property.
  source: ValueSource | null
  // True when the winning declaration is on a parent node: an inherited
  // property that the element does not declare.
  inherited?: true
}

export type ElementStyles = {
  values: Record<StyleProperty, StyleValue>
  // `inline`: a part of the text style has its winning declaration in the
  // inline style of the element itself.
  textStyle: TextDeclared & { computed: TextStyle; inline?: boolean }
  // True when the element has a text node of its own (not only in an inner
  // element).
  ownText: boolean
}

// The properties that an element inherits from its parent. When no source of
// the element declares one, its declared value is that of the nearest parent
// that declares it, because that declaration gives the value.
const inheritedProperties = new Set(['color', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'])

// Declared texts that take the value of the parent (`currentcolor` in `color`
// is the color of the parent). A winning declaration with such a text gives
// no value of its own, thus the reading goes on to the parent. Many library
// components declare `color: inherit` or `font: inherit`.
const parentKeywords = new Set(['inherit', 'unset', 'currentcolor'])

function ownValue(value: DeclaredValue | null): value is DeclaredValue {
  return value !== null && !parentKeywords.has(value.texts[0].toLowerCase())
}

// The CSS property of a part of a text style: 'fontSize' gives 'font-size'.
function cssProperty(part: keyof TextStyle): string {
  return part.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function mediaApplies(window: FrameWindow, mediaText: string | undefined) {
  return !mediaText || window.matchMedia(mediaText).matches
}

// True when a group rule or an import rule applies in the frame. A container
// query, a scope and a layer count as applying: this reading does not
// evaluate them.
function ruleApplies(window: FrameWindow, rule: RuleLike): boolean {
  const kind = ruleKind(rule)
  if (kind === 'media' || kind === 'import') return mediaApplies(window, rule.media?.mediaText)
  // `CSS.supports` gives false for a condition that it cannot read.
  if (kind === 'supports' && rule.conditionText) return window.CSS.supports(rule.conditionText)
  return true
}

function matchesSelector(node: Element, selector: string) {
  try {
    return node.matches(selector)
  } catch {
    return false
  }
}

// The sources of the node: each CSS rule of the frame document that matches
// it, in the sequence of the document, then the inline style. Of a selector
// list, only the parts that match the node count. A stylesheet that cannot be
// read (from a different origin) is skipped.
function sourcesOf(node: Element, window: FrameWindow): StyleSource[] {
  const sources: StyleSource[] = []
  for (const sheet of Array.from(node.ownerDocument.styleSheets)) {
    if (sheet.disabled || !mediaApplies(window, sheet.media?.mediaText)) continue
    let rules: ArrayLike<RuleLike>
    try {
      rules = sheet.cssRules as unknown as ArrayLike<RuleLike>
    } catch {
      continue
    }
    for (const { rule, media } of walkRules(rules, (group) => ruleApplies(window, group))) {
      const strength = matchingSelector(rule.selectorText, (part) => matchesSelector(node, part))
      if (!strength) continue
      const source: StyleSource = { style: rule.style, kind: 'rule', specificity: strength, position: sources.length }
      if (media) source.media = media
      sources.push(source)
    }
  }
  const inline = (node as Element & { style?: DeclarationsLike }).style
  if (inline && typeof inline.getPropertyValue === 'function') {
    sources.push({ style: inline, kind: 'inline', specificity: [0, 0, 0], position: sources.length })
  }
  return sources
}

function parentOf(node: Element): Element | null {
  return (node as { parentElement?: Element | null }).parentElement ?? null
}

// `Node.TEXT_NODE`. The global `Node` is missing in the tests, which run in Node.
const textNode = 3

// A text node with more than white space.
function hasOwnText(node: Element): boolean {
  const children = (node as { childNodes?: ArrayLike<Node> }).childNodes
  if (!children) return false
  return Array.from(children).some((child) => child.nodeType === textNode && (child.textContent ?? '').trim() !== '')
}

// The style values of an element of a frame document.
export function readStyles(node: Element): ElementStyles {
  const window = frameWindowOf(node.ownerDocument)
  if (!window) throw new Error('readStyles: the element is not in a document with a window')
  const computed = window.getComputedStyle(node)

  const sourcesByNode = new Map<Element, StyleSource[]>()
  const sourcesFor = (element: Element) => {
    let sources = sourcesByNode.get(element)
    if (!sources) {
      sources = sourcesOf(element, window)
      sourcesByNode.set(element, sources)
    }
    return sources
  }
  // The sources of the root element, read only when a variable needs them.
  const root = (node.ownerDocument as { documentElement?: Element | null }).documentElement ?? null
  const rootSources = () => (root ? sourcesFor(root) : [])
  // The winning declaration, and true when it is on a parent node.
  const declaredFor = (property: string): { declared: DeclaredValue; inherited: boolean } | null => {
    if (!inheritedProperties.has(property)) {
      const declared = declaredValue(property, sourcesFor(node), rootSources)
      return declared && { declared, inherited: false }
    }
    for (let element: Element | null = node; element; element = parentOf(element)) {
      const declared = declaredValue(property, sourcesFor(element), rootSources)
      if (ownValue(declared)) return { declared, inherited: element !== node }
    }
    return null
  }

  const values = {} as Record<StyleProperty, StyleValue>
  for (const { property, group } of styleProperties) {
    const found = declaredFor(property)
    values[property] = {
      group,
      computed: computed.getPropertyValue(property),
      declared: found?.declared.texts ?? [],
      source: found?.declared.source ?? null,
    }
    if (found?.inherited) values[property].inherited = true
  }

  const textComputed = {} as TextStyle
  const texts = new Set<string>()
  let textInline = false
  for (const part of textStyleParts) {
    const property = cssProperty(part)
    textComputed[part] = computed.getPropertyValue(property)
    const found = declaredFor(property)
    for (const text of found?.declared.texts ?? []) texts.add(text)
    if (found && !found.inherited && found.declared.source.inline) textInline = true
  }

  return {
    values,
    textStyle: {
      computed: textComputed,
      texts: [...texts],
      inline: textInline,
      // The element or a parent: a text style is inherited too.
      matches: (selector) => {
        for (let element: Element | null = node; element; element = parentOf(element)) {
          if (matchesSelector(element, selector)) return true
        }
        return false
      },
    },
    ownText: hasOwnText(node),
  }
}
