import type { Target } from '../../requests/format.ts'
import { isPlaced, locOf, sameTarget, type Item, type PlacedEdit, type Place } from './model.ts'

// Keeps an edit on its element after a change of the screen file. The target
// of an edit is a place in the code (file, line, column), with the tag name
// that the code writes there and the text of the element (`label`). After an
// agent changes the screen file, the lines of the remaining edits can be
// wrong: the editor reads the elements of the new frame document and checks
// each edit before it applies the preview.
//
// A place is a place of one document: the editor keeps, for each target, the
// document whose places it is in (`Base`), and moves a target only by one step,
// from the document before to the current one.
//
// - `current`: the target is a place of the current document (it was checked
//   in it, or the user made the edit in it). In one document a place is one
//   element of the code: the element at the target with the same tag name and
//   the same label is the element of the edit (an empty label needs only the
//   tag). Else the edit is stale; it does not move.
// - `previous`: the target is a place of the document before (`previous`).
//   The edit moves with its neighbors (`shiftOf`); with any doubt it is stale.
//   A look (tag and label) alone never decides where an element is: a removal
//   and a text change in one pass can give a look to a different element. Each
//   move is confirmed by the alignment of the tags and columns of the two
//   documents with no labels (`sureMatches`): the target, and the landmarks
//   next to it, must be at the place that every longest alignment gives them.
//   When the agent pass only removed elements and changed text, style and
//   lines (no move, no added element), the true one-to-one map of the elements
//   that remain is one of the longest alignments, thus a place that all of them
//   agree on is the true one, and the edit never lands on a different element.
//   A move or an added element (a hand edit, a part that renders only now) can
//   make a different alignment the longest one; the checks of `shiftOf` remain,
//   and two cases are known: two elements with the same tag and the same label
//   (or none) that trade places with a landmark between them, and an element
//   that a hand edit replaces with one of the same tag and lines, look like no
//   change, and the edit stays at the place. A file with a repeated structure
//   (two cards with the same elements) can have more than one longest
//   alignment after a removal: the edits there go stale.
// - `unknown`: the target came from the request file and the editor has no
//   document before (it opened after the file changed), or the editor never
//   checked it: the element at the target with the same tag and label, else
//   the one place with the same tag and label in the file. A remove edit and
//   an edit with an empty label do not move by the label: a different element
//   that looks the same would be hidden or changed.
// - `lost`: the target is a place of an older document (the edit was stale
//   when the file changed again): the edit stays stale.
//
// A stale edit has no preview, a warning, and a discard button. The new place
// of a moved edit is written to the request file.
//
// A comment on an element is checked as the other edits: it moves with its
// element and goes stale. A comment on the screen has no target: the check
// leaves it out, and it never goes stale.

// A screen element of a frame document as the anchor reads it: its place in
// the code, the tag name written there, and its text as a label (`labelOf`),
// read with no preview applied. One entry for each copy of a place.
export type ScreenElement = { file: string; line: number; column: number; tag: string; label: string }

export type Anchor = { status: 'ok' } | { status: 'moved'; line: number; column: number } | { status: 'stale' }

// A line and a column in a screen file.
type LineColumn = { line: number; column: number }

// What the check reads of a target: its place, its tag name and its label.
type Look = Place & Pick<Target, 'tag' | 'label'>

const comparePlaces = (a: LineColumn, b: LineColumn) => a.line - b.line || a.column - b.column

// One element for each place in `file` with a label, by its tag and label;
// the copies of one place are one place. A look with more than one place
// gives null.
function uniqueLooks(elements: readonly ScreenElement[], file: string): Map<string, ScreenElement | null> {
  const result = new Map<string, ScreenElement | null>()
  for (const element of elements) {
    if (element.file !== file || element.label === '') continue
    const look = `${element.tag}\n${element.label}`
    const found = result.get(look)
    if (found === undefined) result.set(look, element)
    else if (found !== null && comparePlaces(found, element) !== 0) result.set(look, null)
  }
  return result
}

