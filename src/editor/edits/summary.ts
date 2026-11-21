import type { Edit, EditValue } from '../../requests/format.ts'
import { corners, sides } from '../tokens/declarations.ts'

// One line of text for an edit, for the Changes list:
// `Padding: 20px → spacing.2`, `Text: "Welcome" → "Hello"`, `Removed`,
// `Moved from 3 to 2 of 4`, `Comment`, `3 options: Fields in two columns`,
// `Keep option: onboarding/welcome-option-2`.

// The name of the inspector row for a set of properties.
const rowNames = new Map<string, string>()

function name(properties: readonly string[], text: string) {
  rowNames.set([...properties].sort().join(' '), text)
}

for (const [prefix, label] of [
  ['padding', 'Padding'],
  ['margin', 'Margin'],
] as const) {
  name(
    sides.map((side) => `${prefix}-${side}`),
    label,
  )
  for (const side of sides) name([`${prefix}-${side}`], `${label} ${side}`)
}
name(
  sides.map((side) => `border-${side}-width`),
  'Stroke width',
)
name(
  sides.map((side) => `border-${side}-color`),
  'Stroke color',
)
for (const side of sides) {
  name([`border-${side}-width`], `Stroke width ${side}`)
  name([`border-${side}-color`], `Stroke color ${side}`)
}
name(
  corners.map((corner) => `border-${corner}-radius`),
  'Radius',
)
for (const corner of corners) name([`border-${corner}-radius`], `Radius ${corner.replace('-', ' ')}`)
name(['row-gap', 'column-gap'], 'Gap')
name(['row-gap'], 'Row gap')
name(['column-gap'], 'Column gap')
name(['background-color'], 'Fill')
name(['color'], 'Text color')
name(['box-shadow'], 'Shadow')
name(['display'], 'Display')
name(['flex-direction'], 'Direction')
name(['flex-wrap'], 'Wrap')
name(['align-items'], 'Align')
name(['justify-content'], 'Justify')

function rowName(properties: readonly string[]): string {
  return rowNames.get([...properties].sort().join(' ')) ?? properties.join(', ')
}

// The token name of a value, or the value.
function valueText(value: EditValue): string {
  return value.token?.name ?? value.value
}

// The most characters of a text in a summary.
export const summaryTextLimit = 24

function cut(text: string): string {
  return text.length > summaryTextLimit ? `${text.slice(0, summaryTextLimit)}…` : text
}

export function summaryOf(edit: Edit): string {
  const change = edit.change
  switch (change.kind) {
    case 'style':
      return `${rowName(change.properties)}: ${valueText(change.before)} → ${valueText(change.after)}`
    case 'textStyle':
      return `Text style: ${valueText(change.before)} → ${valueText(change.after)}`
    case 'text':
      return `Text: "${cut(change.before)}" → "${cut(change.after)}"`
    case 'order':
      return `Moved from ${change.before + 1} to ${change.after + 1} of ${change.of}`
    case 'remove':
      return 'Removed'
    // The kind only: the Changes list shows the whole text of a comment
    // below its summary.
    case 'comment':
      return 'Comment'
    // The count, and the start of the note when it has one.
    case 'options': {
      const note = change.note.replace(/\s+/g, ' ').trim()
      return note === '' ? `${change.count} options` : `${change.count} options: ${cut(note)}`
    }
    case 'keep':
      return `Keep option: ${change.option}`
  }
}
