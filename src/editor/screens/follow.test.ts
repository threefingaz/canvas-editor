import { describe, expect, test, vi } from 'vitest'
import type { ScreenAction } from '../../requests/api.ts'
import type { Edit } from '../../requests/format.ts'
import { createBubbleStore } from '../comments/bubble-store.ts'
import { draftKey } from '../comments/bubble.ts'
import { createEditsStore } from '../edits/store.ts'
import { createIssuesStore } from '../issues/store.ts'
import type { EditorSync, SaveState } from '../requests/sync.ts'
import type { ActionResult } from './client.ts'
import { carriedEdits, followAction, idChanges, movedScreens, runAction, saveBlock, type RunDeps } from './follow.ts'

const list = [
  { id: 'onboarding/welcome', flow: 'onboarding' },
  { id: 'onboarding/workspace', flow: 'onboarding' },
  { id: 'onboarding/workspace-error', flow: 'onboarding', stateOf: 'onboarding/workspace' },
  { id: 'onboarding/workspace-option-1', flow: 'onboarding', optionOf: 'onboarding/workspace' },
  { id: 'onboarding/workspace-error-option-1', flow: 'onboarding', optionOf: 'onboarding/workspace-error' },
  { id: 'onboarding/welcome-option-1', flow: 'onboarding', optionOf: 'onboarding/welcome' },
]

const comment = (id: string): Edit => ({ id, target: null, width: 1440, change: { kind: 'comment', text: 'Add a state' } })

describe('idChanges', () => {
  test('drops each old id and loads each new id', () => {
    expect(
      idChanges([
        { from: 'a/b', to: 'a/c' },
        { from: 'a/b-error', to: 'a/c-error' },
      ]),
    ).toEqual({ drop: ['a/b', 'a/b-error'], load: ['a/c', 'a/c-error'] })
    expect(idChanges([{ from: 'a/b', to: null }])).toEqual({ drop: ['a/b'], load: [] })
    expect(idChanges([{ from: null, to: 'a/b' }])).toEqual({ drop: [], load: ['a/b'] })
    expect(idChanges([])).toEqual({ drop: [], load: [] })
  })
})

describe('movedScreens', () => {
  test('a rename and a delete move the screen, its states and the options of these', () => {
    const ids = ['onboarding/workspace', 'onboarding/workspace-error', 'onboarding/workspace-option-1', 'onboarding/workspace-error-option-1']
    expect(movedScreens(list, { action: 'delete', screen: 'onboarding/workspace' })).toEqual(ids)
    expect(movedScreens(list, { action: 'rename', screen: 'onboarding/workspace', flow: 'onboarding', name: 'team' })).toEqual(ids)
    expect(movedScreens(list, { action: 'delete', screen: 'onboarding/workspace-option-1' })).toEqual(['onboarding/workspace-option-1'])
  })

  test('a move in the row, a new title and a restore move no request file', () => {
    expect(movedScreens(list, { action: 'reorder', screen: 'onboarding/workspace', to: 0 })).toEqual([])
    expect(movedScreens(list, { action: 'title', screen: 'onboarding/workspace', title: 'Team' })).toEqual([])
    expect(movedScreens(list, { action: 'restore', folder: 'x' })).toEqual([])
  })
})

describe('saveBlock', () => {
  test('names the first screen that is not saved', () => {
    const states: Record<string, SaveState> = { a: 'saved', b: 'pending', c: 'failed' }
    const state = (id: string) => states[id] ?? 'saved'
    expect(saveBlock(['a', 'x'], state)).toBeNull()
    expect(saveBlock(['a', 'b', 'c'], state)).toBe('The changes of b are not saved yet. Try again in a moment.')
    expect(saveBlock(['c', 'b'], state)).toBe('The changes of c cannot be saved. Fix the file error first.')
    expect(saveBlock([], state)).toBeNull()
  })
})

function setup(saveState: (id: string) => SaveState = () => 'saved') {
  const edits = createEditsStore()
  const issues = createIssuesStore()
  const drafts = createBubbleStore()
  const reports: [string, string | null][] = []
  const replaced: [readonly string[], readonly string[]][] = []
  const bases: (ReadonlyMap<string, readonly Edit[]> | undefined)[] = []
  const sync: EditorSync = {
    requests: {
      setScreens: () => {},
      stop: () => {},
      replaceScreens: (drop, load, base?) => {
        replaced.push([drop, load])
        bases.push(base)
      },
      saveState,
      hold: () => () => {},
    },
    issues: { setScreens: () => {}, stop: () => {}, replaceScreens: (drop, load) => replaced.push([drop, load]) },
  }
  return { edits, issues, drafts, reports, replaced, bases, sync, report: (key: string, error: string | null) => reports.push([key, error]) }
}