// A landmark: the place of an element in the document before, and the lines
// and columns that it moved in the new document.
type Landmark = LineColumn & { lines: number; columns: number }

function landmarksOf(file: string, previous: readonly ScreenElement[], elements: readonly ScreenElement[]): Landmark[] {
  const now = uniqueLooks(elements, file)
  const result: Landmark[] = []
  for (const [look, before] of uniqueLooks(previous, file)) {
    const after = now.get(look)
    if (!before || !after) continue
    const lines = after.line - before.line
    result.push({ line: before.line, column: before.column, lines, columns: after.column - before.column })
  }
  return result.sort(comparePlaces)
}

// The element at the target: the same place, the same tag name, and the same
// label (an empty label of the target needs only the tag).
const isAt = (element: ScreenElement, target: Look) =>
  sameTarget(element, target) && element.tag === target.tag && (target.label === '' || element.label === target.label)

// The elements of `file` after `from` and before `to` (no limit for an
// absent one), in the sequence of the code.
function between(elements: readonly ScreenElement[], file: string, from?: LineColumn, to?: LineColumn): ScreenElement[] {
  return elements
    .filter(
      (element) =>
        element.file === file &&
        (!from || comparePlaces(element, from) > 0) &&
        (!to || comparePlaces(element, to) < 0),
    )
    .sort(comparePlaces)
}

const placeKey = (place: LineColumn) => `${place.line}:${place.column}`

// The places of `file` in the sequence of the code, each with its tag name;
// the copies of one place are one place.
function placesOf(elements: readonly ScreenElement[], file: string): (LineColumn & { tag: string })[] {
  const result = new Map<string, LineColumn & { tag: string }>()
  for (const element of elements) {
    if (element.file !== file) continue
    result.set(placeKey(element), { line: element.line, column: element.column, tag: element.tag })
  }
  return [...result.values()].sort(comparePlaces)
}

const samePlace = (a: LineColumn | undefined, b: LineColumn) => a !== undefined && comparePlaces(a, b) === 0

// The results of `sureMatches` by `previous`, `elements` and file.
type SureCache = WeakMap<readonly ScreenElement[], Map<string, Map<string, LineColumn>>>
const sureCache = new WeakMap<readonly ScreenElement[], SureCache>()

// The alignment of the places of `file` in `previous` with the places in
// `elements` by their tag name and column, with no labels and no lines: a
// longest sequence of pairs, in the sequence of the code on both sides. For
// each place of `previous` that every longest alignment pairs with the same
// place of `elements`, that place, by `placeKey`. A place that some longest
// alignment leaves out, or pairs with a different place, is not in the map.
function sureMatches(
  file: string,
  previous: readonly ScreenElement[],
  elements: readonly ScreenElement[],
): Map<string, LineColumn> {
  let byElements = sureCache.get(previous)
  if (!byElements) sureCache.set(previous, (byElements = new WeakMap()))
  let byFile = byElements.get(elements)
  if (!byFile) byElements.set(elements, (byFile = new Map()))
  const known = byFile.get(file)
  if (known) return known

  const a = placesOf(previous, file)
  const b = placesOf(elements, file)
  const n = a.length
  const m = b.length
  const width = m + 1
  const same = (i: number, j: number) => a[i].tag === b[j].tag && a[i].column === b[j].column
  // head[i * width + j]: the length of a longest alignment of a[0, i) with
  // b[0, j); tail[i * width + j]: of a[i, n) with b[j, m).
  const head = new Int32Array((n + 1) * width)
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      head[i * width + j] = same(i - 1, j - 1)
        ? head[(i - 1) * width + j - 1] + 1
        : Math.max(head[(i - 1) * width + j], head[i * width + j - 1])
    }
  }
  const tail = new Int32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      tail[i * width + j] = same(i, j)
        ? tail[(i + 1) * width + j + 1] + 1
        : Math.max(tail[(i + 1) * width + j], tail[i * width + j + 1])
    }
  }
  const longest = head[n * width + m]
  const result = new Map<string, LineColumn>()
  for (let i = 0; i < n; i++) {
    // The longest alignment that leaves a[i] out, and the places of b that a
    // longest alignment pairs with a[i].
    let without = 0
    const pairs: number[] = []
    for (let j = 0; j <= m; j++) {
      without = Math.max(without, head[i * width + j] + tail[(i + 1) * width + j])
      if (j < m && same(i, j) && head[i * width + j] + 1 + tail[(i + 1) * width + j + 1] === longest) pairs.push(j)
    }
    if (without < longest && pairs.length === 1) {
      const found = b[pairs[0]]
      result.set(placeKey(a[i]), { line: found.line, column: found.column })
    }
  }
  byFile.set(file, result)
  return result
}

