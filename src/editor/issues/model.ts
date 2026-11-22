import { isDeviation, tokenRef, type Issue, type Target } from '../../requests/format.ts'
import { locOf } from '../edits/model.ts'
import type { InspectorRow } from '../inspector/model.ts'

// The Issues list of a screen: a pure function of its screen elements, each
// with its target and the rows of the inspector, read with the open previews
// applied. A value that a preview links is thus not an issue.
//
// - `no-token`: a row with no token link (`equal` or `none`) in a group that
//   has tokens, the same rule as the count in the inspector (`missing`). It
//   includes fixed values that a library component sets itself. `set` tells
//   them apart by the element: `screen` when the element sets a value in the
//   screen file (the mark of its location), the value is in its inline
//   style, or the element is not from the library; else `library`. The rule
//   is by element, because the file does not say each value (a keyword, a
//   name, a value that the code computes): a narrower rule would hide a
//   deviation. `written` is true for a value that the mark names: the file
//   writes it as it is, thus it is a deviation for certain. The marker of
//   the canvas and the Issues list name these values first. Only the first is a deviation (`isDeviation`).
// - `override`: a row whose winning declaration is in the inline style of the
//   element (the `style` prop), when the row gives no `no-token` issue: one
//   value is one issue. A value from `sx` cannot be told apart from
//   the rules of the component.
// - `not-library`: an element with the origin `host` or `local`.
// - `broken-link`: a link to a screen address whose id no screen has, on the
//   screen element that the link belongs to (`brokenLinks` in `collect.ts`).
// - `layout`: the content is wider than the screen (`overflowText`): a
//   person must scroll to the side. Only the page shows it; an agent cannot
//   see its screen, and reads it here.
// - `render-error`: the screen cannot be rendered or read.
// - `relation`: the relation of the screen in its `meta` (`stateOf`,
//   `optionOf`) breaks a rule of the list, with the cause (`relationError` of
//   its entry). The screen then shows as a base screen.

// A screen element: the target of its place in the code, the rows that the
// inspector shows for its first copy, and the addresses of the broken links
// that belong to it, in each of its copies.
// `set` is true when the element sets a value in the screen file (the mark of
// its location, `Site.set`).
// `values` are the values that the element sets, as the page shows them; with
// none, each value of a marked element counts.
export type IssueElement = {
  target: Target
  rows: readonly InspectorRow[]
  links: readonly string[]
  set?: boolean
  values?: readonly string[]
}

// True when a value of a row (`16px`, `#1F4FD8 70%`, `14px / 21px · 400`) has
// one of the values that the element sets in the screen file: a count of
// pixels with no unit, or a color as `#RRGGBB`.
export function rowIsSet(value: string, values: readonly string[]): boolean {
  for (const part of value.split(/[\s/·,]+/)) {
    const size = /^(-?\d*\.?\d+)px$/.exec(part)
    if (size ? values.includes(String(Math.abs(Number(size[1])))) : part.startsWith('#') && values.includes(part.toUpperCase())) return true
  }
  return false
}

// The shorthand of a list of longhands, for the property of an issue.
const shorthands: Record<string, readonly string[]> = {
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  gap: ['row-gap', 'column-gap'],
  'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
  'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'border-radius': [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
  ],
  font: ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'],
}

// The CSS property of a row: the one property, the shorthand of all its
// properties (a row of four equal sides gives `padding`), or else the
// properties with commas.
export function rowProperty(properties: readonly string[]): string {
  if (properties.length === 1) return properties[0]
  const set = new Set(properties)
  for (const [shorthand, longhands] of Object.entries(shorthands)) {
    if (longhands.length === set.size && longhands.every((property) => set.has(property))) return shorthand
  }
  return properties.join(', ')
}

function rowIssues(target: Target, row: InspectorRow, set: boolean, written: boolean): Issue[] {
  const issues: Issue[] = []
  const property = rowProperty(row.properties)
  const state = row.state
  if (row.missing && state && state.state !== 'linked') {
    const token = state.state === 'equal' ? state.token : state.nearest
    issues.push({
      kind: 'no-token',
      target,
      property,
      value: row.value,
      state: state.state,
      ...(token ? { token: tokenRef(token) } : {}),
      // An inline style is in the screen file, also with no mark, and an
      // element that is not from the library has no default of the library.
      set: set || row.inline || target.origin !== 'library' ? 'screen' : 'library',
      ...(written ? { written: true as const } : {}),
    })
  }
  // One value is one issue: a value of the inline style with no token is the
  // `no-token` issue above, which names its token; `override` is for an inline
  // value that has no such issue (a linked value, a property with no tokens).
  if (row.inline && issues.length === 0) issues.push({ kind: 'override', target, property, value: row.value })
  return issues
}

