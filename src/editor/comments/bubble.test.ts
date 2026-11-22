import { describe, expect, test } from 'vitest'
import type { Target } from '../../requests/format.ts'
import type { Item } from '../edits/model.ts'
import {
  afterAdd,
  bubbleAfter,
  bubbleAt,
  bubbleName,
  bubblePlace,
  bubbleScreen,
  closedBubble,
  commentsOf,
  draftKey,
  joinDrafts,
  liveTarget,
  newBoxOf,
  pinEvent,
  type Bubble,
  type BubbleTarget,
} from './bubble.ts'
import { lostPin, screenPin } from './pins.ts'

const element: BubbleTarget = { screenId: 'onboarding/welcome', loc: 'screens/onboarding/welcome.tsx:12:7' }
const screen: BubbleTarget = { screenId: 'onboarding/welcome', loc: null }

const fresh: Bubble = { kind: 'new', target: element }
const pin: Bubble = { kind: 'pin', screenId: element.screenId, ids: ['e1', 'e2'], target: element }
const lost: Bubble = { kind: 'pin', screenId: element.screenId, ids: ['e3'], target: null }
const options: Bubble = { kind: 'options', target: element }
const screenOptions: Bubble = { kind: 'options', target: screen }
const open: readonly Bubble[] = [fresh, pin, lost, { kind: 'new', target: screen }, options, screenOptions]

describe('bubbleAfter', () => {
  test('open-new opens the bubble of a new comment on a place, also over a different bubble', () => {
    expect(bubbleAfter(closedBubble, { type: 'open-new', target: element })).toEqual(fresh)
    expect(bubbleAfter(pin, { type: 'open-new', target: screen })).toEqual({ kind: 'new', target: screen })
  })

  test('open-pin opens the comments of a pin by their ids, with the place of a new comment or none', () => {
    expect(bubbleAfter(closedBubble, { type: 'open-pin', screenId: element.screenId, ids: ['e1', 'e2'], target: element })).toEqual(pin)
    expect(bubbleAfter(fresh, { type: 'open-pin', screenId: element.screenId, ids: ['e3'], target: null })).toEqual(lost)
  })

  test('open-pin keeps its own copy of the ids', () => {
    const ids = ['e1']
    const next = bubbleAfter(closedBubble, { type: 'open-pin', screenId: element.screenId, ids, target: element })
    ids.push('e9')
    expect(next).toEqual({ kind: 'pin', screenId: element.screenId, ids: ['e1'], target: element })
  })

  test('close closes each bubble; a closed bubble stays the same value', () => {
    for (const state of open) expect(bubbleAfter(state, { type: 'close' })).toEqual(closedBubble)
    expect(bubbleAfter(closedBubble, { type: 'close' })).toBe(closedBubble)
  })

  test('a reload of the frame selects the same element again: the bubble stays open', () => {
    for (const state of open) expect(bubbleAfter(state, { type: 'selected', same: true })).toBe(state)
  })

  test('a different element, or no element, closes the bubble', () => {
    for (const state of open) expect(bubbleAfter(state, { type: 'selected', same: false })).toEqual(closedBubble)
    expect(bubbleAfter(closedBubble, { type: 'selected', same: false })).toBe(closedBubble)
  })

  test('the last comment of a pin goes (an undo, a discard, the request file): the bubble closes', () => {
    expect(bubbleAfter(pin, { type: 'comments', left: 0 })).toEqual(closedBubble)
    expect(bubbleAfter(lost, { type: 'comments', left: 0 })).toEqual(closedBubble)
  })

  test('a pin with comments left stays open', () => {
    expect(bubbleAfter(pin, { type: 'comments', left: 1 })).toBe(pin)
  })

  test('the count of comments does not close the bubble of a new comment', () => {
    expect(bubbleAfter(fresh, { type: 'comments', left: 0 })).toBe(fresh)
    expect(bubbleAfter(closedBubble, { type: 'comments', left: 0 })).toBe(closedBubble)
  })

  test('close closes each open bubble (also for a removed screen), and a closed one stays', () => {
    for (const state of open) expect(bubbleAfter(state, { type: 'close' })).toEqual(closedBubble)
    expect(bubbleAfter(closedBubble, { type: 'close' })).toBe(closedBubble)
  })
})

