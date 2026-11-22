// The links between the screens of the project, from the literal links of
// each screen file (`links` of an entry of the list). The check of the
// screens, the arrows of the canvas and the Project tab share it. It takes the
// list as an argument and imports nothing.
//
// An option is a choice that is still open: it is neither the source nor the
// target of a pair, and it is never "not reached".

export type LinkedScreen = {
  id: string
  flow: string
  width: number
  links: readonly string[]
  stateOf?: string
  optionOf?: string
  // A file that cannot be read, or a relation that breaks a rule: the screen
  // then only looks like a base screen.
  error?: string
  relationError?: string
}

export type LinkPair = { from: string; to: string }

// Each link from a screen to a different screen of the list, in the order of
// the list and then of the code, each pair one time.
export function linkPairs(screens: readonly LinkedScreen[]): LinkPair[] {
  const known = new Set(screens.filter((screen) => screen.optionOf === undefined).map((screen) => screen.id))
  const pairs: LinkPair[] = []
  for (const screen of screens) {
    if (screen.optionOf !== undefined) continue
    for (const to of new Set(screen.links)) {
      if (to !== screen.id && known.has(to)) pairs.push({ from: screen.id, to })
    }
  }
  return pairs
}

// The pairs that the canvas draws as arrows: each pair of `linkPairs`, but a
// link of a state that its base has too. A state is a full copy of its
// screen, thus it repeats each link of it; only a link that is different in
// the state says something about the flow.
export function flowPairs(screens: readonly LinkedScreen[]): LinkPair[] {
  const linksOf = new Map(screens.map((screen) => [screen.id, new Set(screen.links)]))
  const baseOf = new Map(screens.map((screen) => [screen.id, screen.stateOf]))
  return linkPairs(screens).filter((pair) => {
    const base = baseOf.get(pair.from)
    return base === undefined || !linksOf.get(base)?.has(pair.to)
  })
}

// The ids that a screen links to and that no screen has, in the order of the
// code, each one time.
export function unknownLinks(screen: LinkedScreen, ids: ReadonlySet<string>): string[] {
  return [...new Set(screen.links)].filter((id) => !ids.has(id))
}

// The ids of the base screens that no link reaches, in the order of the
// list. A flow starts at a screen that no link reaches, thus one such screen
// is expected; with more, the list has each of them, because it does not say
// which one is the start. The screens of one flow at a different width are a
// flow of their own (`welcome` and `welcome-mobile`). A state is not in the
// list: a picture of a screen has one link on a control, and it cannot lead
// to each state.
export function unreached(screens: readonly LinkedScreen[]): string[] {
  const targets = new Set(linkPairs(screens).map((pair) => pair.to))
  const starts = new Map<string, string[]>()
  for (const screen of screens) {
    if (screen.optionOf !== undefined || screen.stateOf !== undefined || targets.has(screen.id)) continue
    // A broken file is no start of a flow: its links are not known.
    if (screen.error !== undefined || screen.relationError !== undefined) continue
    const key = `${screen.flow}\n${screen.width}`
    const list = starts.get(key)
    if (list) list.push(screen.id)
    else starts.set(key, [screen.id])
  }
  const ids = new Set([...starts.values()].filter((list) => list.length > 1).flat())
  return screens.filter((screen) => ids.has(screen.id)).map((screen) => screen.id)
}
