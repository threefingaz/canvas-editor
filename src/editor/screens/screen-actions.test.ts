import { describe, expect, test } from 'vitest'
import {
  deleteSummary,
  flowsOf,
  menuItems,
  moveAction,
  renamePreview,
  rowPlace,
  titleProblem,
  viewAfter,
  type ActionScreen,
} from './screen-actions.ts'

const screen = (id: string, fields: Partial<ActionScreen> = {}): ActionScreen => {
  const slash = id.lastIndexOf('/')
  return { id, flow: slash === -1 ? '' : id.slice(0, slash), name: id.slice(slash + 1), title: id, links: [], ...fields }
}

// The list in the sequence of the canvas: a state and an option after their
// base.
const list: ActionScreen[] = [
  screen('onboarding/welcome', { links: ['onboarding/workspace'] }),
  screen('onboarding/welcome-option-1', { optionOf: 'onboarding/welcome', links: ['onboarding/workspace'] }),
  screen('onboarding/welcome-mobile'),
  screen('onboarding/workspace'),
  screen('onboarding/workspace-email-error', { stateOf: 'onboarding/workspace', links: ['onboarding/workspace'] }),
  screen('onboarding/workspace-option-1', { optionOf: 'onboarding/workspace' }),
  screen('onboarding/workspace-email-error-option-1', { optionOf: 'onboarding/workspace-email-error' }),
  screen('onboarding/done', { links: ['onboarding/workspace-email-error'] }),
  screen('billing/plans', { error: 'Unexpected token' }),
]

const labels = (items: ReturnType<typeof menuItems>) => items.map((item) => [item.action, item.off])

describe('rowPlace', () => {
  test('counts the base screens of the row at each width, in the sequence of the list', () => {
    expect(rowPlace(list, 'onboarding/welcome')).toEqual({ index: 0, count: 4 })
    expect(rowPlace(list, 'onboarding/workspace')).toEqual({ index: 2, count: 4 })
    expect(rowPlace(list, 'onboarding/done')).toEqual({ index: 3, count: 4 })
    expect(rowPlace(list, 'billing/plans')).toEqual({ index: 0, count: 1 })
  })

  test('a state, an option and an unknown id have no place', () => {
    expect(rowPlace(list, 'onboarding/workspace-email-error')).toBeNull()
    expect(rowPlace(list, 'onboarding/welcome-option-1')).toBeNull()
    expect(rowPlace(list, 'onboarding/nothing')).toBeNull()
  })
})

describe('menuItems', () => {
  test('a base screen has each action; a move at the end of the row is off', () => {
    expect(labels(menuItems(list, 'onboarding/welcome'))).toEqual([
      ['rename', null],
      ['title', null],
      ['flow', null],
      ['left', 'The screen is the first of its row'],
      ['right', null],
      ['delete', null],
    ])
    expect(menuItems(list, 'onboarding/done').find((item) => item.action === 'right')?.off).toBe('The screen is the last of its row')
    expect(menuItems(list, 'onboarding/welcome').map((item) => item.label)).toEqual([
      'Rename…',
      'Change the title…',
      'Move to flow…',
      'Move left',
      'Move right',
      'Delete…',
    ])
  })

  test('a state and an option have no move in the row and stay in their flow', () => {
    for (const id of ['onboarding/workspace-email-error', 'onboarding/workspace-option-1']) {
      expect(labels(menuItems(list, id))).toEqual([
        ['rename', null],
        ['title', null],
        ['flow', 'A state or an option stays in the flow of its base'],
        ['delete', null],
      ])
    }
  })

  test('a file with an error can only be deleted', () => {
    const items = menuItems(list, 'billing/plans')
    expect(items.filter((item) => item.off === null).map((item) => item.action)).toEqual(['delete'])
    expect(items.find((item) => item.action === 'rename')?.off).toBe('The screen file has an error: fix it first')
  })

  test('an unknown screen has no menu', () => {
    expect(menuItems(list, 'onboarding/nothing')).toEqual([])
  })
})

describe('moveAction', () => {
  test('gives the next position in the row', () => {
    expect(moveAction(list, 'onboarding/workspace', -1)).toEqual({ action: 'reorder', screen: 'onboarding/workspace', to: 1 })
    expect(moveAction(list, 'onboarding/workspace', 1)).toEqual({ action: 'reorder', screen: 'onboarding/workspace', to: 3 })
  })

  test('none at the end of the row, and none for a state', () => {
    expect(moveAction(list, 'onboarding/welcome', -1)).toBeNull()
    expect(moveAction(list, 'onboarding/done', 1)).toBeNull()
    expect(moveAction(list, 'onboarding/workspace-email-error', 1)).toBeNull()
  })
})

