import { tokenRef, type Issue, type Target } from '../../requests/format.ts'
import { locOf } from '../edits/model.ts'
import type { InspectorRow } from '../inspector/model.ts'

// The Issues list of a screen: a pure function of its screen elements, each
// with its target and the rows of the inspector, read with the open previews
// applied. A value that a preview links is thus not an issue.
//
// - `no-token`: a row with no token link (`equal` or `none`) in a group that
//   has tokens, the same rule as the count in the inspector (`missing`). It
//   includes fixed values that a library component sets itself: the editor
//   cannot tell them apart from values of the screen file.
// - `override`: a row whose winning declaration is in the inline style of the
//   element (the `style` prop). A value from `sx` cannot be told apart from
//   the rules of the component.
// - `not-library`: an element with the origin `host` or `local`.
// - `broken-link`: a link to a screen address whose id no screen has, on the
//   screen element that the link belongs to (`brokenLinks` in `collect.ts`).
// - `render-error`: the screen cannot be rendered or read.

// A screen element: the target of its place in the code, the rows that the
// inspector shows for its first copy, and the addresses of the broken links
// that belong to it, in each of its copies.
export type IssueElement = { target: Target; rows: readonly InspectorRow[]; links?: readonly string[] }

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

function rowIssues(target: Target, row: InspectorRow): Issue[] {
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
    })
  }
  if (row.inline) issues.push({ kind: 'override', target, property, value: row.value })
  return issues
}

function compareTargets(a: Target, b: Target): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1
  return a.line - b.line || a.column - b.column
}

// The text of a render error that has no text.
const noErrorText = 'The screen failed to render.'

// The issues of a screen: a render error first, then the issues of each place
// in the code in the sequence of the code (file, line, column), thus a new
// sequence of the nodes does not change the list. A place with more than one
// copy gives the issues of its first element. In a place: `not-library`,
// then the broken links, then the values. `error` is the text of a render
// error, or null.
export function screenIssues(elements: readonly IssueElement[], error: string | null): Issue[] {
  const issues: Issue[] = []
  if (error !== null) issues.push({ kind: 'render-error', text: error.trim() || noErrorText })

  const places = new Map<string, IssueElement>()
  for (const element of elements) {
    const loc = locOf(element.target)
    if (!places.has(loc)) places.set(loc, element)
  }
  const sorted = [...places.values()].sort((a, b) => compareTargets(a.target, b.target))
  for (const { target, rows, links = [] } of sorted) {
    if (target.origin !== 'library') issues.push({ kind: 'not-library', target })
    for (const href of links) issues.push({ kind: 'broken-link', target, href })
    for (const row of rows) issues.push(...rowIssues(target, row))
  }
  return issues
}

// The sequence of the groups of the Issues list: an error first, then the
// broken links, then the elements, then the values.
const groupOrder: readonly Issue['kind'][] = ['render-error', 'broken-link', 'not-library', 'no-token', 'override']

export type IssueGroup = { kind: Issue['kind']; issues: Issue[] }

// The issues of a screen in groups by kind, for the Issues list. A kind with
// no issues has no group; in a group the issues keep their sequence.
export function issueGroups(issues: readonly Issue[]): IssueGroup[] {
  return groupOrder
    .map((kind) => ({ kind, issues: issues.filter((issue) => issue.kind === kind) }))
    .filter((group) => group.issues.length > 0)
}

// The text of an issue in the Issues list, after the tag name of its element.
export function issueSummary(issue: Issue): string {
  switch (issue.kind) {
    case 'render-error':
      return issue.text
    case 'not-library':
      return issue.target.origin === 'host' ? 'HTML element, not from the library' : 'local component, not from the library'
    case 'broken-link':
      return `link to ${issue.href}, no screen with this id`
    case 'override':
      return `${issue.property}: ${issue.value} in the inline style`
    case 'no-token': {
      const value = `${issue.property}: ${issue.value}`
      if (issue.state === 'equal' && issue.token) return `${value}, equal to ${issue.token.name}`
      return issue.token ? `${value}, nearest ${issue.token.name}` : `${value}, no token`
    }
  }
}