describe('bubbleAfter with the options panel', () => {
  test('open-options opens the options panel of an element or of the screen', () => {
    expect(bubbleAfter(closedBubble, { type: 'open-options', target: element })).toEqual(options)
    expect(bubbleAfter(closedBubble, { type: 'open-options', target: screen })).toEqual(screenOptions)
  })

  test('only one is open: the options panel replaces the bubble, and the bubble replaces the panel', () => {
    for (const state of [fresh, pin, lost]) {
      expect(bubbleAfter(state, { type: 'open-options', target: element })).toEqual(options)
    }
    expect(bubbleAfter(options, { type: 'open-new', target: element })).toEqual(fresh)
    expect(bubbleAfter(options, { type: 'open-pin', screenId: element.screenId, ids: ['e1', 'e2'], target: element })).toEqual(pin)
    expect(bubbleAfter(screenOptions, { type: 'open-options', target: element })).toEqual(options)
  })

  test('close closes the options panel', () => {
    expect(bubbleAfter(options, { type: 'close' })).toEqual(closedBubble)
    expect(bubbleAfter(screenOptions, { type: 'close' })).toEqual(closedBubble)
  })

  test('a different selection closes the options panel; the same element after a reload keeps it', () => {
    expect(bubbleAfter(options, { type: 'selected', same: false })).toEqual(closedBubble)
    expect(bubbleAfter(options, { type: 'selected', same: true })).toBe(options)
  })

  test('a change of the comments does not close the options panel', () => {
    expect(bubbleAfter(options, { type: 'comments', left: 0 })).toBe(options)
  })
})

describe('bubbleScreen', () => {
  test('the screen of an open bubble, null for a closed one', () => {
    expect(bubbleScreen(closedBubble)).toBeNull()
    expect(bubbleScreen(fresh)).toBe('onboarding/welcome')
    expect(bubbleScreen(lost)).toBe('onboarding/welcome')
    expect(bubbleScreen(screenOptions)).toBe('onboarding/welcome')
  })
})

describe('draftKey', () => {
  test('the same place gives the same key', () => {
    expect(draftKey({ ...element })).toBe(draftKey(element))
  })

  test('the screen and each element of it have different keys', () => {
    const keys = new Set([
      draftKey(element),
      draftKey(screen),
      draftKey({ screenId: element.screenId, loc: 'screens/onboarding/welcome.tsx:14:7' }),
      draftKey({ screenId: 'onboarding/workspace', loc: null }),
    ])
    expect(keys.size).toBe(4)
  })

  test('no join of a screen id and a place gives the key of a different pair', () => {
    expect(draftKey({ screenId: 'a', loc: 'b|c' })).not.toBe(draftKey({ screenId: 'a|b', loc: 'c' }))
    expect(draftKey({ screenId: 'a', loc: 'null' })).not.toBe(draftKey({ screenId: 'a', loc: null }))
  })
})

// A comment item at a line of the screen file of `element`, or on the screen.
function comment(id: string, line: number | null, stale = false): Item {
  const target: Target | null =
    line === null
      ? null
      : { file: 'screens/onboarding/welcome.tsx', line, column: 7, tag: 'Card', origin: 'library', element: 'div', copies: 1, label: '' }
  return { edit: { id, target, width: 1440, change: { kind: 'comment', text: `Task ${id}` } }, ...(stale ? { stale } : {}) }
}

describe('commentsOf', () => {
  const items: Item[] = [
    comment('e1', 12),
    comment('e2', null),
    comment('e3', 12, true),
    comment('e4', 14),
    { edit: { id: 'e5', target: comment('x', 12).edit.target, width: 1440, change: { kind: 'remove' } } },
  ]

  test('a new comment on an element lists the comments of its place that are not stale', () => {
    expect(commentsOf(fresh, items).map((item) => item.edit.id)).toEqual(['e1'])
  })

  test('a new comment on the screen lists the comments on the screen', () => {
    expect(commentsOf({ kind: 'new', target: screen }, items).map((item) => item.edit.id)).toEqual(['e2'])
  })

  test('a pin lists its comments that are still in the list, in the order of the list', () => {
    const partly: Bubble = { kind: 'pin', screenId: element.screenId, ids: ['e4', 'e9', 'e1'], target: element }
    expect(commentsOf(partly, items).map((item) => item.edit.id)).toEqual(['e1', 'e4'])
  })

  test('the lost pin lists its stale comments by id', () => {
    expect(commentsOf(lost, items).map((item) => item.edit.id)).toEqual(['e3'])
  })

  test('a detached bubble of a new comment lists none: a different element can be at its old place', () => {
    expect(commentsOf({ ...fresh, detached: true } as Bubble & { kind: 'new' }, items)).toEqual([])
    const detachedPin = { ...pin, detached: true } as Bubble & { kind: 'pin' }
    expect(commentsOf(detachedPin, items).map((item) => item.edit.id)).toEqual(['e1', 'e2'])
  })
})

