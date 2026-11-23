// The parts of the title row of a frame that fit its width on the screen. The
// row keeps one size at each zoom, thus at a low zoom it has less room than
// its parts need. The parts then go out one step after the other, in a fixed
// order, and the title text gets the room: it is cut last and never goes out.
// Each part has a fixed width, thus each step has a fixed threshold.

export type TitlePart =
  | 'title'
  | 'mark'
  | 'issues'
  | 'pins'
  | 'asked'
  | 'options'
  | 'width'
  | 'relation'
  | 'keep'
  | 'whole'
  | 'actions'
  | 'menu'

// The space between two parts of the row, in px on the screen (`gap-2`).
export const titleGap = 8

// The height of the row above a frame, in px on the screen: a little more
// than one line of `text-xs` and the space below it (`pb-1.5`). A fit of the
// view leaves it free above the frame.
export const titleRowHeight = 24

// The least width of the title text before a different part goes out.
export const titleMin = 48

// The width of each part in px on the screen, a little more than its usual
// content: "State", "3 options", "1440", a count of issues with its icon.
// `pins` is the width of one pin with no count; the row counts the pins that
// it has with `pinsWidth`.
// `relation` is the text of a relation error; its icon is `relationIcon`.
// `asked` is the mark of the open requests for options ("Options asked: 3").
// `whole` is the switch of an option with a part ("Show the whole screen").
// `actions` are up to three icons: "Comment on the screen", "Ask for options"
// (not for an option) and "Open as a full page". `menu` is the button of the
// menu of the screen actions.
export const partWidth: Record<Exclude<TitlePart, 'title'>, number> = {
  mark: 48,
  issues: 36,
  pins: 40,
  asked: 104,
  options: 64,
  width: 32,
  relation: 120,
  keep: 112,
  whole: 16,
  actions: 60,
  menu: 22,
}

// The icon of a relation error stays when its text goes out.
export const relationIcon = 14

// The order of removal. "Keep this option" and the switch of the whole
// screen stay after the counts: the frame of an option with a part is as
// small as its block, and the choice of an option is what its row is for.
// The menu of the screen actions is the last action to go out, thus a small
// frame can still be moved and deleted.
const removal: readonly (readonly TitlePart[])[] = [
  ['actions'],
  ['width'],
  ['relation'],
  ['asked'],
  ['options'],
  ['pins'],
  ['issues'],
  ['keep'],
  ['whole'],
  ['menu'],
  ['mark'],
]

// `available` is the width of the row on the screen (the width of the frame
// by the scale; for a frame with a crop, the width of its column),
// `present` the parts that the frame has, in the order of the row. `widths`
// gives a part a width of its own in place of `partWidth` (the pins, from
// `pinsWidth`). The result keeps the order of `present`.
export function titleParts(
  available: number,
  present: readonly TitlePart[],
  widths: Partial<Record<Exclude<TitlePart, 'title'>, number>> = {},
): TitlePart[] {
  const room = Number.isFinite(available) ? available : 0
  const icon = present.includes('relation') ? relationIcon + titleGap : 0
  const need = (parts: ReadonlySet<TitlePart>) => {
    let width = titleMin + icon
    for (const part of parts) if (part !== 'title') width += (widths[part] ?? partWidth[part]) + titleGap
    return width
  }
  const shown = new Set(present)
  for (const step of removal) {
    if (need(shown) <= room) break
    for (const part of step) shown.delete(part)
  }
  return present.filter((part) => shown.has(part))
}

// The parts of the width of a pin of the title row, in px on the screen.
const pinMinWidth = 16 // `min-w-4`
const pinPadding = 4 // at each side (`px-1`)
const pinDigit = 6 // about the width of one digit
const pinCountGap = 2 // between the number and the count
const pinDot = 3 // about the width of the `·` before the count
const pinsGap = 4 // between two pins (`gap-1`)

// The width of the pins of the title row in px on the screen: each pin is at
// least `pinMinWidth` wide, with `pinPadding` at each side, `pinDigit` for
// each digit of its number, and, with more than one comment, the count
// ("·3": the dot and the digits) `pinCountGap` after it; `pinsGap` between
// two pins. 0 with no pin.
export function pinsWidth(pins: readonly { number: number; count: number }[]): number {
  const digits = (value: number) => String(value).length * pinDigit
  let width = 0
  for (const pin of pins) {
    const count = pin.count > 1 ? pinCountGap + pinDot + digits(pin.count) : 0
    width += Math.max(pinMinWidth, pinPadding * 2 + digits(pin.number) + count)
  }
  return pins.length === 0 ? 0 : width + pinsGap * (pins.length - 1)
}

// The parts that the title row of a frame has, in the order of the row: the
// mark of a state or an option, the title, the count of options, the width,
// the relation error, the count of issues, the pins (comments on the screen,
// lost comments), the mark of the asked options, "Keep this option", the
// switch of the whole screen (an option with a part), the actions, and the
// menu of the screen actions (none with the Preview switch on).
// `relationError` is true for a cause that the row shows: a broken relation,
// or a marker of a part that breaks a rule.
export function presentParts(state: {
  related: boolean
  options: boolean
  relationError: boolean
  pins: boolean
  asked: boolean
  keep: boolean
  part: boolean
  menu: boolean
}): TitlePart[] {
  const parts: TitlePart[] = []
  if (state.related) parts.push('mark')
  parts.push('title')
  if (state.options) parts.push('options')
  parts.push('width')
  if (state.relationError) parts.push('relation')
  parts.push('issues')
  if (state.pins) parts.push('pins')
  if (state.asked) parts.push('asked')
  if (state.keep) parts.push('keep')
  if (state.part) parts.push('whole')
  parts.push('actions')
  if (state.menu) parts.push('menu')
  return parts
}
