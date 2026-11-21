import type { OrderChange, Target } from '../../requests/format.ts'
import type { Token } from '../../tokens/format.ts'
import { liveItems, locOf, type Item } from '../edits/model.ts'
import { nodesAt } from '../selection/pick.ts'
import { editAttribute, previewRules } from './css.ts'

// The preview of the edits of one screen in its frame document. The editor
// writes only these things into a frame:
//
// - the attribute `data-canvas-edit` on each DOM node of a target (each copy),
//   with the ids of its edits;
// - one style element in the head, `style[data-canvas-preview]`, with the
//   rules of `previewRules`;
// - the `order` of each child of the parent of a moved element, in its inline
//   style with `!important`;
// - the text of an element with a text edit.
//
// It keeps the first text of each changed element and the earlier inline
// `order` of each child, by element and edit id, and puts them back when the
// edit goes out. A text is kept by element, not by text node: React replaces
// the text node when the text changes.
//
// The pure parts take plain objects, thus the tests need no DOM. The document
// is that of a frame, thus this module uses no `instanceof` with the classes of
// the editor window, and creates nodes with the frame document.

// The attribute of the style element of the preview.
export const previewAttribute = 'data-canvas-preview'

// The first DOM node of each copy of a target.
export type NodesOf<N> = (target: Target) => readonly N[]

// The text of the `data-canvas-edit` attribute of each node: the ids of the
// edits of its target, in the sequence of the list, separated by spaces.
export function marks<N>(items: readonly Item[], nodesOf: NodesOf<N>): Map<N, string> {
  const ids = new Map<N, string[]>()
  for (const { edit } of liveItems(items)) {
    for (const node of nodesOf(edit.target)) {
      const list = ids.get(node)
      if (list) list.push(edit.id)
      else ids.set(node, [edit.id])
    }
  }
  return new Map([...ids].map(([node, list]) => [node, list.join(' ')]))
}

// The `order` value of each child of the parent, for a move of the child at
// `before` to `after`: the new position of each child. Null when the count of
// children is not the count of the edit: the DOM is not the code of the edit.
export function orderOf(children: readonly unknown[], change: OrderChange): number[] | null {
  if (children.length !== change.of) return null
  const sequence = children.map((_, index) => index)
  sequence.splice(change.before, 1)
  sequence.splice(change.after, 0, change.before)
  const result: number[] = new Array(children.length)
  sequence.forEach((old, position) => {
    result[old] = position
  })
  return result
}

// A child node, as far as the text preview reads it: a text node has the type 3.
export type ChildLike = { nodeType: number; nodeValue: string | null }

export type ElementLike = { childNodes: ArrayLike<ChildLike> }

const textNodeType = 3

// The one text node of the element's own children; null when it has none or
// more than one.
export function ownTextNode(element: ElementLike): ChildLike | null {
  const texts = Array.from(element.childNodes).filter((child) => child.nodeType === textNodeType)
  return texts.length === 1 ? texts[0] : null
}

// A node as `textOf` reads it.
export type TextLike = ChildLike & { childNodes?: ArrayLike<TextLike> }

const elementNodeType = 1

// The text of a node as the code renders it: the text of all its text nodes,
// as `textContent` gives it, but with the first text (`first`) of each
// element whose text the preview changed. The label of a target is this text,
// thus an edit made while a text edit is previewed has the label of the code.
export function textOf<N extends TextLike>(node: N, first: (element: N) => string | undefined): string {
  if (node.nodeType === textNodeType) return node.nodeValue ?? ''
  if (node.nodeType !== elementNodeType) return ''
  const kept = first(node)
  const own = kept === undefined ? null : ownTextNode({ childNodes: node.childNodes ?? [] })
  let text = ''
  for (const child of Array.from(node.childNodes ?? []) as N[]) {
    text += child === own ? kept : textOf(child, first)
  }
  return text
}

export type TextOp<N> = { element: N; node: ChildLike; id: string; text: string }

// The text nodes to change: for each text edit, the one text node of each copy
// of the target. A copy with no text node or more than one is skipped.
export function textOps<N extends ElementLike>(items: readonly Item[], nodesOf: NodesOf<N>): TextOp<N>[] {
  const result: TextOp<N>[] = []
  for (const { edit } of liveItems(items)) {
    if (edit.change.kind !== 'text') continue
    for (const element of nodesOf(edit.target)) {
      const node = ownTextNode(element)
      if (node) result.push({ element, node, id: edit.id, text: edit.change.after })
    }
  }
  return result
}

export type FirstValue<N, V> = { node: N; id: string; value: V }

export type FirstValues<N, V> = {
  // Reads and keeps the value of the node for the edit, the first time only.
  // When the node has a kept value of a different edit, that value is kept:
  // the value before the preview changed the node.
  keep: (node: N, id: string, read: () => V) => void
  // The value that is kept for the node, for any edit; undefined when none.
  first: (node: N) => V | undefined
  // Forgets the values whose node and edit are no longer active and gives
  // them, to put them back.
  release: (active: (node: N, id: string) => boolean) => FirstValue<N, V>[]
}

// The values that a preview changed, as they were before the first change.
export function createFirstValues<N, V>(): FirstValues<N, V> {
  const values = new Map<N, Map<string, V>>()
  return {
    keep: (node, id, read) => {
      let byId = values.get(node)
      if (!byId) {
        byId = new Map()
        values.set(node, byId)
      }
      if (byId.has(id)) return
      // An earlier edit on the node changed it already: the value before the
      // preview is the one kept for that edit.
      byId.set(id, byId.size > 0 ? (byId.values().next().value as V) : read())
    },
    first: (node) => values.get(node)?.values().next().value,
    release: (active) => {
      const result: FirstValue<N, V>[] = []
      for (const [node, byId] of values) {
        for (const [id, value] of byId) {
          if (active(node, id)) continue
          result.push({ node, id, value })
          byId.delete(id)
        }
        if (byId.size === 0) values.delete(node)
      }
      return result
    },
  }
}

