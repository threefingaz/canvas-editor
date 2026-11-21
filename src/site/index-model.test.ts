import { describe, expect, test } from 'vitest'
import { flowGroups, flowTitle, noFlowTitle } from './index-model.ts'
import { screenEntry } from './screen-fixtures.ts'

const ids = (groups: ReturnType<typeof flowGroups>) => groups.map((group) => [group.flow, group.screens.map((screen) => screen.id)])

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
    expect(flowGroups(screens)[0].screens[0]).toBe(screens[0])
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
