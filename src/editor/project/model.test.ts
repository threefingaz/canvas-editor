import { describe, expect, test } from 'vitest'
import type { Issue } from '../../requests/format.ts'
import { projectRows, projectTotals, rowNote, totalsText, type ProjectScreen } from './model.ts'

const screen = (id: string, fields: Partial<ProjectScreen> = {}): ProjectScreen => ({
  id,
  flow: id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '',
  title: id,
  width: 1440,
  links: [],
  ...fields,
})

// The model only counts the issues, thus a test gives the fields that the
// count reads.
const deviation = { kind: 'override' } as unknown as Issue
const libraryDefault = { kind: 'no-token', set: 'library' } as unknown as Issue

const screens = [
  screen('onboarding/welcome', { links: ['onboarding/workspace', 'onboarding/none', 'onboarding/workspace'] }),
  screen('onboarding/welcome-mobile', { width: 390 }),
  screen('onboarding/welcome-option-1', { optionOf: 'onboarding/welcome' }),
  screen('onboarding/welcome-option-2', { optionOf: 'onboarding/welcome' }),
  screen('onboarding/workspace'),
  screen('onboarding/workspace-email-error', { stateOf: 'onboarding/workspace' }),
  screen('settings/plan', { error: 'meta has no title' }),
  screen('settings/team'),
]

const issues = {
  'onboarding/welcome': [deviation, deviation, libraryDefault],
  'onboarding/welcome-option-1': [deviation],
  'onboarding/workspace': [libraryDefault],
  'onboarding/workspace-email-error': [],
}

const edits = {
  'onboarding/welcome': [{}, {}],
  'onboarding/welcome-option-1': [{}],
  'onboarding/gone': [{}, {}, {}],
}

describe('projectRows', () => {
  const flows = projectRows(screens, issues, edits)

  test('the flows in the order of the list, each with its base screens and their states, and no row for an option', () => {
    expect(flows.map((flow) => flow.flow)).toEqual(['onboarding', 'settings'])
    expect(flows[0].groups.map((group) => [group.base.id, ...group.states.map((state) => state.id)])).toEqual([
      ['onboarding/welcome'],
      ['onboarding/welcome-mobile'],
      ['onboarding/workspace', 'onboarding/workspace-email-error'],
    ])
    expect(flows[0].groups[2].states[0].relation).toBe('state')
    expect(flows[0].groups[2].base.relation).toBe('base')
  })

  test('a row has the counts of its screen', () => {
    expect(flows[0].groups[0].base).toEqual({
      id: 'onboarding/welcome',
      title: 'onboarding/welcome',
      width: 1440,
      relation: 'base',
      options: 2,
      deviations: 2,
      changes: 2,
      linksOut: 1,
      unreached: false,
      brokenLinks: 1,
      error: null,
    })
  })

  test('the deviations are null while the issues are not read, and 0 with only defaults of the library', () => {
    expect(flows[0].groups[1].base.deviations).toBeNull()
    expect(flows[0].groups[2].base.deviations).toBe(0)
    expect(flows[0].groups[2].states[0].deviations).toBe(0)
  })

  test('a screen that no link reaches is marked only when its flow has more than one at its width, and a broken file is no start', () => {
    // `welcome` starts the flow at 1440 and `welcome-mobile` at 390.
    expect(flows[0].groups[0].base.unreached).toBe(false)
    expect(flows[0].groups[1].base.unreached).toBe(false)
    expect(flows[1].groups.map((group) => group.base.unreached)).toEqual([false, false])
  })

  test('a row has the error of its file', () => {
    expect(flows[1].groups[0].base.error).toBe('meta has no title')
    expect(flows[1].groups[1].base.error).toBeNull()
  })

  test('the screens directly in the folder are a flow with the empty name', () => {
    expect(projectRows([screen('home')], {}, {})[0].flow).toBe('')
  })

  test('a screen whose id is the name of a property of each object has no issues and no changes yet', () => {
    const base = projectRows([screen('constructor')], {}, {})[0].groups[0].base
    expect(base.deviations).toBeNull()
    expect(base.changes).toBe(0)
    expect(projectTotals([screen('toString')], {}, {})).toMatchObject({ screens: 1, changes: 0, unread: 1 })
  })
})

describe('projectTotals', () => {
  test('counts the screens that are not options, and the changes of each screen of the list', () => {
    expect(projectTotals(screens, issues, edits)).toEqual({
      screens: 6,
      flows: 2,
      deviations: 2,
      deviating: 1,
      changes: 3,
      // `welcome-mobile` and `settings/team`; the file with an error is never read.
      unread: 2,
    })
  })

  test('an empty list', () => {
    expect(projectTotals([], {}, {})).toEqual({ screens: 0, flows: 0, deviations: 0, deviating: 0, changes: 0, unread: 0 })
  })
})

describe('totalsText', () => {
  const totals = { screens: 4, flows: 1, deviations: 15, deviating: 1, changes: 12, unread: 0 }

  test('the totals in words', () => {
    expect(totalsText(totals)).toEqual(['4 screens in 1 flow', '15 deviations in 1 screen', '12 changes'])
  })

  test('no deviation, no change, one of each, and the screens that are not read', () => {
    expect(totalsText({ ...totals, deviations: 0, deviating: 0, changes: 0 })).toEqual(['4 screens in 1 flow', 'No deviation'])
    expect(totalsText({ screens: 1, flows: 1, deviations: 1, deviating: 1, changes: 1, unread: 1 })).toEqual([
      '1 screen in 1 flow',
      '1 deviation in 1 screen',
      '1 change',
      '1 screen not read yet',
    ])
    expect(totalsText({ ...totals, screens: 0 })).toEqual(['No screen'])
  })
})

describe('rowNote', () => {
  const row = projectRows([screen('a/one')], {}, {})[0].groups[0].base

  test('null for a row with nothing to say', () => {
    expect(rowNote(row)).toBeNull()
  })

  test('a screen that no link reaches, broken links, and an error of the file first', () => {
    expect(rowNote({ ...row, unreached: true })).toBe('no link leads here')
    expect(rowNote({ ...row, unreached: true, brokenLinks: 2 })).toBe('no link leads here · 2 broken links')
    expect(rowNote({ ...row, brokenLinks: 1, error: 'bad' })).toBe('the file has an error')
  })
})