describe('bubbleName', () => {
  test('the lost comments, the screen, then the tag of the site, of the first comment, or "Element"', () => {
    expect(bubbleName(lost, 'Card', [])).toBe('Not found in the code')
    expect(bubbleName({ kind: 'new', target: screen }, 'Card', [])).toBe('Screen')
    expect(bubbleName(fresh, 'Stack', [comment('e1', 12)])).toBe('Stack')
    expect(bubbleName(pin, null, [comment('e1', 12)])).toBe('Card')
    expect(bubbleName(fresh, null, [])).toBe('Element')
  })
})

describe('newBoxOf', () => {
  test('the lost pin has no box', () => {
    expect(newBoxOf(null, null, true)).toBeNull()
  })

  test('the screen always takes a comment, also with an open keep', () => {
    expect(newBoxOf(screen, 'blocked', false)).toBe('box')
  })

  test('an element: the block of an open keep first, then a lost site, else the box', () => {
    expect(newBoxOf(element, 'blocked', false)).toBe('blocked')
    expect(newBoxOf(element, null, false)).toBe('no-site')
    expect(newBoxOf(element, null, true)).toBe('box')
  })

  test('an element that is not found while its place has a draft keeps the draft, also with an open keep', () => {
    expect(newBoxOf(element, null, false, true)).toBe('draft')
    expect(newBoxOf(element, 'blocked', false, true)).toBe('draft')
    expect(newBoxOf(element, null, true, true)).toBe('box')
    expect(newBoxOf(screen, null, false, true)).toBe('box')
    expect(newBoxOf(null, null, false, true)).toBeNull()
  })
})

describe('bubbleAfter with a moved element', () => {
  const moved = { type: 'moved', screenId: element.screenId, from: element.loc!, to: 'screens/onboarding/welcome.tsx:15:7' } as const
  const there: BubbleTarget = { screenId: element.screenId, loc: moved.to }

  test('the bubble, the pin and the options panel of the place follow the element', () => {
    expect(bubbleAfter(fresh, moved)).toMatchObject({ kind: 'new', target: there })
    expect(bubbleAfter(pin, moved)).toMatchObject({ ...pin, target: there })
    expect(bubbleAfter(options, moved)).toMatchObject({ kind: 'options', target: there })
  })

  test('each keeps its key, thus the panel stays mounted with its text and focus', () => {
    for (const state of [fresh, pin, options] as Exclude<Bubble, { kind: 'closed' }>[]) {
      const next = bubbleAfter(state, moved) as Exclude<Bubble, { kind: 'closed' }>
      expect(bubblePlace(next)).toBe(bubblePlace(state))
      const again = bubbleAfter(next, { ...moved, from: moved.to, to: 'screens/onboarding/welcome.tsx:18:7' })
      expect(bubblePlace(again as Exclude<Bubble, { kind: 'closed' }>)).toBe(bubblePlace(state))
    }
  })

  test('an open event for the moved panel keeps its key; one for a different panel does not', () => {
    const movedPin = bubbleAfter(pin, moved) as Exclude<Bubble, { kind: 'closed' }>
    const added = bubbleAfter(movedPin, { type: 'open-pin', screenId: element.screenId, ids: ['e1', 'e2', 'e7'], target: there })
    expect(bubblePlace(added as Exclude<Bubble, { kind: 'closed' }>)).toBe(bubblePlace(pin))
    const other = bubbleAfter(movedPin, { type: 'open-new', target: there })
    expect(other).toEqual({ kind: 'new', target: there })
    const fromClosed = bubbleAfter(closedBubble, { type: 'open-pin', screenId: element.screenId, ids: ['e1'], target: there })
    expect(fromClosed).toEqual({ kind: 'pin', screenId: element.screenId, ids: ['e1'], target: there })
  })

  test('a different place, a different screen, the lost pin and a closed bubble stay', () => {
    for (const state of [closedBubble, lost, { kind: 'new', target: screen } as Bubble, screenOptions]) {
      expect(bubbleAfter(state, moved)).toBe(state)
    }
    expect(bubbleAfter(fresh, { ...moved, screenId: 'onboarding/workspace' })).toBe(fresh)
    expect(bubbleAfter(fresh, { ...moved, from: 'screens/onboarding/welcome.tsx:3:5' })).toBe(fresh)
  })
})