describe('renamePreview', () => {
  test('the states and the options follow the new name', () => {
    expect(renamePreview(list, 'onboarding/workspace', { flow: 'onboarding', name: 'team' })).toEqual({
      id: 'onboarding/team',
      changes: [
        { from: 'onboarding/workspace', to: 'onboarding/team' },
        { from: 'onboarding/workspace-email-error', to: 'onboarding/team-email-error' },
        { from: 'onboarding/workspace-option-1', to: 'onboarding/team-option-1' },
        { from: 'onboarding/workspace-email-error-option-1', to: 'onboarding/team-email-error-option-1' },
      ],
      problem: null,
    })
  })

  test('a move to a different flow takes the group with it', () => {
    const preview = renamePreview(list, 'onboarding/welcome', { flow: 'start', name: 'welcome' })
    expect(preview.id).toBe('start/welcome')
    expect(preview.changes).toEqual([
      { from: 'onboarding/welcome', to: 'start/welcome' },
      { from: 'onboarding/welcome-option-1', to: 'start/welcome-option-1' },
    ])
    expect(preview.problem).toBeNull()
  })

  test('refuses an id that exists, also for a member', () => {
    expect(renamePreview(list, 'onboarding/welcome', { flow: 'onboarding', name: 'done' }).problem).toBe(
      "A screen with the id 'onboarding/done' exists",
    )
    const withTaken = [...list, screen('onboarding/team-option-1')]
    expect(renamePreview(withTaken, 'onboarding/workspace', { flow: 'onboarding', name: 'team' }).problem).toBe(
      "A screen with the id 'onboarding/team-option-1' exists",
    )
  })

  test('refuses a name or a flow that is not valid, the same id, and a state in a different flow', () => {
    expect(renamePreview(list, 'onboarding/welcome', { flow: 'onboarding', name: '' }).problem).toBe('The name is empty')
    expect(renamePreview(list, 'onboarding/welcome', { flow: 'onboarding', name: 'a b' }).problem).toMatch(/is not a valid name/)
    expect(renamePreview(list, 'onboarding/welcome', { flow: 'a//b', name: 'welcome' }).problem).toMatch(/is not a valid flow/)
    expect(renamePreview(list, 'onboarding/welcome', { flow: 'onboarding', name: 'welcome' }).problem).toBe(
      'This is the id of the screen now',
    )
    expect(renamePreview(list, 'onboarding/workspace-email-error', { flow: 'other', name: 'x' }).problem).toBe(
      'A state or an option stays in the flow of its base',
    )
  })

  test('a screen in the screens folder itself', () => {
    expect(renamePreview(list, 'onboarding/done', { flow: '', name: 'done' })).toMatchObject({ id: 'done', problem: null })
  })
})

describe('deleteSummary', () => {
  test('names the states and the options that go with the screen, and the screens that link to them', () => {
    const summary = deleteSummary(list, 'onboarding/workspace')
    expect(summary.members.map((item) => item.id)).toEqual([
      'onboarding/workspace-email-error',
      'onboarding/workspace-option-1',
      'onboarding/workspace-email-error-option-1',
    ])
    // The state links to its base, but goes with it.
    expect(summary.linkedBy.map((item) => item.id)).toEqual(['onboarding/welcome', 'onboarding/welcome-option-1', 'onboarding/done'])
  })

  test('a screen with no group and no link', () => {
    expect(deleteSummary(list, 'onboarding/welcome-mobile')).toEqual({ members: [], linkedBy: [] })
  })
})

describe('titleProblem', () => {
  test('refuses an empty title and the same title', () => {
    expect(titleProblem('  ', 'Welcome')).toBe('The title is empty')
    expect(titleProblem('Welcome', 'Welcome')).toBe('This is the title of the screen now')
    expect(titleProblem('Hello "you"', 'Welcome')).toBeNull()
  })
})

describe('flowsOf', () => {
  test('each flow one time, in the sequence of the list', () => {
    expect(flowsOf(list)).toEqual(['onboarding', 'billing'])
  })
})

describe('viewAfter', () => {
  const changes = [
    { from: 'a/one', to: 'a/two' },
    { from: 'a/gone', to: null },
    { from: null, to: 'a/back' },
  ]

  test('the listed screen follows its new id, or clears when it was deleted', () => {
    expect(viewAfter(changes, { listed: 'a/one', selected: null, bubble: null }).listed).toBe('a/two')
    expect(viewAfter(changes, { listed: 'a/gone', selected: null, bubble: null }).listed).toBeNull()
    expect(viewAfter(changes, { listed: 'a/other', selected: null, bubble: null }).listed).toBe('a/other')
    expect(viewAfter(changes, { listed: null, selected: null, bubble: null }).listed).toBeNull()
  })

  test('the selection and the bubble of a moved or deleted screen clear', () => {
    expect(viewAfter(changes, { listed: null, selected: 'a/one', bubble: 'a/gone' })).toEqual({
      listed: null,
      clearSelection: true,
      closeBubble: true,
    })
    expect(viewAfter(changes, { listed: null, selected: 'a/other', bubble: 'a/other' })).toEqual({
      listed: null,
      clearSelection: false,
      closeBubble: false,
    })
  })
})
