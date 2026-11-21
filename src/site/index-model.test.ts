import { describe, expect, test } from 'vitest'
import { flowGroups, flowTitle, noFlowTitle } from './index-model.ts'
import { screenEntry } from './screen-fixtures.ts'

import type { ScreenEntry } from 'virtual:canvas-screens'

// The ids of the bases of each flow; the states of a base are not in it.
const ids = (flows: ReturnType<typeof flowGroups>) => flows.map((flow) => [flow.flow, flow.groups.map((group) => group.base.id)])

const related = (id: string, fields: Partial<ScreenEntry>): ScreenEntry => ({ ...screenEntry(id), ...fields })

describe('flowGroups', () => {
  test('gives no group for an empty list', () => {
    expect(flowGroups([])).toEqual([])
  })

  test('gives one group for one flow, in the order of the list', () => {
    const screens = [screenEntry('onboarding/welcome'), screenEntry('onboarding/welcome-mobile'), screenEntry('onboarding/workspace')]
    expect(ids(flowGroups(screens))).toEqual([['onboarding', ['onboarding/welcome', 'onboarding/welcome-mobile', 'onboarding/workspace']]])
  })

  test('gives one group for each flow, in the order of the list', () => {
    const screens = [screenEntry('billing/plan'), screenEntry('billing/review'), screenEntry('onboarding/welcome')]
    expect(ids(flowGroups(screens))).toEqual([
      ['billing', ['billing/plan', 'billing/review']],
      ['onboarding', ['onboarding/welcome']],
    ])
  })

  test('a flow in a sub folder is a group of its own', () => {
    const screens = [screenEntry('onboarding/welcome'), screenEntry('onboarding/forms/name'), screenEntry('onboarding/forms/team')]
    expect(ids(flowGroups(screens))).toEqual([
      ['onboarding', ['onboarding/welcome']],
      ['onboarding/forms', ['onboarding/forms/name', 'onboarding/forms/team']],
    ])
  })

  test('keeps the sequence of the sorted list: the screens with no flow come first', () => {
    const screens = [screenEntry('home'), screenEntry('settings'), screenEntry('a-flow/one'), screenEntry('b-flow/one')]
    expect(flowGroups(screens).map((group) => group.flow)).toEqual(['', 'a-flow', 'b-flow'])
  })

  test('keeps the entries of the list', () => {
    const screens = [screenEntry('home')]
    expect(flowGroups(screens)[0].groups[0].base).toBe(screens[0])
  })

  test('a screen with no relation is a group with no state', () => {
    expect(flowGroups([screenEntry('home')])[0].groups).toEqual([{ base: screenEntry('home'), states: [] }])
  })

  test('puts the states of a base below it, in the order of the list', () => {
    const screens = [
      screenEntry('onboarding/welcome'),
      related('onboarding/welcome-done', { stateOf: 'onboarding/welcome' }),
      related('onboarding/welcome-error', { stateOf: 'onboarding/welcome' }),
      screenEntry('onboarding/workspace'),
      related('onboarding/workspace-error', { stateOf: 'onboarding/workspace' }),
    ]
    const groups = flowGroups(screens)[0].groups
    expect(groups.map((group) => [group.base.id, group.states.map((state) => state.id)])).toEqual([
      ['onboarding/welcome', ['onboarding/welcome-done', 'onboarding/welcome-error']],
      ['onboarding/workspace', ['onboarding/workspace-error']],
    ])
  })

  test('leaves out the options of a base and of a state', () => {
    const screens = [
      screenEntry('onboarding/welcome'),
      related('onboarding/welcome-error', { stateOf: 'onboarding/welcome' }),
      related('onboarding/welcome-error-option-1', { optionOf: 'onboarding/welcome-error' }),
      related('onboarding/welcome-option-1', { optionOf: 'onboarding/welcome' }),
      related('onboarding/welcome-option-2', { optionOf: 'onboarding/welcome' }),
    ]
    const flows = flowGroups(screens)
    expect(flows[0].groups.map((group) => [group.base.id, group.states.map((state) => state.id)])).toEqual([
      ['onboarding/welcome', ['onboarding/welcome-error']],
    ])
  })

  test('leaves out an option whose base is not in the list', () => {
    const screens = [screenEntry('onboarding/welcome'), related('onboarding/gone-option-1', { optionOf: 'onboarding/gone' })]
    expect(ids(flowGroups(screens))).toEqual([['onboarding', ['onboarding/welcome']]])
  })

  test('leaves out a flow with only options', () => {
    const screens = [screenEntry('billing/plan'), related('onboarding/x-option-1', { optionOf: 'billing/plan' })]
    expect(ids(flowGroups(screens))).toEqual([['billing', ['billing/plan']]])
  })
})

describe('flowTitle', () => {
  test('writes the folder name as a heading', () => {
    expect(flowTitle('onboarding')).toBe('Onboarding')
    expect(flowTitle('test-loop')).toBe('Test loop')
    expect(flowTitle('team_settings')).toBe('Team settings')
  })

  test('writes each part of a sub folder', () => {
    expect(flowTitle('onboarding/forms')).toBe('Onboarding / Forms')
  })

  test('gives a text for the screens with no flow', () => {
    expect(flowTitle('')).toBe(noFlowTitle)
  })
})