function compareTargets(a: Target, b: Target): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1
  return a.line - b.line || a.column - b.column
}

// An element that goes over the right edge of the screen: its tag, its line
// in the screen file and its width on the page.
export type Crossing = { tag: string; line: number; width: number }

// The text of the `layout` issue of a screen whose content is wider than the
// screen, or null. `width` is the width of the screen and `content` the width
// of its content, in px; a difference of a part of a pixel does not count.
// `crossing` are the screen elements that go over the right edge: the text
// names the narrowest one, which is nearest to the cause.
export function overflowText(width: number, content: number, crossing: readonly Crossing[]): string | null {
  const over = Math.round(content - width)
  if (over < 1) return null
  const cause = [...crossing].sort((a, b) => a.width - b.width || b.line - a.line)[0]
  const where = cause ? ` It goes over the edge at ${cause.tag}, line ${cause.line}.` : ''
  return `The content is ${over} px wider than the screen (${Math.round(width)} px): a person must scroll to the side.${where}`
}

// The text of a render error that has no text.
const noErrorText = 'The screen failed to render.'

// The issues of a screen: a render error first, then the issues of each place
// in the code in the sequence of the code (file, line, column), thus a new
// sequence of the nodes does not change the list. A place with more than one
// copy gives the issues of its first element. In a place: `not-library`,
// then the broken links, then the values. `error` is the text of a render
// error, or null; `relation` is the cause of a broken relation, or null. The
// relation issue comes after a render error and before the places.
export function screenIssues(
  elements: readonly IssueElement[],
  error: string | null,
  relation: string | null,
  // The text of a `layout` issue, or null (`overflowText`).
  layout: string | null = null,
): Issue[] {
  const issues: Issue[] = []
  if (error !== null) issues.push({ kind: 'render-error', text: error.trim() || noErrorText })
  if (relation !== null) issues.push({ kind: 'relation', text: relation })
  if (layout !== null) issues.push({ kind: 'layout', text: layout })

  const places = new Map<string, IssueElement>()
  for (const element of elements) {
    const loc = locOf(element.target)
    if (!places.has(loc)) places.set(loc, element)
  }
  const sorted = [...places.values()].sort((a, b) => compareTargets(a.target, b.target))
  for (const { target, rows, links, set, values } of sorted) {
    if (target.origin !== 'library') issues.push({ kind: 'not-library', target })
    for (const href of links) issues.push({ kind: 'broken-link', target, href })
    for (const row of rows) issues.push(...rowIssues(target, row, set === true, set === true && values !== undefined && rowIsSet(row.value, values)))
  }
  return issues
}

// The sequence of the groups of the Issues list: an error first, then a broken
// relation, then the broken links, then the elements, then the values.
const groupOrder: readonly Issue['kind'][] = ['render-error', 'relation', 'layout', 'broken-link', 'not-library', 'no-token', 'override']

// `library` is the group of the values that a component of the library sets
// by itself: they are not deviations.
export type IssueGroup = { kind: Issue['kind'] | 'library'; issues: Issue[] }

// The issues of a screen in groups by kind, for the Issues list: the
// deviations first, then the defaults of the library as a last group. A kind
// with no issues has no group; in a group the issues keep their sequence.
export function issueGroups(issues: readonly Issue[]): IssueGroup[] {
  const groups: IssueGroup[] = groupOrder
    .map((kind) => ({ kind, issues: issues.filter((issue) => issue.kind === kind && isDeviation(issue)) }))
    .filter((group) => group.issues.length > 0)
  const library = issues.filter((issue) => !isDeviation(issue))
  if (library.length > 0) groups.push({ kind: 'library', issues: library })
  return groups
}

// The text of an issue in the Issues list, after the tag name of its element.
export function issueSummary(issue: Issue): string {
  switch (issue.kind) {
    case 'render-error':
    case 'relation':
    case 'layout':
      return issue.text
    case 'not-library':
      return issue.target.origin === 'host' ? 'HTML element, not from the library' : 'local component, not from the library'
    case 'broken-link':
      return `link to ${issue.href}, no screen with this id`
    case 'override':
      return `${issue.property}: ${issue.value} in the inline style`
    case 'no-token': {
      const value = `${issue.property}: ${issue.value}`
      const where = issue.written ? ', written in the file' : ''
      if (issue.state === 'equal' && issue.token) return `${value}, equal to ${issue.token.name}${where}`
      return issue.token ? `${value}, nearest ${issue.token.name}${where}` : `${value}, no token${where}`
    }
  }
}
