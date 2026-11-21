import { commentLimit, labelOf, tokenRef, type Edit, type EditValue, type Target } from '../../requests/format.ts'
import type { TextStyle, Token } from '../../tokens/format.ts'
import { liveItems, locOf, type Item } from '../edits/model.ts'
import type { Site } from '../locate/fiber.ts'
import type { Siblings } from '../selection/pick.ts'
import { colorText, textStyleText, type InspectorRow } from './model.ts'

// From a change of a control in the inspector to an edit for the edits store.
// The functions are pure: the inspector reads the selection, the frame and
// the row, and gives the values here.

// A new edit id: 12 hex characters. The id names the edit in the request file
// and in the preview rules.
export function newEditId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
}

// The target of an edit: the place in the code and the tag name from the
// site, the tag of the first DOM node (`element`), the count of copies that
// the place draws, and the text of the element.
export function targetOf(site: Site, element: string, copies: number, label: string): Target {
  return {
    file: site.file,
    line: site.line,
    column: site.column,
    tag: site.tag,
    origin: site.origin,
    element,
    copies,
    label: labelOf(label),
  }
}

// The token where the control of a row stands: the token of a linked or equal
// value, else the nearest token. Null for a row with no state or no nearest
// token.
export function activeToken(row: InspectorRow): Token | null {
  const state = row.state
  if (state === null) return null
  return state.state === 'none' ? state.nearest : state.token
}

// The control of a row: a step control for spacing, radius and shadow (with
// two tokens or more), a select for color and for the text style. Null for a
// row that stays read-only: no tokens, no state, a negative value, or a layout
// value.
export function controlOf(row: InspectorRow): 'step' | 'color' | 'textStyle' | null {
  if (row.tokens.length === 0 || row.state === null || row.state.negative) return null
  if (row.group === 'color') return 'color'
  if (row.group === 'textStyle') return 'textStyle'
  if (row.group === 'spacing' || row.group === 'radius' || row.group === 'shadow') {
    return row.tokens.length > 1 ? 'step' : null
  }
  return null
}

// The value of the row as the page shows it. A color with an opacity shows as
// `#000000 60%`, which is not CSS: it gives its computed value.
function observedValue(row: InspectorRow): string {
  return row.swatch !== undefined && row.value.includes(' ') ? row.swatch : row.value
}

// `after` of a style edit: the value of the token, and for an opaque color the
// hex text that the row shows (`#6941C6`), thus `before` and `after` have one
// form. A color with an opacity keeps the text of the token.
function tokenValue(row: InspectorRow, value: string): string {
  if (row.group !== 'color') return value
  const text = colorText(value)
  return text.includes(' ') ? value : text
}

// `before` of an edit: the value of the row, with its token when it is
// linked, else `observed`.
function beforeOf(row: InspectorRow, value: string): EditValue {
  const state = row.state
  return state?.state === 'linked' ? { value, token: tokenRef(state.token) } : { value, observed: true }
}

// A style edit that sets the properties of the row to `token`. `before` is the
// value of the row: with its token when it is linked, else `observed`. Null
// when no edit is possible: a row with no state or no token group, a token of
// a different group, a text style (it has its own edit), or a negative value
// (a negative margin: a token gives a positive value).
export function styleEdit(
  row: InspectorRow,
  token: Token,
  target: Target,
  width: number,
  id: string = newEditId(),
): Edit | null {
  const state = row.state
  if (state === null || row.group === null || row.group === 'textStyle') return null
  if (token.group !== row.group || typeof token.value !== 'string' || state.negative) return null
  const before = beforeOf(row, state.state === 'linked' ? row.value : observedValue(row))
  const after: EditValue = { value: tokenValue(row, token.value), token: tokenRef(token) }
  return {
    id,
    target,
    width,
    change: {
      kind: 'style',
      properties: [...row.properties],
      before,
      after,
      ...(row.media !== undefined ? { media: row.media } : {}),
    },
  }
}

function isTextStyle(token: Token): token is Token & { value: TextStyle } {
  return token.group === 'textStyle' && typeof token.value === 'object'
}

// A text style edit that gives the element the style `token`. The values are
// texts of the form of the row (`16px / 24px · 400`). Null for a row that is
// not the text style, a row with no state, or a token that is not a text
// style.
export function textStyleEdit(
  row: InspectorRow,
  token: Token,
  target: Target,
  width: number,
  id: string = newEditId(),
): Edit | null {
  if (row.group !== 'textStyle' || row.state === null || !isTextStyle(token)) return null
  return {
    id,
    target,
    width,
    change: {
      kind: 'textStyle',
      before: beforeOf(row, row.value),
      after: { value: textStyleText(token.value), token: tokenRef(token) },
    },
  }
}

// The edit that gives `token` to a row: a text style edit for the text style,
// else a style edit.
export function rowEdit(
  row: InspectorRow,
  token: Token,
  target: Target,
  width: number,
  id: string = newEditId(),
): Edit | null {
  return row.group === 'textStyle'
    ? textStyleEdit(row, token, target, width, id)
    : styleEdit(row, token, target, width, id)
}

// The action of a row with no token link: "Link" for a value that is equal to
// a token, "Use nearest" for a value with a nearest token. Null for a linked
// value, a value with no nearest token, a negative value, and a layout value.
export function rowAction(row: InspectorRow): 'link' | 'nearest' | null {
  const state = row.state
  if (state === null || row.group === null || state.negative) return null
  if (state.state === 'equal') return 'link'
  if (state.state === 'none' && state.nearest !== null) return 'nearest'
  return null
}