describe('bubbleAfter with a gone element', () => {
  const gone = { type: 'gone', screenId: element.screenId, loc: element.loc! } as const

  test('the bubble, the pin and the options panel of the place stay open, detached, with their key and place', () => {
    for (const state of [fresh, pin, options] as Exclude<Bubble, { kind: 'closed' }>[]) {
      const next = bubbleAfter(state, gone) as Exclude<Bubble, { kind: 'closed' }>
      expect(next).toMatchObject({ ...state, detached: true })
      expect(bubblePlace(next)).toBe(bubblePlace(state))
      expect(liveTarget(state)).toEqual(element)
      expect(liveTarget(next)).toBeNull()
      expect(bubbleAfter(next, gone)).toBe(next)
    }
  })

  test('a different place, a different screen, the lost pin and a closed bubble stay', () => {
    for (const state of [closedBubble, lost, { kind: 'new', target: screen } as Bubble, screenOptions]) {
      expect(bubbleAfter(state, gone)).toBe(state)
    }
    expect(bubbleAfter(fresh, { ...gone, screenId: 'onboarding/workspace' })).toBe(fresh)
    expect(bubbleAfter(fresh, { ...gone, loc: 'screens/onboarding/welcome.tsx:14:7' })).toBe(fresh)
  })

  test('a detached panel does not follow a move, and an open event of the user attaches a fresh one', () => {
    const detached = bubbleAfter(pin, gone)
    const moved = { type: 'moved', screenId: element.screenId, from: element.loc!, to: 'screens/onboarding/welcome.tsx:15:7' } as const
    expect(bubbleAfter(detached, moved)).toBe(detached)
    expect(bubbleAfter(detached, { type: 'open-pin', screenId: element.screenId, ids: ['e1', 'e2'], target: element })).toEqual(pin)
    expect(bubbleAfter(detached, { type: 'open-new', target: element })).toEqual(fresh)
    expect(bubbleAfter(detached, { type: 'selected', same: false })).toEqual(closedBubble)
  })
})

describe('bubbleAt', () => {
  test('is true for an open bubble or options panel of the place', () => {
    expect(bubbleAt(fresh, element)).toBe(true)
    expect(bubbleAt(pin, element)).toBe(true)
    expect(bubbleAt(options, element)).toBe(true)
    expect(bubbleAt(fresh, screen)).toBe(false)
    expect(bubbleAt(lost, element)).toBe(false)
    expect(bubbleAt(closedBubble, element)).toBe(false)
  })
})

describe('joinDrafts', () => {
  test('keeps the two texts, or the one that is not empty', () => {
    expect(joinDrafts('', 'Make this a table')).toBe('Make this a table')
    expect(joinDrafts('Shorter', '')).toBe('Shorter')
    expect(joinDrafts('Shorter', 'Make this a table')).toBe('Shorter\n\nMake this a table')
  })
})

describe('pinEvent', () => {
  const id = element.screenId

  test('the pin of an element takes new comments on that element', () => {
    expect(pinEvent(id, { key: element.loc!, ids: ['e1'] })).toEqual({ type: 'open-pin', screenId: id, ids: ['e1'], target: element })
  })

  test('the pin of the screen takes new comments on the screen', () => {
    expect(pinEvent(id, { key: screenPin, ids: ['e2'] })).toEqual({ type: 'open-pin', screenId: id, ids: ['e2'], target: screen })
  })

  test('the pin of the lost comments takes no new comment', () => {
    expect(pinEvent(id, { key: lostPin, ids: ['e3'] })).toEqual({ type: 'open-pin', screenId: id, ids: ['e3'], target: null })
  })
})

describe('afterAdd', () => {
  test('the bubble of a pin opens again with the new comment', () => {
    expect(afterAdd(pin, 'e7')).toEqual({ type: 'open-pin', screenId: element.screenId, ids: ['e1', 'e2', 'e7'], target: element })
  })

  test('the bubble of a new comment needs no event', () => {
    expect(afterAdd(fresh, 'e7')).toBeNull()
  })
})

describe('bubblePlace', () => {
  test('a pin that gets one more comment keeps its key', () => {
    expect(bubblePlace({ ...pin, ids: ['e1', 'e2', 'e7'] })).toBe(bubblePlace(pin))
  })

  test('each kind and each place have their own key', () => {
    const keys = new Set(open.map((state) => bubblePlace(state as Exclude<Bubble, { kind: 'closed' }>)))
    expect(keys.size).toBe(open.length)
  })
})
