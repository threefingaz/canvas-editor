import { isTask, type Change, type Edit, type EditValue, type TaskChange, type Target } from '../../requests/format.ts'

// The list of edits of one screen, in the sequence the user made them.
//
// `stale`: the element at the target is no longer the element of the edit, and
// no other element matches. It is not in the request file: the editor finds it
// again at each load of a frame.
export type Item = { edit: Edit; stale?: true }

// An edit on an element: each edit but a comment on the screen.
export type PlacedEdit = Edit & { target: Target }

export type PlacedItem = Item & { edit: PlacedEdit }

// An edit that can have a preview: on an element, and not a task (a comment,
// an `options` or a `keep` edit).
export type PreviewEdit = PlacedEdit & { change: Exclude<Change, TaskChange> }

export type PreviewItem = Item & { edit: PreviewEdit }

// The place in the code of a target: the identity of an element.
export type Place = Pick<Target, 'file' | 'line' | 'column'>

// The identity of an element is its place in the code. The target null (a
// comment on the screen) is the same only as null.
export function sameTarget(a: Place | null, b: Place | null): boolean {
  if (a === null || b === null) return a === b
  return a.file === b.file && a.line === b.line && a.column === b.column
}

export function isPlaced(edit: Edit): edit is PlacedEdit {
  return edit.target !== null
}

// The location part of a place, as the location prop writes it.
export function locOf(place: Place): string {
  return `${place.file}:${place.line}:${place.column}`
}

// The items that have a preview: no reply of the agent, not stale, and not a
// task (a comment, an `options` or a `keep` edit). Each part of the preview
// reads the items through this filter, thus it never sees a task or the
// target null.
export function liveItems(items: readonly Item[]): PreviewItem[] {
  return items.filter((item): item is PreviewItem => !item.stale && !item.edit.reply && !isTask(item.edit.change))
}

// The same value and the same token id. A value that gets a token is a change.
function sameValue(a: EditValue, b: EditValue): boolean {
  return a.value === b.value && a.token?.id === b.token?.id
}

// The same `after` for two changes of the same kind that is not a style change
// or a removal.
function sameAfter(a: Change, b: Change): boolean {
  if (a.kind === 'text' && b.kind === 'text') return a.after === b.after
  if (a.kind === 'order' && b.kind === 'order') return a.after === b.after
  if (a.kind === 'textStyle' && b.kind === 'textStyle') return sameValue(a.after, b.after)
  return false
}

function unchanged(edit: Edit): boolean {
  const change = edit.change
  switch (change.kind) {
    case 'style':
    case 'textStyle':
      return sameValue(change.before, change.after)
    case 'text':
    case 'order':
      return change.before === change.after
    case 'remove':
      return false
    case 'comment':
      return change.text.trim() === ''
    case 'options':
    case 'keep':
      return false
  }
}

// Merges a new edit into the list and gives a new list; the list it gets does
// not change. It gives the same list when nothing changes.
//
// - A style edit takes its properties out of the earlier style edits on the
//   same target. An earlier edit with no properties left goes out. The new edit
//   keeps the `before` of the first earlier edit that had one of its
//   properties: the value in the code, not the previewed value.
// - A text, text style or order edit replaces the earlier edit of its kind on
//   the same target and keeps its `before`. When it has the same `after` as
//   the earlier edit, the list stays the same: a control that reports one
//   change two times (on Enter and on the blur after it) makes one record.
//   An earlier edit with a reply of the agent is replaced, also with the same
//   `after`: the user makes the edit again.
// - A remove edit keeps the other edits of its target. A second remove edit
//   changes nothing, unless the earlier one has a reply.
// - A comment is always a new item: comments do not merge. A comment with an
//   empty text goes out.
// - An `options` edit is always a new item, as a comment.
// - A `keep` edit takes each earlier `keep` edit out (a screen has at most
//   one), and is then a new item. It keeps no `before`: it has none.
// - An edit whose `after` is equal to its `before` goes out.
// - A stale item is not an earlier edit of the target: the element at its
//   place in the code is a different element. It stays as it is.
export function addEdit(list: Item[], edit: Edit): Item[] {
  const change = edit.change
  if (change.kind === 'comment') return unchanged(edit) ? list : [...list, { edit }]
  if (change.kind === 'options') return [...list, { edit }]
  if (change.kind === 'keep') return [...list.filter((item) => item.edit.change.kind !== 'keep'), { edit }]
  let next = list
  let added = edit

  if (change.kind === 'style') {
    const taken = new Set(change.properties)
    let first: EditValue | undefined
    next = list.flatMap((item) => {
      const earlier = item.edit.change
      if (earlier.kind !== 'style' || item.stale || !sameTarget(item.edit.target, edit.target)) return [item]
      const left = earlier.properties.filter((property) => !taken.has(property))
      if (left.length === earlier.properties.length) return [item]
      first ??= earlier.before
      if (left.length === 0) return []
      return [{ ...item, edit: { ...item.edit, change: { ...earlier, properties: left } } }]
    })
    if (first === undefined) next = list
    else added = { ...edit, change: { ...change, before: first } }
  } else {
    const index = list.findIndex(
      (item) => !item.stale && item.edit.change.kind === change.kind && sameTarget(item.edit.target, edit.target),
    )
    if (index !== -1) {
      const earlier = list[index].edit
      // An earlier item with a reply of the agent has no preview: the new edit
      // replaces it, also with the same `after`.
      if (!earlier.reply && (change.kind === 'remove' || sameAfter(earlier.change, change))) return list
      next = list.filter((_, at) => at !== index)
      // The kind is the same as the kind of the new change.
      if (change.kind !== 'remove') {
        added = { ...edit, change: { ...change, before: (earlier.change as typeof change).before } as typeof change }
      }
    }
  }

  if (unchanged(added)) return next
  return [...next, { edit: added }]
}

export function discard(list: Item[], id: string): Item[] {
  const next = list.filter((item) => item.edit.id !== id)
  return next.length === list.length ? list : next
}

// The items of a target; with null, the comments on the screen.
export function editsOf(target: Target | null, list: Item[]): Item[] {
  return list.filter((item) => sameTarget(item.edit.target, target))
}

// True when two versions of an edit have the same comment text and the same
// reply of the agent. A box that changes the text of a comment stays open only
// while the comment is as it was when the box opened: a new text or a new
// reply from the file closes it, thus Save never writes over them.
export function sameComment(a: Edit, b: Edit): boolean {
  const text = (edit: Edit) => (edit.change.kind === 'comment' ? edit.change.text : null)
  return (
    text(a) !== null &&
    text(a) === text(b) &&
    a.reply?.status === b.reply?.status &&
    a.reply?.text === b.reply?.text
  )
}

// A new text for the comment with the id. The comment keeps its id and its
// place in the list; a reply of the agent goes out, because the user asks
// again. An empty text discards the comment. It gives the same list when the
// list has no comment with the id or the text is the same.
export function replaceComment(list: Item[], id: string, text: string): Item[] {
  const index = list.findIndex((item) => item.edit.id === id)
  if (index === -1) return list
  const item = list[index]
  const change = item.edit.change
  if (change.kind !== 'comment') return list
  if (text.trim() === '') return discard(list, id)
  if (change.text === text && !item.edit.reply) return list
  const { id: own, target, width } = item.edit
  const next = [...list]
  next[index] = { ...item, edit: { id: own, target, width, change: { kind: 'comment', text } } }
  return next
}