// The number of lines that the code around `target` moved from `previous` to
// `elements`, or null when that is not certain. The nearest landmark before the
// target and the nearest landmark after it (the start or the end of the file
// when there is none) moved by the same number of lines and kept their
// columns, and each of them is at the place that every longest alignment
// gives it (`sureMatches`): a landmark whose look went to a different element
// gives null, it is not skipped. The elements between them are the same
// sequence of tags, each at the same column and moved by that number of
// lines; no other place between them has the tag of the target; the element
// at the new place has the tag and the label of the target (an empty label
// needs only the tag); and every longest alignment gives the target that new
// place. An applied removal, a move or an added element between the landmarks
// changes the sequence or the lines. Two elements with the same tag between
// the landmarks can change places with no change of the sequence, thus one of
// them is enough to give null. The labels of the other elements between the
// landmarks can differ: an applied text edit changes them.
function shiftOf(target: Look, previous: readonly ScreenElement[], elements: readonly ScreenElement[]): number | null {
  const landmarks = landmarksOf(target.file, previous, elements)
  // A landmark at the target itself is not a neighbor.
  const before = landmarks.findLast((landmark) => comparePlaces(landmark, target) < 0)
  const after = landmarks.find((landmark) => comparePlaces(landmark, target) > 0)
  if (before?.columns || after?.columns) return null
  if (before && after && before.lines !== after.lines) return null
  const movedPlace = (landmark: Landmark) => ({ line: landmark.line + landmark.lines, column: landmark.column })
  const sure = sureMatches(target.file, previous, elements)
  const confirmed = (landmark?: Landmark) => !landmark || samePlace(sure.get(placeKey(landmark)), movedPlace(landmark))
  if (!confirmed(before) || !confirmed(after)) return null
  const old = between(previous, target.file, before, after)
  if (!old.some((element) => isAt(element, target))) return null
  if (old.some((element) => element.tag === target.tag && !sameTarget(element, target))) return null
  const now = between(elements, target.file, before && movedPlace(before), after && movedPlace(after))
  if (now.length !== old.length) return null
  const lines = before?.lines ?? after?.lines ?? now[0].line - old[0].line
  const same = old.every(
    (element, index) =>
      now[index].tag === element.tag && now[index].column === element.column && now[index].line - element.line === lines,
  )
  if (!same) return null
  // The same check as for a target of the current document, at the new place,
  // and the place that the alignment gives the target.
  const moved = { ...target, line: target.line + lines }
  if (!now.some((element) => isAt(element, moved))) return null
  return samePlace(sure.get(placeKey(target)), moved) ? lines : null
}

// The place in `elements` of the element at `loc` in `previous` (its copy
// `index`, for a place that a list renders more than one time), after a
// change of the screen file: where an edit of that element moves
// (`shiftOf`). Null when the element is not in `previous` or its new place is
// not certain. The selection follows its element with it, thus an open
// comment bubble and the draft of its place follow too.
export function placeAfter(
  loc: string,
  previous: readonly ScreenElement[],
  elements: readonly ScreenElement[],
  index = 0,
): string | null {
  const element = previous.filter((entry) => locOf(entry) === loc)[index]
  const lines = element ? shiftOf(element, previous, elements) : null
  return element && lines !== null ? locOf({ ...element, line: element.line + lines }) : null
}

