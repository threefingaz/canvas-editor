import { describe, expect, test } from 'vitest'
import { groupMembers, optionTotals, optionsOf, relationOf, screenGroups, type RelatedScreen, type ScreenGroup } from './groups.ts'

// A plain screen: the flow is the path before the last `/`.
function screen(id: string, relation: { stateOf?: string; optionOf?: string } = {}): RelatedScreen {
  const slash = id.lastIndexOf('/')
  return { id, flow: slash === -1 ? '' : id.slice(0, slash), ...relation }
}

// The ids of each group: the base with its options, then each state with its options.
function shape(groups: ScreenGroup[]) {
  return groups.map((group) => ({
    base: [group.base.screen.id, group.base.options.map((option) => option.id)],
    states: group.states.map((state) => [state.screen.id, state.options.map((option) => option.id)]),
  }))
}

describe('relationOf', () => {
  test('gives base, state or option', () => {
    expect(relationOf(screen('a/welcome'))).toBe('base')
    expect(relationOf(screen('a/error', { stateOf: 'a/welcome' }))).toBe('state')
    expect(relationOf(screen('a/welcome-option-1', { optionOf: 'a/welcome' }))).toBe('option')
  })
})

describe('optionsOf', () => {
  test('gives the options of one screen in the order of the list', () => {
    const screens = [
      screen('a/welcome'),
      screen('a/welcome-option-2', { optionOf: 'a/welcome' }),
      screen('a/error', { stateOf: 'a/welcome' }),
      screen('a/error-option-1', { optionOf: 'a/error' }),
      screen('a/welcome-option-1', { optionOf: 'a/welcome' }),
    ]
    expect(optionsOf(screens, 'a/welcome').map((s) => s.id)).toEqual(['a/welcome-option-2', 'a/welcome-option-1'])
    expect(optionsOf(screens, 'a/error').map((s) => s.id)).toEqual(['a/error-option-1'])
    expect(optionsOf(screens, 'a/workspace')).toEqual([])
  })
})

describe('groupMembers', () => {
  test('gives the states, then the options of the screen and of its states', () => {
    const list: RelatedScreen[] = [
      { id: 'a', flow: 'f' },
      { id: 'a-option-1', flow: 'f', optionOf: 'a' },
      { id: 'a-error', flow: 'f', stateOf: 'a' },
      { id: 'a-error-option-1', flow: 'f', optionOf: 'a-error' },
      { id: 'b', flow: 'f' },
      { id: 'b-option-1', flow: 'f', optionOf: 'b' },
    ]
    expect(groupMembers(list, 'a').map((screen) => screen.id)).toEqual(['a-error', 'a-option-1', 'a-error-option-1'])
    expect(groupMembers(list, 'a-option-1')).toEqual([])
  })
})

describe('optionTotals', () => {
  test('gives the count of the options of each screen that has options', () => {
    const screens = [
      screen('a/welcome'),
      screen('a/welcome-option-2', { optionOf: 'a/welcome' }),
      screen('a/error', { stateOf: 'a/welcome' }),
      screen('a/error-option-1', { optionOf: 'a/error' }),
      screen('a/welcome-option-1', { optionOf: 'a/welcome' }),
    ]
    expect(optionTotals(screens)).toEqual(
      new Map([
        ['a/welcome', 2],
        ['a/error', 1],
      ]),
    )
    expect(optionTotals([screen('a/welcome')])).toEqual(new Map())
  })
})