describe('followAction', () => {
  test('drops the edits with their undo steps, the issues, the drafts and the errors of each old id, and tells the syncs', () => {
    const deps = setup()
    deps.edits.apply('onboarding/workspace', comment('e1'))
    deps.edits.apply('onboarding/welcome', comment('e2'))
    deps.edits.apply('onboarding/workspace', comment('e3'))
    deps.issues.set('onboarding/workspace', [])
    deps.drafts.setDraft(draftKey({ screenId: 'onboarding/workspace', loc: null }), 'Draft')
    deps.drafts.setDraft(draftKey({ screenId: 'onboarding/welcome', loc: null }), 'Keep')

    followAction({ screens: [{ from: 'onboarding/workspace', to: 'onboarding/team' }] }, deps)

    expect(deps.replaced).toEqual([
      [['onboarding/workspace'], ['onboarding/team']],
      [['onboarding/workspace'], ['onboarding/team']],
    ])
    expect(deps.edits.get('onboarding/workspace')).toEqual([])
    expect(deps.edits.get('onboarding/welcome').map((item) => item.edit.id)).toEqual(['e2'])
    // The undo steps of the old id go; the step of the other screen stays.
    deps.edits.undo()
    expect(deps.edits.get('onboarding/welcome')).toEqual([])
    expect(deps.edits.canUndo()).toBe(false)
    expect(deps.issues.get('onboarding/workspace')).toBeUndefined()
    expect(deps.drafts.draft(draftKey({ screenId: 'onboarding/workspace', loc: null }))).toBe('')
    expect(deps.drafts.draft(draftKey({ screenId: 'onboarding/welcome', loc: null }))).toBe('Keep')
    expect(deps.reports).toEqual([['collect:onboarding/workspace', null]])
  })

  test('works with no sync', () => {
    const deps = setup()
    deps.edits.apply('a', comment('e1'))
    followAction({ screens: [{ from: 'a', to: null }] }, { ...deps, sync: null })
    expect(deps.edits.get('a')).toEqual([])
  })
})

describe('carriedEdits', () => {
  const placed = (id: string, file: string): Edit => ({
    id,
    target: { file, line: 6, column: 10, tag: 'Stack', origin: 'library', element: 'div', copies: 1, label: '' },
    width: 1440,
    change: { kind: 'remove' },
  })

  test('gives the edits of a renamed screen that changed at the new id, with the new file and the new option of a keep', () => {
    const before = new Map([['a/b', [comment('e1')]]])
    const now = (id: string): Edit[] =>
      id === 'a/b'
        ? [
            comment('e1'),
            placed('e2', 'screens/a/b.tsx'),
            { id: 'e3', target: null, width: 1440, change: { kind: 'keep', option: 'a/b-option-1' } },
          ]
        : []
    const carried = carriedEdits(
      [
        { from: 'a/b', to: 'a/c' },
        { from: 'a/b-option-1', to: 'a/c-option-1' },
      ],
      before,
      now,
    )
    expect([...carried.keys()]).toEqual(['a/c'])
    expect(carried.get('a/c')).toEqual({
      base: [comment('e1')],
      edits: [
        comment('e1'),
        placed('e2', 'screens/a/c.tsx'),
        { id: 'e3', target: null, width: 1440, change: { kind: 'keep', option: 'a/c-option-1' } },
      ],
    })
  })

  test('a changed and a discarded item are carried; edits that did not change are not', () => {
    const before = new Map([['a/b', [placed('e1', 'screens/a/b.tsx'), comment('e2')]]])
    const changed = { ...comment('e2'), change: { kind: 'comment' as const, text: 'Add the empty state' } }
    const carried = carriedEdits([{ from: 'a/b', to: 'a/c' }], before, () => [changed])
    expect(carried.get('a/c')).toEqual({ base: [placed('e1', 'screens/a/c.tsx'), comment('e2')], edits: [changed] })
    const same = carriedEdits([{ from: 'a/b', to: 'a/c' }], before, () => before.get('a/b')!)
    expect(same).toEqual(new Map())
  })

  test('a delete carries nothing', () => {
    expect(carriedEdits([{ from: 'a/b', to: null }], new Map(), () => [comment('e1')])).toEqual(new Map())
  })
})