// The place in `elements` of the selected element, the copy `index` of the
// place `loc` in `previous`, after a change of the screen file: the place that
// `placeAfter` gives. When that is not certain, the old place, but only when
// the change moved no element of the file (the same places with the same tags
// in the two documents) and the copy there has the tag of the selected one:
// with its label, or with a new label (the agent changed its text) when the
// old label is at no other place of the file now (two elements that traded
// their texts are not certain). Else null. Siblings often share a column,
// thus after the agent added or removed lines above, a different element can
// be at the old place: it is never taken.
export function followPlace(
  loc: string,
  index: number,
  previous: readonly ScreenElement[],
  elements: readonly ScreenElement[],
): string | null {
  const moved = placeAfter(loc, previous, elements, index)
  if (moved !== null) return moved
  const before = previous.filter((entry) => locOf(entry) === loc)[index]
  const now = elements.filter((entry) => locOf(entry) === loc)[index]
  if (!before || !now || now.tag !== before.tag) return null
  const old = placesOf(previous, before.file)
  const current = placesOf(elements, before.file)
  const unmoved =
    old.length === current.length &&
    old.every((place, at) => comparePlaces(place, current[at]) === 0 && place.tag === current[at].tag)
  if (!unmoved) return null
  if (before.label === '' || now.label === before.label) return loc
  const elsewhere = elements.some(
    (entry) =>
      entry.file === before.file && entry.tag === before.tag && entry.label === before.label && locOf(entry) !== loc,
  )
  return elsewhere ? null : loc
}

// The document whose places a target is in (see the top of the file).
export type Base = 'current' | 'previous' | 'unknown' | 'lost'

const ok: Anchor = { status: 'ok' }
const stale: Anchor = { status: 'stale' }

function placed(target: Target, place: LineColumn): Anchor {
  return comparePlaces(place, target) === 0 ? ok : { status: 'moved', line: place.line, column: place.column }
}

// `previous` is the list of the screen elements of the document before the
// current one (empty when there is none).
export function anchor(
  edit: PlacedEdit,
  base: Base,
  elements: readonly ScreenElement[],
  previous: readonly ScreenElement[],
): Anchor {
  const target = edit.target
  if (base === 'lost') return stale
  if (base === 'current') return elements.some((element) => isAt(element, target)) ? ok : stale

  if (base === 'unknown') {
    if (elements.some((element) => isAt(element, target))) return ok
    if (edit.change.kind === 'remove' || target.label === '') return stale
    // The places with a match; the copies of one place are one match.
    const places = new Map<string, ScreenElement>()
    for (const element of elements) {
      if (element.file === target.file && element.tag === target.tag && element.label === target.label) {
        places.set(`${element.line}:${element.column}`, element)
      }
    }
    if (places.size !== 1) return stale
    const [found] = places.values()
    return placed(target, found)
  }

  const lines = shiftOf(target, previous, elements)
  if (lines === null) return stale
  return placed(target, { line: target.line + lines, column: target.column })
}

// The screen elements of the last read document of a screen, the elements of
// the document before it (`previous`), and the bases of the targets, by
// `targetKey`: the targets that are places of this document (`current`) and of
// the document before (`carried`), and each target that a check saw (`seen`).
// `first` is true for the first document that the editor read for the screen:
// a target that is not current there came from the request file (`unknown`).
// `waiting`: the unknown targets that a check of this document did not find
// (a lazy part of the screen can render them later); a later read of the same
// document checks them again as unknown, and a new document counts them as
// seen.
export type Reading<D> = {
  document: D
  elements: readonly ScreenElement[]
  previous: readonly ScreenElement[]
  first: boolean
  current: ReadonlySet<string>
  carried: ReadonlySet<string>
  seen: ReadonlySet<string>
  waiting?: ReadonlySet<string>
}

const targetKey = (id: string, target: Place) => `${id}\n${locOf(target)}`

export function baseOf<D>(reading: Reading<D>, edit: PlacedEdit): Base {
  const key = targetKey(edit.id, edit.target)
  if (reading.current.has(key)) return 'current'
  if (reading.carried.has(key)) return 'previous'
  if (reading.first || !reading.seen.has(key)) return 'unknown'
  return 'lost'
}