describe('screenGroups', () => {
  test('gives no group for an empty list', () => {
    expect(screenGroups([])).toEqual([])
  })

  test('a list with no relation gives one group for each screen, in the order of the list', () => {
    const screens = [screen('a/welcome'), screen('a/welcome-mobile'), screen('a/workspace')]
    expect(shape(screenGroups(screens))).toEqual([
      { base: ['a/welcome', []], states: [] },
      { base: ['a/welcome-mobile', []], states: [] },
      { base: ['a/workspace', []], states: [] },
    ])
  })

  test('gives the screens of the list as they are', () => {
    const welcome = screen('a/welcome')
    const [group] = screenGroups([welcome])
    expect(group.base.screen).toBe(welcome)
  })

  test('a base with states, in the order of the list', () => {
    const screens = [
      screen('a/done', { stateOf: 'a/welcome' }),
      screen('a/welcome'),
      screen('a/error', { stateOf: 'a/welcome' }),
      screen('a/workspace'),
      screen('a/wait', { stateOf: 'a/welcome' }),
    ]
    expect(shape(screenGroups(screens))).toEqual([
      { base: ['a/welcome', []], states: [['a/done', []], ['a/error', []], ['a/wait', []]] },
      { base: ['a/workspace', []], states: [] },
    ])
  })

  test('the options of a base and of a state', () => {
    const screens = [
      screen('a/error', { stateOf: 'a/welcome' }),
      screen('a/error-option-1', { optionOf: 'a/error' }),
      screen('a/welcome'),
      screen('a/welcome-option-2', { optionOf: 'a/welcome' }),
      screen('a/welcome-option-1', { optionOf: 'a/welcome' }),
    ]
    expect(shape(screenGroups(screens))).toEqual([
      { base: ['a/welcome', ['a/welcome-option-2', 'a/welcome-option-1']], states: [['a/error', ['a/error-option-1']]] },
    ])
  })

  test('two flows give their own groups', () => {
    const screens = [
      screen('billing/plan'),
      screen('billing/plan-error', { stateOf: 'billing/plan' }),
      screen('onboarding/welcome'),
      screen('onboarding/welcome-option-1', { optionOf: 'onboarding/welcome' }),
    ]
    expect(shape(screenGroups(screens))).toEqual([
      { base: ['billing/plan', []], states: [['billing/plan-error', []]] },
      { base: ['onboarding/welcome', ['onboarding/welcome-option-1']], states: [] },
    ])
  })

  test('an option whose base is not in the list is a group of its own, at its place', () => {
    const screens = [screen('a/lost-option-1', { optionOf: 'a/lost' }), screen('a/welcome')]
    expect(shape(screenGroups(screens))).toEqual([
      { base: ['a/lost-option-1', []], states: [] },
      { base: ['a/welcome', []], states: [] },
    ])
  })

  test('a state whose base is not in the list is a group of its own, and keeps its options', () => {
    const screens = [screen('a/error', { stateOf: 'a/lost' }), screen('a/error-option-1', { optionOf: 'a/error' })]
    expect(shape(screenGroups(screens))).toEqual([{ base: ['a/error', ['a/error-option-1']], states: [] }])
  })

  test('a relation that breaks the rules of the list is a group of its own', () => {
    const screens = [
      screen('a/welcome'),
      screen('a/error', { stateOf: 'a/welcome' }),
      screen('a/error-detail', { stateOf: 'a/error' }),
      screen('a/welcome-option-1', { optionOf: 'a/welcome' }),
      screen('a/welcome-option-1-option-1', { optionOf: 'a/welcome-option-1' }),
      screen('a/self', { stateOf: 'a/self' }),
      screen('b/other', { stateOf: 'a/welcome' }),
    ]
    expect(shape(screenGroups(screens))).toEqual([
      { base: ['a/welcome', ['a/welcome-option-1']], states: [['a/error', []]] },
      { base: ['a/error-detail', []], states: [] },
      { base: ['a/welcome-option-1-option-1', []], states: [] },
      { base: ['a/self', []], states: [] },
      { base: ['b/other', []], states: [] },
    ])
  })

  test('each screen of the list has one place', () => {
    const screens = [
      screen('a/welcome'),
      screen('a/error', { stateOf: 'a/welcome' }),
      screen('a/error-option-1', { optionOf: 'a/error' }),
      screen('a/lost-option-1', { optionOf: 'a/lost' }),
    ]
    const places = screenGroups(screens).flatMap((group) =>
      [group.base, ...group.states].flatMap((related) => [related.screen, ...related.options]),
    )
    expect(places.map((s) => s.id).sort()).toEqual(screens.map((s) => s.id).sort())
  })
})
