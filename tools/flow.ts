// The sequence of the screens in a row of the canvas: `screens/<flow>/flow.json`.
//
// The file is plain data that a person can read: `{ "order": ["welcome",
// "workspace"] }`, the base screens of the flow by their file names. The
// base screens that `order` names come first, in its sequence; each other base
// screen comes after them, by name. Thus a flow with no file has the sequence
// by name, and a new screen needs no entry. States and options are not in the
// list: they stay with their base. A name that no base screen of the flow has
// does nothing. A file that is not valid is an error of the flow, and the row
// then has the sequence by name.

// The file name of the sequence in the folder of a flow.
export const flowFileName = 'flow.json'

// A `flow.json` as the disk has it. `flow` is the folder of the file in the
// screens folder ('' directly in it); `file` is its path relative to the
// project root.
export type FlowFile = { flow: string; file: string; text: string }

// The result of `parseFlow`: the names, or the error text and no names.
export type FlowOrder = { order: string[]; error?: string }

function invalid(error: string): FlowOrder {
  return { order: [], error }
}

// Reads the text of a `flow.json`. `order` is a list of names: each a text that
// is not empty and has no `/`, each one time. Other keys are left alone.
export function parseFlow(text: string): FlowOrder {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (error) {
    return invalid(`not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return invalid('must be an object with `order`')
  const order = (data as { order?: unknown }).order
  if (!Array.isArray(order)) return invalid('`order` must be a list of screen names')
  const seen = new Set<string>()
  for (const name of order) {
    if (typeof name !== 'string' || name === '' || name.includes('/')) {
      return invalid('each item of `order` must be the file name of a screen with no extension, such as "welcome"')
    }
    if (seen.has(name)) return invalid(`\`order\` names '${name}' two times`)
    seen.add(name)
  }
  return { order: [...seen] }
}

// The orders of the files that are valid, by flow.
export function flowOrders(files: readonly FlowFile[]): Map<string, string[]> {
  const orders = new Map<string, string[]>()
  for (const file of files) {
    const result = parseFlow(file.text)
    if (result.error === undefined) orders.set(file.flow, result.order)
  }
  return orders
}

// The error of a `flow.json` that is not valid: its flow, its path and the
// cause.
export type FlowError = { flow: string; file: string; error: string }

// The errors of the files that are not valid.
export function flowErrors(files: readonly FlowFile[]): FlowError[] {
  return files.flatMap((file) => {
    const { error } = parseFlow(file.text)
    return error === undefined ? [] : [{ flow: file.flow, file: file.file, error }]
  })
}

function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

// The sequence of the base screens of a row: the names of `order` that are in
// `names`, then the other names, by name.
export function flowSequence(order: readonly string[], names: readonly string[]): string[] {
  const present = new Set(names)
  const named = order.filter((name) => present.has(name))
  const listed = new Set(named)
  return [...named, ...[...new Set(names)].filter((name) => !listed.has(name)).sort(compare)]
}

// The fields of a screen that the sequence reads. An entry of the list has them.
export type OrderedScreen = { id: string; flow: string; name: string; stateOf?: string; optionOf?: string }

// The base screen of a group: the screen itself for a base, its base for a
// state, and the base of the state for an option of a state. A relation to a
// screen that is not in the list, or in a different flow, or a chain, gives
// the screen itself, as `screenGroups` makes it a group of its own.
function rootOf<S extends OrderedScreen>(screen: S, byId: ReadonlyMap<string, S>): S {
  let current = screen
  for (let step = 0; step < 2; step++) {
    const baseId = current.stateOf ?? current.optionOf
    if (baseId === undefined) return current
    const base = byId.get(baseId)
    if (!base || base === current || base.flow !== screen.flow) return current
    current = base
  }
  return current.stateOf === undefined && current.optionOf === undefined ? current : screen
}

// The list by flow, then by the sequence of the base screens of each flow
// (`flowSequence` with the order of `flows`), then by name. A state and an
// option have the place of their base, thus they stay with it. `flows` maps a
// flow to its `order`; a flow that it does not name has the sequence by name.
export function orderScreens<S extends OrderedScreen>(screens: readonly S[], flows: ReadonlyMap<string, readonly string[]>): S[] {
  const byId = new Map(screens.map((screen) => [screen.id, screen]))
  const roots = new Map(screens.map((screen) => [screen, rootOf(screen, byId)]))
  const rank = new Map<string, Map<string, number>>()
  for (const flow of new Set(screens.map((screen) => screen.flow))) {
    const names = screens.filter((screen) => screen.flow === flow && roots.get(screen) === screen).map((screen) => screen.name)
    rank.set(flow, new Map(flowSequence(flows.get(flow) ?? [], names).map((name, index) => [name, index])))
  }
  const place = (screen: S) => rank.get(screen.flow)!.get(roots.get(screen)!.name) ?? Number.MAX_SAFE_INTEGER
  return [...screens].sort((a, b) => compare(a.flow, b.flow) || place(a) - place(b) || compare(a.name, b.name))
}

// The new `order` of a flow after a move: the sequence of its base screens
// (`flowSequence`) with `name` at the position `to` (from 0, kept in the
// range). `names` are the names of the base screens of the flow. A name of
// `order` that no base screen has goes out. An unknown `name` changes nothing.
export function movedOrder(order: readonly string[], names: readonly string[], name: string, to: number): string[] {
  const sequence = flowSequence(order, names)
  const from = sequence.indexOf(name)
  if (from === -1) return sequence
  sequence.splice(from, 1)
  sequence.splice(Math.max(0, Math.min(to, sequence.length)), 0, name)
  return sequence
}