describe('runAction', () => {
  const action: ScreenAction = { action: 'delete', screen: 'onboarding/workspace' }

  function runDeps(result: ActionResult, saveState?: (id: string) => SaveState) {
    const deps = setup(saveState)
    const run = vi.fn(async () => result)
    const all: RunDeps = { ...deps, client: { run }, list }
    return { deps, run, all }
  }

  test('an applied action follows its plan', async () => {
    const result: ActionResult = {
      status: 'applied',
      plan: {
        action: 'delete',
        screen: 'onboarding/workspace',
        screens: [{ from: 'onboarding/workspace', to: null }],
        linkedBy: [],
        moves: [],
        writes: [],
        removes: [],
      },
    }
    const { deps, run, all } = runDeps(result)
    deps.edits.apply('onboarding/workspace', comment('e1'))
    expect(await runAction(action, all)).toBe(result)
    expect(run).toHaveBeenCalledWith(action)
    expect(deps.edits.get('onboarding/workspace')).toEqual([])
  })

  test('an edit made while a rename runs goes to the new id', async () => {
    const rename: ScreenAction = { action: 'rename', screen: 'onboarding/workspace', flow: 'onboarding', name: 'team' }
    const deps = setup()
    deps.edits.apply('onboarding/workspace', comment('e1'))
    const run = vi.fn(async (): Promise<ActionResult> => {
      deps.edits.apply('onboarding/workspace', comment('e2'))
      return {
        status: 'applied',
        plan: {
          action: 'rename',
          screen: 'onboarding/workspace',
          screens: [{ from: 'onboarding/workspace', to: 'onboarding/team' }],
          linkedBy: [],
          moves: [],
          writes: [],
          removes: [],
        },
      }
    })
    await runAction(rename, { ...deps, client: { run }, list })
    expect(deps.edits.get('onboarding/workspace')).toEqual([])
    // e1 was in the file that the server moved; e2 was not. The editor
    // carries both, and the moved file is the base of the first load.
    expect(deps.edits.get('onboarding/team').map((item) => item.edit.id)).toEqual(['e1', 'e2'])
    expect(deps.bases.at(-1)?.get('onboarding/team')).toEqual([comment('e1')])
  })

  test('a new text of a comment and a discard made while a rename runs go to the new id', async () => {
    const rename: ScreenAction = { action: 'rename', screen: 'onboarding/workspace', flow: 'onboarding', name: 'team' }
    const deps = setup()
    deps.edits.apply('onboarding/workspace', comment('e1'))
    deps.edits.apply('onboarding/workspace', comment('e2'))
    const run = vi.fn(async (): Promise<ActionResult> => {
      deps.edits.changeComment('onboarding/workspace', 'e1', 'Add the empty state')
      deps.edits.discard('onboarding/workspace', 'e2')
      return {
        status: 'applied',
        plan: {
          action: 'rename',
          screen: 'onboarding/workspace',
          screens: [{ from: 'onboarding/workspace', to: 'onboarding/team' }],
          linkedBy: [],
          moves: [],
          writes: [],
          removes: [],
        },
      }
    })
    await runAction(rename, { ...deps, client: { run }, list })
    expect(deps.edits.get('onboarding/team').map((item) => item.edit.change)).toEqual([{ kind: 'comment', text: 'Add the empty state' }])
    expect(deps.bases.at(-1)?.get('onboarding/team')?.map((edit) => edit.id)).toEqual(['e1', 'e2'])
  })

  test('a refused action changes nothing in the editor', async () => {
    const { deps, all } = runDeps({ status: 'refused', refusals: ['no'] })
    deps.edits.apply('onboarding/workspace', comment('e1'))
    expect(await runAction(action, all)).toEqual({ status: 'refused', refusals: ['no'] })
    expect(deps.edits.get('onboarding/workspace')).toHaveLength(1)
    expect(deps.replaced).toEqual([])
  })

  test('a save that is pending or failed for a moved screen blocks the action with no call', async () => {
    const { run, all } = runDeps({ status: 'refused', refusals: [] }, (id) =>
      id === 'onboarding/workspace-option-1' ? 'failed' : 'saved',
    )
    expect(await runAction(action, all)).toEqual({
      status: 'refused',
      refusals: ['The changes of onboarding/workspace-option-1 cannot be saved. Fix the file error first.'],
    })
    expect(run).not.toHaveBeenCalled()
    // A move in the row moves no request file: it runs.
    await runAction({ action: 'reorder', screen: 'onboarding/workspace', to: 0 }, all)
    expect(run).toHaveBeenCalledTimes(1)
  })
})