// The keyword values that a layout property accepts in the inspector. A
// layout edit takes no free value.
export const layoutKeywords = {
  'flex-direction': ['row', 'column', 'row-reverse', 'column-reverse'],
  'flex-wrap': ['nowrap', 'wrap', 'wrap-reverse'],
  'align-items': ['flex-start', 'center', 'flex-end', 'stretch', 'baseline'],
  'justify-content': ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
} as const satisfies Record<string, readonly string[]>

export type LayoutProperty = keyof typeof layoutKeywords

export function isLayoutProperty(property: string): property is LayoutProperty {
  return Object.hasOwn(layoutKeywords, property)
}

// A style edit that sets a layout property to a keyword. `before` is the
// value of the page (a layout value has no token); `media` is the condition of
// the media rule of the value, when it has one. Null for a property that is
// not in `layoutKeywords`, a value that is not one of its keywords, or an
// equal value.
export function layoutEdit(
  property: string,
  before: string,
  after: string,
  target: Target,
  width: number,
  media?: string,
  id: string = newEditId(),
): Edit | null {
  if (!isLayoutProperty(property) || before === after) return null
  if (!(layoutKeywords[property] as readonly string[]).includes(after)) return null
  return {
    id,
    target,
    width,
    change: {
      kind: 'style',
      properties: [property],
      before: { value: before, observed: true },
      after: { value: after },
      ...(media !== undefined ? { media } : {}),
    },
  }
}

// An order edit that moves the element from `position` to `next` among the
// `count` sibling elements of its parent. `previewed` is false when the parent
// is not a flex or grid container: the edit is saved with no preview. Null
// for a move before the first place or after the last place, a position
// outside the count, or the same place.
//
// The edits store keeps the `before` of an earlier order edit on the same
// target, thus `position` can be the previewed position.
export function orderEdit(
  position: number,
  next: number,
  count: number,
  previewed: boolean,
  target: Target,
  width: number,
  id: string = newEditId(),
): Edit | null {
  const inside = (value: number) => Number.isInteger(value) && value >= 0 && value < count
  if (!inside(position) || !inside(next) || position === next) return null
  return { id, target, width, change: { kind: 'order', before: position, after: next, of: count, previewed } }
}

// The move of an element among the sibling elements of its parent, for the
// Layout section: the position that the frame shows, the count of siblings,
// whether the parent shows a preview, and the ids of the order edits that a
// new move replaces.
export type MovePlan = { position: number; count: number; previewed: boolean; replaced: string[] }

// The move of the element at `loc`; null when a sequence edit is not possible.
// `inParent` tells whether the first node of a place is a child of the same
// parent node.
//
// - The position is the `after` of the live order edit of the element (the
//   previewed position), else its position in the code. An order edit with a
//   reply or `stale` has no preview: the frame shows the code.
// - A new move replaces the order edit of each sibling, also one with a reply
//   or `stale`: the parent has one order edit, thus its positions are always
//   positions in the code.
export function movePlan(
  loc: string,
  siblings: Siblings | null,
  items: readonly Item[],
  inParent: (loc: string) => boolean,
): MovePlan | null {
  if (!siblings?.movable) return null
  const orders = items.filter((item) => item.edit.change.kind === 'order')
  const own = liveItems(orders).find((item) => locOf(item.edit.target) === loc)?.edit.change
  const replaced = orders
    .filter((item) => {
      const target = item.edit.target
      if (target === null) return false
      const place = locOf(target)
      return place !== loc && inParent(place)
    })
    .map((item) => item.edit.id)
  return {
    position: own?.kind === 'order' ? own.after : siblings.position,
    count: siblings.count,
    previewed: siblings.container !== null,
    replaced,
  }
}

// A text edit that gives the element a new text. Both texts are trimmed at
// the ends. Null for an equal text and for an empty text: an element with no
// text is a remove edit.
export function textEdit(
  before: string,
  after: string,
  target: Target,
  width: number,
  id: string = newEditId(),
): Edit | null {
  const from = before.trim()
  const to = after.trim()
  if (to === '' || to === from) return null
  return { id, target, width, change: { kind: 'text', before: from, after: to } }
}

// An edit that removes the element.
export function removeEdit(target: Target, width: number, id: string = newEditId()): Edit {
  return { id, target, width, change: { kind: 'remove' } }
}

// The text of a new comment, or of a comment that changes: the input trimmed
// at the ends. Null for an empty text (spaces only count as empty) and for a
// text of more than `commentLimit` characters after the trim.
export function commentText(input: string): string | null {
  const text = input.trim()
  return text === '' || text.length > commentLimit ? null : text
}

// A comment on the element of the target. Null for a text that
// `commentText` refuses.
export function elementComment(target: Target, width: number, text: string, id: string = newEditId()): Edit | null {
  const comment = commentText(text)
  return comment === null ? null : { id, target, width, change: { kind: 'comment', text: comment } }
}

// A comment on the whole screen: the target is null. `width` is the width of
// the frame of the screen. Null for a text that `commentText` refuses.
export function screenComment(width: number, text: string, id: string = newEditId()): Edit | null {
  const comment = commentText(text)
  return comment === null ? null : { id, target: null, width, change: { kind: 'comment', text: comment } }
}

// True when the text of a place can change: each copy has exactly one text
// node of its own (null for a copy with none or more than one), and all copies
// have the same text. One place in the code then gives one text.
export function textEditable(texts: readonly (string | null)[]): boolean {
  const first = texts[0]
  return first !== undefined && first !== null && texts.every((text) => text === first)
}