type Inline = { value: string; priority: string }

type Styled = Element & ElementCSSInlineStyle

// What the preview keeps for one frame document.
type Kept = { texts: FirstValues<Element, string>; orders: FirstValues<Styled, Inline> }

const kept = new WeakMap<Document, Kept>()

function keptOf(document: Document): Kept {
  let state = kept.get(document)
  if (!state) {
    state = { texts: createFirstValues(), orders: createFirstValues() }
    kept.set(document, state)
  }
  return state
}

// The text of a node of a frame as the code renders it (see `textOf`), with
// the texts that the preview of its document changed.
export function codeText(node: Element): string {
  const texts = kept.get(node.ownerDocument)?.texts
  return textOf(node as unknown as TextLike, (element) => texts?.first(element as unknown as Element))
}

export type PreviewResult = {
  // True when the preview wrote something into the document.
  changed: boolean
  // The edits that have no rule, with the reason (see `previewRules`).
  problems: string[]
}

type OrderOp = { element: Styled; id: string; value: string }

// The `order` of each child of the parent of each moved element. Only an edit
// with a preview, on a place that draws one copy, whose node is at the
// position `before` among the children of its parent.
function orderOps(items: readonly Item[], nodesOf: NodesOf<Element>): OrderOp[] {
  const result: OrderOp[] = []
  for (const { edit } of liveItems(items)) {
    const change = edit.change
    if (change.kind !== 'order' || !change.previewed) continue
    const nodes = nodesOf(edit.target)
    const parent = nodes.length === 1 ? nodes[0].parentElement : null
    if (!parent) continue
    const children = Array.from(parent.children) as Styled[]
    if (children[change.before] !== nodes[0]) continue
    const values = orderOf(children, change)
    if (!values) continue
    children.forEach((element, index) => result.push({ element, id: edit.id, value: String(values[index]) }))
  }
  return result
}

function setInline(element: Styled, inline: Inline): boolean {
  const style = element.style
  if (style.getPropertyValue('order') === inline.value && style.getPropertyPriority('order') === inline.priority) {
    return false
  }
  if (inline.value === '') style.removeProperty('order')
  else style.setProperty('order', inline.value, inline.priority)
  return true
}

function setText(element: Element, text: string): boolean {
  const node = ownTextNode(element)
  if (!node || node.nodeValue === text) return false
  node.nodeValue = text
  return true
}

// Writes the preview of the items of a screen into its frame document, and
// takes out what is no longer in the list. It writes nothing when nothing
// changed, thus a watch of the document that applies it again ends.
export function applyPreview(document: Document, items: readonly Item[], tokens: readonly Token[]): PreviewResult {
  const cache = new Map<string, Element[]>()
  const nodesOf: NodesOf<Element> = (target) => {
    const loc = locOf(target)
    let nodes = cache.get(loc)
    if (!nodes) {
      nodes = nodesAt(document, loc)
      cache.set(loc, nodes)
    }
    return nodes
  }
  return writePreview(document, items, tokens, nodesOf)
}

// `applyPreview` with the nodes of each target from `nodesOf`: the tests give
// plain objects in place of the document and its nodes.
export function writePreview(
  document: Document,
  items: readonly Item[],
  tokens: readonly Token[],
  nodesOf: NodesOf<Element>,
): PreviewResult {
  let changed = false

  // The attribute of each node of a target; an attribute of an edit that went
  // out is removed.
  const marked = marks(items, nodesOf)
  for (const node of Array.from(document.querySelectorAll(`[${editAttribute}]`))) {
    if (marked.has(node)) continue
    node.removeAttribute(editAttribute)
    changed = true
  }
  for (const [node, ids] of marked) {
    if (node.getAttribute(editAttribute) === ids) continue
    node.setAttribute(editAttribute, ids)
    changed = true
  }

  // The style element of the rules.
  const { rules, problems } = previewRules(items, tokens)
  const css = rules.join('\n')
  const existing = document.head?.querySelector(`style[${previewAttribute}]`) ?? null
  if (css === '') {
    if (existing) {
      existing.remove()
      changed = true
    }
  } else if (document.head) {
    let element = existing
    if (!element) {
      element = document.createElement('style')
      element.setAttribute(previewAttribute, '')
      document.head.appendChild(element)
      changed = true
    }
    if (element.textContent !== css) {
      element.textContent = css
      changed = true
    }
  }

  const state = keptOf(document)

  // The sequence: first put back the `order` of the edits that went out, then
  // write the current ones.
  const orders = orderOps(items, nodesOf)
  for (const { node, value } of state.orders.release((element, id) =>
    orders.some((op) => op.element === element && op.id === id),
  )) {
    if (node.isConnected && setInline(node, value)) changed = true
  }
  for (const op of orders) {
    state.orders.keep(op.element, op.id, () => ({
      value: op.element.style.getPropertyValue('order'),
      priority: op.element.style.getPropertyPriority('order'),
    }))
    if (setInline(op.element, { value: op.value, priority: 'important' })) changed = true
  }

  // The texts, in the same way.
  const texts = textOps(items, nodesOf)
  for (const { node, value } of state.texts.release((element, id) =>
    texts.some((op) => op.element === element && op.id === id),
  )) {
    if (node.isConnected && setText(node, value)) changed = true
  }
  for (const op of texts) {
    state.texts.keep(op.element, op.id, () => op.node.nodeValue ?? '')
    if (setText(op.element, op.text)) changed = true
  }

  return { changed, problems }
}