// The reading of a document with `elements` (one element or more) after
// `last`. A read of the same document again (a state update, a lazy part)
// keeps the bases. A new document takes the elements of the last one as
// `previous` and its current targets as `carried`: a target that was stale in
// the last document is lost.
export function nextReading<D>(
  last: Reading<D> | undefined,
  document: D,
  elements: readonly ScreenElement[],
): Reading<D> {
  if (last === undefined) {
    return { document, elements, previous: [], first: true, current: new Set(), carried: new Set(), seen: new Set() }
  }
  if (last.document === document) return { ...last, elements }
  return {
    document,
    elements,
    previous: last.elements,
    first: false,
    current: new Set(),
    carried: last.current,
    seen: last.waiting && last.waiting.size > 0 ? new Set([...last.seen, ...last.waiting]) : last.seen,
  }
}

// A write to the edits store for one item: the stale mark (`mark`), and a new
// line and column (`retarget`) when the edit moved.
export type AnchorWrite = { id: string; stale: boolean; line?: number; column?: number }

// The writes that bring the items of a screen in agreement with the elements
// of `reading`: only for the items whose stale mark or place changes. Also the
// reading with the bases after the check: a target at its place, and the new
// place of a moved one, are places of the current document. An item with no
// target (a comment on the screen) gives no write.
export function anchorWrites<D>(
  items: readonly Item[],
  reading: Reading<D>,
): { writes: AnchorWrite[]; reading: Reading<D> } {
  const writes: AnchorWrite[] = []
  const current = new Set(reading.current)
  const seen = new Set(reading.seen)
  const waiting = new Set(reading.waiting)
  for (const { edit, stale: wasStale } of items) {
    if (!isPlaced(edit)) continue
    const { id, target } = edit
    const base = baseOf(reading, edit)
    const found = anchor(edit, base, reading.elements, reading.previous)
    const stale = found.status === 'stale'
    const key = targetKey(id, target)
    // An unknown target that this document does not have yet stays unknown
    // for the next read of the document.
    if (base === 'unknown' && stale) waiting.add(key)
    else {
      waiting.delete(key)
      seen.add(key)
    }
    if (found.status === 'moved') {
      const key = targetKey(id, { file: target.file, line: found.line, column: found.column })
      current.add(key)
      seen.add(key)
      writes.push({ id, stale, line: found.line, column: found.column })
    } else {
      if (!stale) current.add(targetKey(id, target))
      if ((wasStale === true) !== stale) writes.push({ id, stale })
    }
  }
  return { writes, reading: { ...reading, current, seen, waiting } }
}

// The part of the edits store that `anchorScreen` writes to.
export type AnchorStore = {
  get: (screenId: string) => Item[]
  mark: (screenId: string, id: string, stale: boolean) => void
  retarget: (screenId: string, id: string, line: number, column: number) => void
}

// Reads `elements` of `document` after `last`, writes the stale mark and the
// new place of each item of the screen to the store, and gives the new reading
// and `ready`: true when the items can have a preview now, the list of the
// store is still `items`. When the check changed the list, the caller applies
// the preview of the new list. A screen with no elements (a render error)
// changes nothing: its edits are not stale, the screen cannot be read, and the
// last reading stays the one to move from.
export function anchorScreen<D>(
  store: AnchorStore,
  screenId: string,
  items: readonly Item[],
  last: Reading<D> | undefined,
  document: D,
  elements: readonly ScreenElement[],
): { ready: boolean; reading: Reading<D> | undefined } {
  if (elements.length === 0) return { ready: store.get(screenId) === items, reading: last }
  const result = anchorWrites(items, nextReading(last, document, elements))
  for (const write of result.writes) {
    // The new place first: a stale mark is cleared on the moved item.
    if (write.line !== undefined && write.column !== undefined) {
      store.retarget(screenId, write.id, write.line, write.column)
    }
    store.mark(screenId, write.id, write.stale)
  }
  return { ready: store.get(screenId) === items, reading: result.reading }
}
