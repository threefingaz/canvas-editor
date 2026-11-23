import { describe, expect, test } from 'vitest'
import { flowErrors, flowOrders, flowSequence, movedOrder, orderScreens, parseFlow, type OrderedScreen } from './flow.ts'

describe('parseFlow', () => {
  test('reads the names of `order`', () => {
    expect(parseFlow('{ "order": ["welcome", "workspace"] }')).toEqual({ order: ['welcome', 'workspace'] })
  })

  test('leaves other keys alone', () => {
    expect(parseFlow('{ "order": [], "note": "x" }')).toEqual({ order: [] })
  })

  test('gives an error and no names for a file that is not valid', () => {
    for (const text of ['{', '[]', 'null', '{}', '{ "order": "a" }', '{ "order": [1] }', '{ "order": [""] }', '{ "order": ["a/b"] }', '{ "order": ["a", "a"] }']) {
      const result = parseFlow(text)
      expect(result.order).toEqual([])
      expect(result.error).toBeTypeOf('string')
    }
  })
})

describe('flowOrders and flowErrors', () => {
  const files = [
    { flow: 'a', file: 'screens/a/flow.json', text: '{ "order": ["two"] }' },
    { flow: 'b', file: 'screens/b/flow.json', text: 'no json' },
  ]

  test('give the orders of the valid files and the errors of the others', () => {
    expect(flowOrders(files)).toEqual(new Map([['a', ['two']]]))
    expect(flowErrors(files)).toEqual([{ flow: 'b', file: 'screens/b/flow.json', error: expect.stringMatching(/^not valid JSON/) }])
  })
})

describe('flowSequence', () => {
  test('gives the named names first, then the others by name, and drops a name that no screen has', () => {
    expect(flowSequence(['c', 'gone', 'a'], ['a', 'b', 'c', 'd'])).toEqual(['c', 'a', 'b', 'd'])
  })
})

function entry(id: string, more: Partial<OrderedScreen> = {}): OrderedScreen {
  const slash = id.lastIndexOf('/')
  return { id, flow: slash === -1 ? '' : id.slice(0, slash), name: id.slice(slash + 1), ...more }
}

const ids = (list: readonly OrderedScreen[]) => list.map((screen) => screen.id)

describe('orderScreens', () => {
  test('with no file: by flow, then by name', () => {
    const list = [entry('onboarding/welcome'), entry('home'), entry('account/profile'), entry('onboarding/start')]
    expect(ids(orderScreens(list, new Map()))).toEqual(['home', 'account/profile', 'onboarding/start', 'onboarding/welcome'])
  })

  test('does not change the list that is given', () => {
    const list = [entry('b/x'), entry('a/y')]
    orderScreens(list, new Map())
    expect(ids(list)).toEqual(['b/x', 'a/y'])
  })

  test('puts the named base screens first, then the others by name; a name that no screen has does nothing', () => {
    const list = [entry('a/one'), entry('a/two'), entry('a/three'), entry('a/four')]
    expect(ids(orderScreens(list, new Map([['a', ['three', 'gone', 'one']]])))).toEqual(['a/three', 'a/one', 'a/four', 'a/two'])
  })

  test('keeps a state and an option, also an option of a state, with their base', () => {
    const list = [
      entry('a/alpha'),
      entry('a/beta'),
      entry('a/beta-error', { stateOf: 'a/beta' }),
      entry('a/beta-error-option-1', { optionOf: 'a/beta-error' }),
      entry('a/beta-option-1', { optionOf: 'a/beta' }),
    ]
    expect(ids(orderScreens(list, new Map([['a', ['beta', 'alpha']]])))).toEqual([
      'a/beta',
      'a/beta-error',
      'a/beta-error-option-1',
      'a/beta-option-1',
      'a/alpha',
    ])
  })

  test('a name of a state in the list does not move the state from its base', () => {
    const list = [entry('a/alpha'), entry('a/beta'), entry('a/beta-error', { stateOf: 'a/beta' })]
    expect(ids(orderScreens(list, new Map([['a', ['beta-error', 'alpha']]])))).toEqual(['a/alpha', 'a/beta', 'a/beta-error'])
  })

  test('two widths of one screen are two base screens', () => {
    const list = [entry('a/welcome'), entry('a/welcome-mobile'), entry('a/workspace')]
    expect(ids(orderScreens(list, new Map([['a', ['workspace', 'welcome-mobile', 'welcome']]])))).toEqual([
      'a/workspace',
      'a/welcome-mobile',
      'a/welcome',
    ])
    // A width that the list does not name comes after the named screens.
    expect(ids(orderScreens(list, new Map([['a', ['workspace', 'welcome']]])))).toEqual(['a/workspace', 'a/welcome', 'a/welcome-mobile'])
  })

  test('a relation to a screen that is not in the flow gives a group of its own', () => {
    const list = [entry('a/one'), entry('a/two', { stateOf: 'b/one' }), entry('b/one')]
    expect(ids(orderScreens(list, new Map([['a', ['two', 'one']]])))).toEqual(['a/two', 'a/one', 'b/one'])
  })

  test('sorts each flow by its own order', () => {
    const list = [entry('a/x'), entry('a/y'), entry('b/x'), entry('b/y')]
    expect(ids(orderScreens(list, new Map([['b', ['y']]])))).toEqual(['a/x', 'a/y', 'b/y', 'b/x'])
  })
})

describe('movedOrder', () => {
  test('moves a name to a position of the shown sequence', () => {
    expect(movedOrder([], ['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
    expect(movedOrder(['c', 'a'], ['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'c', 'b'])
  })

  test('keeps the position in the range', () => {
    expect(movedOrder([], ['a', 'b', 'c'], 'a', 9)).toEqual(['b', 'c', 'a'])
    expect(movedOrder([], ['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
  })

  test('drops a name that no screen has; an unknown name changes nothing', () => {
    expect(movedOrder(['gone', 'b'], ['a', 'b'], 'x', 0)).toEqual(['b', 'a'])
  })
})
