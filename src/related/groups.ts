// The groups of related screens: a base screen with its states, and the
// options of each of these frames. The canvas and the index of the site read
// the structure from here. The module takes the list as an argument and
// imports nothing, thus a test gives it plain objects.

// The fields of a screen that the groups read. An entry of
// `virtual:canvas-screens` has them.
export type RelatedScreen = {
  id: string
  flow: string
  stateOf?: string
  optionOf?: string
}

// A frame and the options that belong to it.
export type Related<S extends RelatedScreen = RelatedScreen> = { screen: S; options: S[] }

// A base screen and its states, each with its options.
export type ScreenGroup<S extends RelatedScreen = RelatedScreen> = { base: Related<S>; states: Related<S>[] }

export type Relation = 'base' | 'state' | 'option'

export function relationOf(screen: Pick<RelatedScreen, 'stateOf' | 'optionOf'>): Relation {
  if (screen.stateOf !== undefined) return 'state'
  if (screen.optionOf !== undefined) return 'option'
  return 'base'
}

// The options of the screen `baseId`, in the order of the list.
export function optionsOf<S extends RelatedScreen>(screens: readonly S[], baseId: string): S[] {
  return screens.filter((screen) => screen.optionOf === baseId)
}

// The screens that go with the screen `id` when it moves or goes to the trash:
// its states, then the options of the screen and of its states, in the order
// of the list.
export function groupMembers<S extends RelatedScreen>(screens: readonly S[], id: string): S[] {
  const states = screens.filter((screen) => screen.stateOf === id)
  const bases = new Set([id, ...states.map((state) => state.id)])
  const options = screens.filter((screen) => screen.optionOf !== undefined && bases.has(screen.optionOf))
  return [...states, ...options]
}

// The count of the options of each screen that has options, in one pass of
// the list; a screen with no options is not in the map.
export function optionTotals(screens: readonly RelatedScreen[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const screen of screens) {
    if (screen.optionOf !== undefined) totals.set(screen.optionOf, (totals.get(screen.optionOf) ?? 0) + 1)
  }
  return totals
}

// The screen that `screen` belongs to, or null when it starts a
// group of its own. The list of `screenList` keeps each relation in the rules
// (a state of a base, an option of a base or a state, in the same flow); a
// relation that breaks them here (a base that is not in the list, a chain)
// makes the screen a group of its own, thus each screen of the list has one
// place. An option of a state is an option of that frame also when the state
// is a group of its own.
function parentOf<S extends RelatedScreen>(screen: S, byId: ReadonlyMap<string, S>): S | null {
  const relation = relationOf(screen)
  if (relation === 'base') return null
  const base = byId.get(relation === 'state' ? screen.stateOf! : screen.optionOf!)
  if (!base || base === screen || base.flow !== screen.flow) return null
  const baseRelation = relationOf(base)
  if (relation === 'state') return baseRelation === 'base' ? base : null
  return baseRelation === 'option' ? null : base
}

// One group for each base screen, in the order of the list; the states of a
// base and the options of a frame keep the order of the list too. A screen
// whose relation cannot be placed (see `parentOf`) is the base of a group of
// its own, at its place in the list.
export function screenGroups<S extends RelatedScreen>(screens: readonly S[]): ScreenGroup<S>[] {
  const byId = new Map(screens.map((screen) => [screen.id, screen]))
  const related = new Map<S, Related<S>>(screens.map((screen) => [screen, { screen, options: [] }]))
  const groups = new Map<S, ScreenGroup<S>>()
  for (const screen of screens) {
    if (!parentOf(screen, byId)) groups.set(screen, { base: related.get(screen)!, states: [] })
  }
  for (const screen of screens) {
    const parent = parentOf(screen, byId)
    if (!parent) continue
    if (relationOf(screen) === 'state') groups.get(parent)!.states.push(related.get(screen)!)
    else related.get(parent)!.options.push(screen)
  }
  return [...groups.values()]
}
