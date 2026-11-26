import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { parseIssues, parseRequest } from '../src/requests/format.ts'
import {
  ApplyError,
  applyPlan,
  diskReader,
  idLiterals,
  innerRelative,
  movedImports,
  moveThrough,
  parseManifest,
  planDelete,
  planRename,
  planReorder,
  planRestore,
  planTitle,
  rewriteIds,
  StrandedMove,
  trashItems,
  type Plan,
  type Reader,
} from './screen-ops.ts'
import { readScreenMeta } from './screens.ts'

function screen(meta: string, body = '<Stack />') {
  return `import { Button, Stack } from '@lib/core'

export const meta = ${meta}

export default function Screen() {
  return ${body}
}
`
}

function target(file: string) {
  return { file, line: 6, column: 10, tag: 'Stack', origin: 'library', element: 'div', copies: 1, label: '' }
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

// A project: the flow `onboarding` with `welcome`, `workspace`, a state and an
// option of `workspace`, and a sequence; the flow `other` with `start`, which
// links to `workspace`, and `end`, and no sequence.
function project(): Record<string, string> {
  return {
    'screens/onboarding/welcome.tsx': screen(
      `{ title: 'Welcome', width: 1440 } as const`,
      '<Button href="#/onboarding/workspace">Next</Button>',
    ),
    'screens/onboarding/workspace.tsx': screen(
      `{ title: 'Workspace', width: 1440 }`,
      "<Stack><Button href={'#/onboarding/welcome'}>Back</Button><Button href={`#/onboarding/${next}`}>Go</Button></Stack>",
    ),
    'screens/onboarding/workspace-email-error.tsx': screen(
      `{ title: 'Workspace, email error', width: 1440, stateOf: 'onboarding/workspace' }`,
      '<Button href="#/onboarding/welcome">Back</Button>',
    ),
    'screens/onboarding/workspace-option-1.tsx': screen(
      `{ title: 'Workspace, option 1: one column', width: 1440, optionOf: 'onboarding/workspace' }`,
    ),
    'screens/onboarding/flow.json': json({ order: ['workspace', 'welcome'] }),
    'screens/other/start.tsx': screen(`{ title: 'Start', width: 390 }`, '<Button href="#/onboarding/workspace">Go</Button>'),
    'screens/other/end.tsx': screen(`{ title: 'End', width: 390 }`),
    '.canvas/requests/onboarding/workspace.json': json({
      version: 1,
      screen: 'onboarding/workspace',
      file: 'screens/onboarding/workspace.tsx',
      edits: [
        { id: 'e1', target: target('screens/onboarding/workspace.tsx'), width: 1440, change: { kind: 'remove' } },
        { id: 'e2', target: null, width: 1440, change: { kind: 'keep', option: 'onboarding/workspace-option-1' } },
      ],
    }),
    '.canvas/issues/onboarding/workspace.json': json({
      version: 1,
      screen: 'onboarding/workspace',
      file: 'screens/onboarding/workspace.tsx',
      issues: [{ kind: 'not-library', target: target('screens/onboarding/workspace.tsx') }],
    }),
  }
}

function memory(files: Record<string, string>): Reader {
  return {
    read: (path) => files[path] ?? null,
    list: (folder) => Object.keys(files).filter((path) => path.startsWith(`${folder.replace(/\/+$/, '')}/`)),
  }
}

// The files after the plan, as `applyPlan` would leave them.
function after(files: Record<string, string>, plan: Plan): Record<string, string> {
  expect(plan.refusals).toEqual([])
  const result = { ...files }
  for (const move of plan.moves) {
    result[move.to] = result[move.from]
    delete result[move.from]
  }
  for (const write of plan.writes) result[write.path] = write.text
  for (const path of plan.removes) delete result[path]
  return result
}

describe('rewriteIds', () => {
  const map = new Map([
    ['a/one', 'a/uno'],
    ['a/two', 'b/two'],
  ])
  const rewrite = (code: string) => rewriteIds(code, idLiterals(code, 'screens/a/x.tsx'), map)

  test('replaces the address of a link in an attribute, in its quotes', () => {
    expect(rewrite(screen(`{ title: 'X', width: 1440 }`, '<Button href="#/a/one">Go</Button>'))).toContain(
      '<Button href="#/a/uno">Go</Button>',
    )
  })

  test('replaces two links in one file, and leaves a link to a different screen', () => {
    const code = screen(
      `{ title: 'X', width: 1440 }`,
      "<Stack><Button href={'#/a/one'} /><Button href=\"#/a/two\" /><Button href=\"#/a/three\" /></Stack>",
    )
    expect(rewrite(code)).toContain(`<Stack><Button href={'#/a/uno'} /><Button href="#/b/two" /><Button href="#/a/three" /></Stack>`)
  })

  test('replaces `stateOf` and `optionOf`', () => {
    expect(rewrite(screen(`{ title: 'X', width: 1440, stateOf: 'a/one' }`))).toContain(`stateOf: 'a/uno'`)
    expect(rewrite(screen(`{ title: 'X', width: 1440, optionOf: "a/two" }`))).toContain(`optionOf: "b/two"`)
  })

  test('leaves an address that the code computes, and the title', () => {
    const code = screen(
      `{ title: 'a/one', width: 1440 }`,
      "<Stack><Button href={`#/a/${name}`} /><Button href={'#/a/' + name} /></Stack>",
    )
    expect(rewrite(code)).toBe(code)
  })

  test('gives no literal for a file that the parser cannot read', () => {
    expect(idLiterals('export const meta = {', 'screens/a/x.tsx')).toEqual([])
  })

  test('gives the links of a file with no meta', () => {
    const code = 'export default function X() {\n  return <a href="#/a/one">Go</a>\n}\n'
    expect(rewrite(code)).toBe('export default function X() {\n  return <a href="#/a/uno">Go</a>\n}\n')
  })
})

describe('planReorder', () => {
  test('writes the new sequence of the row into flow.json', () => {
    const files = project()
    const plan = planReorder(memory(files), 'onboarding/welcome', 0)
    expect(plan.writes).toEqual([{ path: 'screens/onboarding/flow.json', text: json({ order: ['welcome', 'workspace'] }) }])
    expect(plan.screens).toEqual([])
  })

  test('writes a new flow.json for a flow with none', () => {
    const plan = planReorder(memory(project()), 'other/start', 1)
    expect(plan.writes).toEqual([{ path: 'screens/other/flow.json', text: json({ order: ['end', 'start'] }) }])
  })

  test('keeps the other keys of flow.json', () => {
    const files = { ...project(), 'screens/onboarding/flow.json': json({ note: 'kept', order: ['workspace'] }) }
    const plan = planReorder(memory(files), 'onboarding/welcome', 0)
    expect(JSON.parse(plan.writes[0].text)).toEqual({ note: 'kept', order: ['welcome', 'workspace'] })
  })

  test('writes nothing for the same place', () => {
    expect(planReorder(memory(project()), 'onboarding/workspace', 0).writes).toEqual([])
  })

  test('refuses a state, an unknown screen and a flow.json that is not valid', () => {
    expect(planReorder(memory(project()), 'onboarding/workspace-email-error', 0).refusals).toHaveLength(1)
    expect(planReorder(memory(project()), 'onboarding/none', 0).refusals).toEqual(["no screen has the id 'onboarding/none'"])
    const files = { ...project(), 'screens/onboarding/flow.json': '{ order' }
    expect(planReorder(memory(files), 'onboarding/welcome', 0).refusals[0]).toContain('screens/onboarding/flow.json is not valid')
  })
})

describe('planTitle', () => {
  test('replaces the title literal of a meta with `as const`, also with a quote in the new title', () => {
    const files = project()
    const plan = planTitle(memory(files), 'onboarding/welcome', "Bob's week")
    const text = after(files, plan)['screens/onboarding/welcome.tsx']
    expect(text).toContain(`{ title: 'Bob\\'s week', width: 1440 } as const`)
    expect(readScreenMeta(text, 'screens/onboarding/welcome.tsx').title).toBe("Bob's week")
  })

  test('keeps double quotes', () => {
    const files = { ...project(), 'screens/other/end.tsx': screen(`{ title: "End", width: 390 }`) }
    const text = after(files, planTitle(memory(files), 'other/end', 'The "end"'))['screens/other/end.tsx']
    expect(readScreenMeta(text, 'screens/other/end.tsx').title).toBe('The "end"')
  })

  test('a backslash and a line break round-trip through the literal', () => {
    const files = project()
    for (const title of ['A\\B', 'Two\nlines', 'Back\r\\n']) {
      const text = after(files, planTitle(memory(files), 'onboarding/welcome', title))['screens/onboarding/welcome.tsx']
      expect(readScreenMeta(text, 'screens/onboarding/welcome.tsx').title).toBe(title)
    }
  })

  test('refuses an empty title and a screen whose file has an error', () => {
    expect(planTitle(memory(project()), 'onboarding/welcome', '  ').refusals).toEqual(['the title is empty'])
    const files = { ...project(), 'screens/other/end.tsx': 'export const meta = {' }
    expect(planTitle(memory(files), 'other/end', 'End').refusals[0]).toContain('has an error')
  })
})

describe('planRename', () => {
  test('moves the screen with its state and option, and changes each id', () => {
    const files = project()
    const plan = planRename(memory(files), 'onboarding/workspace', { flow: 'onboarding', name: 'team' })
    expect(plan.screens).toEqual([
      { from: 'onboarding/workspace', to: 'onboarding/team' },
      { from: 'onboarding/workspace-email-error', to: 'onboarding/team-email-error' },
      { from: 'onboarding/workspace-option-1', to: 'onboarding/team-option-1' },
    ])
    const result = after(files, plan)
    expect(Object.keys(result).filter((path) => path.includes('workspace'))).toEqual([])

    expect(result['screens/onboarding/welcome.tsx']).toContain('href="#/onboarding/team"')
    expect(result['screens/other/start.tsx']).toContain('href="#/onboarding/team"')
    expect(result['screens/onboarding/team-email-error.tsx']).toContain(`stateOf: 'onboarding/team'`)
    expect(result['screens/onboarding/team-option-1.tsx']).toContain(`optionOf: 'onboarding/team'`)
    // The computed address stays.
    expect(result['screens/onboarding/team.tsx']).toBe(files['screens/onboarding/workspace.tsx'])

    const request = parseRequest(JSON.parse(result['.canvas/requests/onboarding/team.json']))
    expect(request.screen).toBe('onboarding/team')
    expect(request.file).toBe('screens/onboarding/team.tsx')
    expect(request.edits[0].target?.file).toBe('screens/onboarding/team.tsx')
    expect(request.edits[1].change).toEqual({ kind: 'keep', option: 'onboarding/team-option-1' })

    const issues = parseIssues(JSON.parse(result['.canvas/issues/onboarding/team.json']))
    expect(issues.screen).toBe('onboarding/team')
    expect(issues.file).toBe('screens/onboarding/team.tsx')
    expect(issues.issues[0]).toMatchObject({ target: { file: 'screens/onboarding/team.tsx' } })

    expect(JSON.parse(result['screens/onboarding/flow.json'])).toEqual({ order: ['team', 'welcome'] })
  })

  test('moves the screen to a different flow, and changes the two flow.json files', () => {
    const files = { ...project(), 'screens/other/flow.json': json({ order: ['start'] }) }
    const plan = planRename(memory(files), 'onboarding/workspace', { flow: 'other', name: 'team' })
    const result = after(files, plan)
    expect(result['screens/other/team-email-error.tsx']).toContain(`stateOf: 'other/team'`)
    expect(result['screens/other/team-option-1.tsx']).toContain(`optionOf: 'other/team'`)
    expect(result['screens/other/start.tsx']).toContain('href="#/other/team"')
    expect(JSON.parse(result['screens/onboarding/flow.json'])).toEqual({ order: ['welcome'] })
    expect(JSON.parse(result['screens/other/flow.json'])).toEqual({ order: ['start', 'team'] })
    expect(JSON.parse(result['.canvas/requests/other/team.json']).edits[1].change.option).toBe('other/team-option-1')
  })

  test('a move to a flow of a different depth changes the relative imports of each moved file', () => {
    const imports = `import { Ring } from '../../components/Ring.tsx'\nimport { rows } from './data.ts'\nexport { other } from "./other.ts"\n`
    const files = {
      ...project(),
      'screens/onboarding/workspace.tsx': imports + project()['screens/onboarding/workspace.tsx'],
      'screens/onboarding/workspace-email-error.tsx': imports + project()['screens/onboarding/workspace-email-error.tsx'],
    }
    const plan = planRename(memory(files), 'onboarding/workspace', { flow: 'a/b', name: 'team' })
    const result = after(files, plan)
    for (const path of ['screens/a/b/team.tsx', 'screens/a/b/team-email-error.tsx']) {
      expect(result[path]).toContain(`from '../../../components/Ring.tsx'`)
      expect(result[path]).toContain(`from '../../onboarding/data.ts'`)
      expect(result[path]).toContain(`from "../../onboarding/other.ts"`)
    }
    // A move in the same folder keeps the imports.
    const renamed = after(files, planRename(memory(files), 'onboarding/workspace', { flow: 'onboarding', name: 'team' }))
    expect(renamed['screens/onboarding/team.tsx']).toBe(files['screens/onboarding/workspace.tsx'])
  })

  test('a relative import of a file whose name starts with a dot, and an `import()`, name the same file after a move', () => {
    const source = `import rows from '../shared/.data.ts'\nconst load = () => import('./.cache.ts')\n`
    const moved = movedImports(source, 'screens/a/x.tsx', 'screens/shared/x.tsx', new Map())
    expect(moved).toBe(`import rows from './.data.ts'\nconst load = () => import('../a/.cache.ts')\n`)
  })

  test('an import of a file far above the project keeps each `..` after a move, from each current folder', () => {
    const source = `import { Button } from '../../../../shared/ui/index.ts'\n`
    const cwd = process.cwd()
    try {
      process.chdir('/')
      const moved = movedImports(source, 'screens/a/x.tsx', 'screens/b/c/x.tsx', new Map())
      expect(moved).toBe(`import { Button } from '../../../../../shared/ui/index.ts'\n`)
    } finally {
      process.chdir(cwd)
    }
    expect(innerRelative('screens/b', '../../shared')).toBe('../../../../shared')
    expect(innerRelative('screens/b', 'screens/a/x.ts')).toBe('../a/x.ts')
  })

  test('changes a `keep` of a moved option in the request file of a base that stays', () => {
    const files = project()
    const plan = planRename(memory(files), 'onboarding/workspace-option-1', { flow: 'onboarding', name: 'workspace-option-2' })
    const result = after(files, plan)
    expect(plan.screens).toEqual([{ from: 'onboarding/workspace-option-1', to: 'onboarding/workspace-option-2' }])
    expect(JSON.parse(result['.canvas/requests/onboarding/workspace.json']).edits[1].change.option).toBe(
      'onboarding/workspace-option-2',
    )
  })

  test('keeps the name of a state that does not start with the name of its base', () => {
    const files = project()
    files['screens/onboarding/email-error.tsx'] = files['screens/onboarding/workspace-email-error.tsx']
    delete files['screens/onboarding/workspace-email-error.tsx']
    const plan = planRename(memory(files), 'onboarding/workspace', { flow: 'onboarding', name: 'team' })
    expect(plan.screens.map((change) => change.to)).toEqual(['onboarding/team', 'onboarding/team-option-1'])
    expect(after(files, plan)['screens/onboarding/email-error.tsx']).toContain(`stateOf: 'onboarding/team'`)
  })

  test('refuses an id that exists, a name that is not valid, and a state into a different flow', () => {
    const files = project()
    expect(planRename(memory(files), 'onboarding/workspace', { flow: 'onboarding', name: 'welcome' }).refusals).toEqual([
      "a screen with the id 'onboarding/welcome' exists",
    ])
    for (const name of ['my screen', '../x', '', 'a.b', '-a']) {
      const plan = planRename(memory(files), 'onboarding/welcome', { flow: 'onboarding', name })
      expect(plan.refusals[0]).toContain('is not a valid name')
      expect(plan.moves).toEqual([])
    }
    expect(planRename(memory(files), 'onboarding/welcome', { flow: '../x', name: 'a' }).refusals[0]).toContain('not a valid flow')
    expect(
      planRename(memory(files), 'onboarding/workspace-email-error', { flow: 'other', name: 'error' }).refusals[0],
    ).toContain('stays in the flow of its base')
    expect(planRename(memory(files), 'onboarding/welcome', { flow: 'onboarding', name: 'welcome' }).refusals).toHaveLength(1)
  })

  test('refuses a flow or an id that differs from one that exists only in its case', () => {
    const files = project()
    expect(planRename(memory(files), 'onboarding/welcome', { flow: 'Onboarding', name: 'hello' }).refusals[0]).toContain(
      "the flow 'onboarding' exists",
    )
    expect(planRename(memory(files), 'onboarding/workspace', { flow: 'onboarding', name: 'Welcome' }).refusals).toEqual([
      "a screen with the id 'onboarding/welcome' exists",
    ])
    // A screen may change only the case of its own name.
    expect(planRename(memory(files), 'onboarding/welcome', { flow: 'onboarding', name: 'Welcome' }).refusals).toEqual([])
  })

  test('a name that flow.json already has is there one time after the rename', () => {
    const files = { ...project(), 'screens/onboarding/flow.json': json({ order: ['workspace', 'team', 'welcome'] }) }
    const result = after(files, planRename(memory(files), 'onboarding/workspace', { flow: 'onboarding', name: 'team' }))
    expect(JSON.parse(result['screens/onboarding/flow.json'])).toEqual({ order: ['team', 'welcome'] })
  })

  test('refuses a request file that is not valid, and a request file that exists at the new id', () => {
    const files = { ...project(), '.canvas/requests/onboarding/workspace.json': '{' }
    expect(planRename(memory(files), 'onboarding/workspace', { flow: 'onboarding', name: 'team' }).refusals[0]).toContain(
      'is not valid',
    )
    const old = { ...project(), '.canvas/requests/onboarding/team.json': '{}' }
    expect(planRename(memory(old), 'onboarding/workspace', { flow: 'onboarding', name: 'team' }).refusals).toEqual([
      'the file .canvas/requests/onboarding/team.json exists, left from a screen that is no longer there: move it out of .canvas first',
    ])
  })

  test('refuses a request or issues file at the new id also when the screen has none', () => {
    const files: Record<string, string> = { ...project(), '.canvas/requests/onboarding/team.json': '{}', '.canvas/issues/onboarding/team.json': '{}' }
    delete files['.canvas/requests/onboarding/workspace.json']
    delete files['.canvas/issues/onboarding/workspace.json']
    expect(planRename(memory(files), 'onboarding/workspace', { flow: 'onboarding', name: 'team' }).refusals).toEqual([
      'the file .canvas/requests/onboarding/team.json exists, left from a screen that is no longer there: move it out of .canvas first',
      'the file .canvas/issues/onboarding/team.json exists, left from a screen that is no longer there: move it out of .canvas first',
    ])
  })

  test('a change of only the case of the name works on a file system that ignores the case', () => {
    const files = project()
    // A disk that ignores the case: a read of `Welcome.tsx` gives `welcome.tsx`.
    const reader: Reader = {
      read: (path) => Object.entries(files).find(([key]) => key.toLowerCase() === path.toLowerCase())?.[1] ?? null,
      list: memory(files).list,
      same: (a, b) => a.toLowerCase() === b.toLowerCase(),
    }
    const plan = planRename(reader, 'onboarding/workspace', { flow: 'onboarding', name: 'Workspace' })
    expect(plan.refusals).toEqual([])
    expect(plan.moves).toContainEqual({ from: 'screens/onboarding/workspace.tsx', to: 'screens/onboarding/Workspace.tsx' })
    expect(plan.moves).toContainEqual({
      from: '.canvas/requests/onboarding/workspace.json',
      to: '.canvas/requests/onboarding/Workspace.json',
    })
    expect(plan.reads.map((read) => read.path)).not.toContain('screens/onboarding/Workspace.tsx')
  })

  // A disk that ignores the case: a read of `Welcome.tsx` gives `welcome.tsx`.
  const folding = (files: Record<string, string>): Reader => ({
    read: (path) => Object.entries(files).find(([key]) => key.toLowerCase() === path.toLowerCase())?.[1] ?? null,
    list: memory(files).list,
    same: (a, b) => a.toLowerCase() === b.toLowerCase(),
  })

  test('a request file in a folder of a different case moves with its screen, on a file system that ignores the case', () => {
    const files: Record<string, string> = { ...project() }
    files['.canvas/requests/Onboarding/workspace.json'] = files['.canvas/requests/onboarding/workspace.json']
    delete files['.canvas/requests/onboarding/workspace.json']
    const plan = planRename(folding(files), 'onboarding/workspace', { flow: 'onboarding', name: 'team' })
    expect(plan.refusals).toEqual([])
    expect(plan.moves).toContainEqual({ from: '.canvas/requests/onboarding/workspace.json', to: '.canvas/requests/onboarding/team.json' })
    const write = plan.writes.find((item) => item.path === '.canvas/requests/onboarding/team.json')!
    expect(JSON.parse(write.text).screen).toBe('onboarding/team')
    expect(plan.writes.map((item) => item.path)).not.toContain('.canvas/requests/Onboarding/workspace.json')
  })

  test('a file at the new name in a different case is left over when it is not the file of the screen, on a file system that ignores the case', () => {
    const files: Record<string, string> = { ...project() }
    delete files['.canvas/requests/onboarding/workspace.json']
    const gone = JSON.parse(project()['.canvas/requests/onboarding/workspace.json'])
    files['.canvas/requests/onboarding/Workspace.json'] = json({ ...gone, screen: 'onboarding/Workspace' })
    const to = { flow: 'onboarding', name: 'Workspace' }
    expect(planRename(folding(files), 'onboarding/workspace', to).refusals).toEqual([
      'the file .canvas/requests/onboarding/Workspace.json exists, left from a screen that is no longer there: move it out of .canvas first',
    ])
    files['.canvas/requests/onboarding/Workspace.json'] = '{'
    expect(planRename(folding(files), 'onboarding/workspace', to).refusals[0]).toContain('is not valid')
    // The file of the screen itself in the new case moves to its new name.
    files['.canvas/requests/onboarding/Workspace.json'] = project()['.canvas/requests/onboarding/workspace.json']
    const plan = planRename(folding(files), 'onboarding/workspace', to)
    expect(plan.refusals).toEqual([])
    expect(plan.moves).toContainEqual({ from: '.canvas/requests/onboarding/workspace.json', to: '.canvas/requests/onboarding/Workspace.json' })
  })

  test('a change of only the case refuses a different file at the new path, on a file system that keeps the case apart', () => {
    const files = { ...project(), '.canvas/requests/onboarding/Workspace.json': '{}' }
    const plan = planRename(memory(files), 'onboarding/workspace', { flow: 'onboarding', name: 'Workspace' })
    expect(plan.refusals).toEqual([
      'the file .canvas/requests/onboarding/Workspace.json exists, left from a screen that is no longer there: move it out of .canvas first',
    ])
  })

  test('reads and writes only the request files that the rename changes', () => {
    const other = json({
      version: 1,
      screen: 'other/end',
      file: 'screens/other/end.tsx',
      // Written by a different tool: the keys in a different sequence.
      edits: [{ width: 390, id: 'x1', target: null, change: { text: 'Add a list', kind: 'comment' } }],
    })
    const files = { ...project(), '.canvas/requests/other/end.json': other }
    const plan = planRename(memory(files), 'onboarding/workspace', { flow: 'onboarding', name: 'team' })
    expect(plan.reads.map((read) => read.path)).not.toContain('.canvas/requests/other/end.json')
    expect(plan.writes.map((write) => write.path)).not.toContain('.canvas/requests/other/end.json')
  })
})

const time = new Date('2026-11-23T10:15:00.000Z')
const trash = '.canvas/trash/20261123-101500-onboarding-workspace'

describe('planDelete', () => {
  test('moves the screen with its state, its option and their files into the trash, with a manifest', () => {
    const files = project()
    const plan = planDelete(memory(files), 'onboarding/workspace', time)
    const moved = [
      'screens/onboarding/workspace.tsx',
      '.canvas/requests/onboarding/workspace.json',
      '.canvas/issues/onboarding/workspace.json',
      'screens/onboarding/workspace-email-error.tsx',
      'screens/onboarding/workspace-option-1.tsx',
    ]
    expect(plan.moves).toEqual(moved.map((path) => ({ from: path, to: `${trash}/${path}` })))
    expect(plan.screens).toEqual([
      { from: 'onboarding/workspace', to: null },
      { from: 'onboarding/workspace-email-error', to: null },
      { from: 'onboarding/workspace-option-1', to: null },
    ])
    expect(plan.linkedBy.sort()).toEqual(['onboarding/welcome', 'other/start'])
    const result = after(files, plan)
    expect(JSON.parse(result['screens/onboarding/flow.json'])).toEqual({ order: ['welcome'] })
    expect(parseManifest(result[`${trash}/manifest.json`])).toEqual({
      screen: 'onboarding/workspace',
      files: moved,
      flowOrder: ['workspace', 'welcome'],
      time: '2026-11-23T10:15:00.000Z',
    })
  })

  test('takes a new folder when the folder of that time exists', () => {
    const files = { ...project(), [`${trash}/manifest.json`]: '{}' }
    expect(planDelete(memory(files), 'onboarding/workspace', time).moves[0].to).toBe(
      `${trash}-2/screens/onboarding/workspace.tsx`,
    )
  })

  test('has no flow order for a screen that flow.json does not name', () => {
    const plan = planDelete(memory(project()), 'other/end', time)
    const manifest = plan.writes.find((write) => write.path.endsWith('manifest.json'))!
    expect(parseManifest(manifest.text).flowOrder).toBeNull()
    expect(plan.writes).toHaveLength(1)
    expect(plan.linkedBy).toEqual([])
  })
})

describe('planRestore', () => {
  const folderName = '20261123-101500-onboarding-workspace'
  // The project after the delete of `onboarding/workspace`, with a different
  // flow.json.
  function deleted(order: string[] | null): Record<string, string> {
    const files = after(project(), planDelete(memory(project()), 'onboarding/workspace', time))
    if (order === null) delete files['screens/onboarding/flow.json']
    else files['screens/onboarding/flow.json'] = json({ order })
    return files
  }
  const orderAfter = (files: Record<string, string>) => {
    const result = after(files, planRestore(memory(files), folderName))
    return JSON.parse(result['screens/onboarding/flow.json']).order as string[]
  }

  test('puts the name back before the name that came after it, also when the order changed', () => {
    expect(orderAfter(deleted(['welcome']))).toEqual(['workspace', 'welcome'])
    expect(orderAfter(deleted(['team', 'welcome']))).toEqual(['team', 'workspace', 'welcome'])
  })

  test('puts the name at the end when the names after it are gone', () => {
    expect(orderAfter(deleted(['team']))).toEqual(['team', 'workspace'])
  })

  test('writes no flow.json when the file was removed', () => {
    const files = deleted(null)
    const plan = planRestore(memory(files), folderName)
    expect(plan.refusals).toEqual([])
    expect(plan.writes).toEqual([])
    expect(after(files, plan)['screens/onboarding/flow.json']).toBeUndefined()
  })

  test('restores a screen whose name the rename would refuse', () => {
    const files = { ...project(), 'screens/other/step.2.tsx': screen(`{ title: 'Step 2', width: 390 }`) }
    const gone = after(files, planDelete(memory(files), 'other/step.2', time))
    expect(gone['screens/other/step.2.tsx']).toBeUndefined()
    const name = '20261123-101500-other-step.2'
    const plan = planRestore(memory(gone), name)
    expect(plan.refusals).toEqual([])
    expect(after(gone, plan)['screens/other/step.2.tsx']).toBe(files['screens/other/step.2.tsx'])
  })

  test('refuses a flow or an id that differs only in its case from one that exists', () => {
    const files = deleted(['welcome'])
    files['screens/onboarding/Workspace.tsx'] = files['screens/onboarding/welcome.tsx']
    expect(planRestore(memory(files), folderName).refusals).toEqual(["a screen with the id 'onboarding/Workspace' exists"])
    const moved = deleted(['welcome'])
    for (const name of ['welcome.tsx', 'flow.json']) {
      moved[`screens/Onboarding/${name}`] = moved[`screens/onboarding/${name}`]
      delete moved[`screens/onboarding/${name}`]
    }
    expect(planRestore(memory(moved), folderName).refusals).toEqual([
      "the flow 'Onboarding' exists; a flow name that differs only in its case is the same folder on some file systems",
    ])
  })

  test('a file of the manifest that the trash no longer has is a refusal', () => {
    const files = deleted(['welcome'])
    delete files[`${trash}/screens/onboarding/workspace-option-1.tsx`]
    expect(planRestore(memory(files), folderName).refusals).toEqual([
      `the trash has no file ${trash}/screens/onboarding/workspace-option-1.tsx`,
    ])
  })
})

describe('parseManifest', () => {
  test('refuses a path out of the project', () => {
    expect(() => parseManifest(json({ screen: 'a', files: ['../x'], flowOrder: null, time: 't' }))).toThrow('files')
    expect(() => parseManifest(json({ screen: 'a', files: ['/x'], flowOrder: null, time: 't' }))).toThrow('files')
    expect(() => parseManifest(json({ screen: 'a', files: ['C:x'], flowOrder: null, time: 't' }))).toThrow('files')
    expect(() => parseManifest(json({ screen: 'a', files: ['a\\..\\b'], flowOrder: null, time: 't' }))).toThrow('files')
  })

  test('refuses a manifest of a different form', () => {
    expect(() => parseManifest('null')).toThrow('not an object')
    expect(() => parseManifest('[]')).toThrow('screen')
    expect(() => parseManifest(json({ screen: 'a', files: [], flowOrder: [1], time: 't' }))).toThrow('flowOrder')
    expect(() => parseManifest(json({ screen: 'a', files: [], flowOrder: 'a', time: 't' }))).toThrow('flowOrder')
    expect(() => parseManifest(json({ screen: 'a', files: [], flowOrder: null }))).toThrow('time')
    expect(parseManifest(json({ screen: 'a', files: ['screens/a.tsx'], flowOrder: ['a'], time: 't' }))).toEqual({
      screen: 'a',
      files: ['screens/a.tsx'],
      flowOrder: ['a'],
      time: 't',
    })
  })

  test('planRestore refuses a name that is not one folder of the trash', () => {
    for (const name of ['', '.', '..', 'a/b', 'a\\b', '..\\x']) {
      expect(planRestore(memory(project()), name).refusals, name).toEqual([`'${name}' is not a folder of the trash`])
    }
  })
})

describe('on a temporary folder', () => {
  let root = ''
  afterEach(() => {
    if (root !== '') rmSync(root, { recursive: true, force: true })
    root = ''
  })

  function folder(files: Record<string, string>) {
    root = mkdtempSync(join(tmpdir(), 'canvas-screen-ops-'))
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
  }

  // Each file below the root, with its text.
  function tree(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const name of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
      if (statSync(join(root, name)).isFile()) result[name.replaceAll('\\', '/')] = readFileSync(join(root, name), 'utf8')
    }
    return result
  }

  test('the disk reader leaves out a link to nothing', () => {
    folder({ 'screens/a/b.tsx': 'b' })
    symlinkSync(join(root, 'missing.tsx'), join(root, 'screens/a/gone.tsx'))
    expect(diskReader(root).list('screens')).toEqual(['screens/a/b.tsx'])
  })

  test('a delete and a restore give the project back, and the trash folder goes', () => {
    const files = project()
    folder(files)
    expect(applyPlan(root, planDelete(diskReader(root), 'onboarding/workspace', time))).toEqual({ applied: true })
    expect(tree()['screens/onboarding/workspace.tsx']).toBeUndefined()

    const plan = planRestore(diskReader(root), '20261123-101500-onboarding-workspace')
    expect(plan.screens.map((change) => change.to)).toEqual([
      'onboarding/workspace',
      'onboarding/workspace-email-error',
      'onboarding/workspace-option-1',
    ])
    expect(applyPlan(root, plan)).toEqual({ applied: true })
    expect(tree()).toEqual(files)
    expect(readdirSync(join(root, '.canvas/trash'))).toEqual([])
  })

  test('a restore over a file that exists is a refusal', () => {
    folder(project())
    applyPlan(root, planDelete(diskReader(root), 'onboarding/workspace', time))
    writeFileSync(join(root, 'screens/onboarding/workspace.tsx'), 'new')
    const plan = planRestore(diskReader(root), '20261123-101500-onboarding-workspace')
    expect(plan.refusals).toEqual(['the file screens/onboarding/workspace.tsx exists'])
    expect(applyPlan(root, plan)).toEqual({ applied: false, refusals: plan.refusals })
    expect(planRestore(diskReader(root), '../x').refusals).toHaveLength(1)
    expect(planRestore(diskReader(root), 'none').refusals).toEqual(["the trash has no folder 'none'"])
  })

  test('a manifest with an id that is not valid, or with a file that is not of a screen, is a refusal', () => {
    folder(project())
    applyPlan(root, planDelete(diskReader(root), 'onboarding/workspace', time))
    const path = join(root, '.canvas/trash/20261123-101500-onboarding-workspace/manifest.json')
    const manifest = JSON.parse(readFileSync(path, 'utf8'))
    writeFileSync(path, JSON.stringify({ ...manifest, screen: '../../x' }))
    expect(planRestore(diskReader(root), '20261123-101500-onboarding-workspace').refusals[0]).toContain('is not valid')
    writeFileSync(path, JSON.stringify({ ...manifest, files: [...manifest.files, 'package.json'] }))
    expect(planRestore(diskReader(root), '20261123-101500-onboarding-workspace').refusals).toEqual([
      '.canvas/trash/20261123-101500-onboarding-workspace/manifest.json is not valid: package.json is not a screen, request or issues file',
    ])
    writeFileSync(path, JSON.stringify({ ...manifest, files: [...manifest.files, 'screens/onboarding\\x.tsx'] }))
    expect(planRestore(diskReader(root), '20261123-101500-onboarding-workspace').refusals).toEqual([
      '.canvas/trash/20261123-101500-onboarding-workspace/manifest.json is not valid: screens/onboarding\\x.tsx is not a screen, request or issues file',
    ])
    writeFileSync(path, JSON.stringify({ ...manifest, files: [...manifest.files, manifest.files[0]] }))
    expect(planRestore(diskReader(root), '20261123-101500-onboarding-workspace').refusals).toEqual([
      `.canvas/trash/20261123-101500-onboarding-workspace/manifest.json is not valid: it names ${manifest.files[0]} twice`,
    ])
    writeFileSync(path, JSON.stringify({ ...manifest, files: [...manifest.files, manifest.files[0].replace('workspace', 'Workspace')] }))
    expect(planRestore(diskReader(root), '20261123-101500-onboarding-workspace').refusals[0]).toContain('twice')
    for (const empty of ['screens/.tsx', 'screens/onboarding/.tsx', '.canvas/requests/.json']) {
      writeFileSync(path, JSON.stringify({ ...manifest, files: [...manifest.files, empty] }))
      expect(planRestore(diskReader(root), '20261123-101500-onboarding-workspace').refusals).toEqual([
        `.canvas/trash/20261123-101500-onboarding-workspace/manifest.json is not valid: ${empty} is not a screen, request or issues file`,
      ])
    }
  })

  test('a rename on the disk', () => {
    folder(project())
    const plan = planRename(diskReader(root), 'onboarding/workspace', { flow: 'other', name: 'team' })
    expect(applyPlan(root, plan)).toEqual({ applied: true })
    const result = tree()
    expect(Object.keys(result).filter((path) => path.startsWith('screens/other/')).sort()).toEqual([
      'screens/other/end.tsx',
      'screens/other/start.tsx',
      'screens/other/team-email-error.tsx',
      'screens/other/team-option-1.tsx',
      'screens/other/team.tsx',
    ])
    expect(result['.canvas/requests/other/team.json']).toBeDefined()
  })

  test('a file that changed after the plan read it: no change, and a refusal', () => {
    folder(project())
    const plan = planTitle(diskReader(root), 'onboarding/welcome', 'Hello')
    writeFileSync(join(root, 'screens/onboarding/workspace.tsx'), 'changed by an agent')
    const before = tree()
    expect(applyPlan(root, plan)).toEqual({
      applied: false,
      refusals: ['screens/onboarding/workspace.tsx changed after the tool read it; try again'],
    })
    expect(tree()).toEqual(before)
  })

  test('a step that fails in the middle puts back each step before it', () => {
    folder({ 'a.txt': 'a', 'c.txt': 'c' })
    mkdirSync(join(root, 'd'))
    const plan: Plan = {
      action: 'rename',
      screen: 'a',
      screens: [],
      linkedBy: [],
      reads: [],
      moves: [{ from: 'a.txt', to: 'sub/b.txt' }],
      writes: [
        { path: 'c.txt', text: 'new' },
        { path: 'e.txt', text: 'e' },
        { path: 'd', text: 'fails: a folder' },
      ],
      removes: [],
      refusals: [],
    }
    expect(() => applyPlan(root, plan)).toThrow(expect.objectContaining({ restored: true }))
    expect(tree()).toEqual({ 'a.txt': 'a', 'c.txt': 'c' })
    // The folder that the move made goes too.
    expect(readdirSync(root).sort()).toEqual(['.canvas', 'a.txt', 'c.txt', 'd'])
  })

  test('a step that cannot be put back gives an error that says so', () => {
    folder({ 'a.txt': 'a' })
    // The write makes a folder at the old path of the moved file; the remove
    // fails; the way back of the move then finds a folder at its path.
    const plan: Plan = {
      ...emptyPlan,
      moves: [{ from: 'a.txt', to: 'sub/a.txt' }],
      writes: [{ path: 'a.txt/inner.txt', text: 'x' }],
      removes: ['missing.txt'],
    }
    let error: unknown
    try {
      applyPlan(root, plan)
    } catch (thrown) {
      error = thrown
    }
    expect(error).toBeInstanceOf(ApplyError)
    expect((error as ApplyError).restored).toBe(false)
    expect((error as ApplyError).message).toContain('1 step could not be put back')
    expect((error as ApplyError).cause).toBeInstanceOf(Error)
  })

  const emptyPlan: Plan = {
    action: 'delete',
    screen: 'a',
    screens: [],
    linkedBy: [],
    reads: [],
    moves: [],
    writes: [],
    removes: [],
    refusals: [],
  }

  test('a remove that fails puts back the removes and the writes before it', () => {
    folder({ 'a.txt': 'a', 'b.txt': 'b' })
    const plan: Plan = { ...emptyPlan, writes: [{ path: 'a.txt', text: 'new' }], removes: ['b.txt', 'missing.txt'] }
    expect(() => applyPlan(root, plan)).toThrow()
    expect(tree()).toEqual({ 'a.txt': 'a', 'b.txt': 'b' })
  })

  test('a move to a file that exists stops with no change', () => {
    folder({ 'a.txt': 'a', 'b.txt': 'b', 'c.txt': 'c' })
    const plan: Plan = {
      ...emptyPlan,
      moves: [
        { from: 'a.txt', to: 'sub/a.txt' },
        { from: 'b.txt', to: 'c.txt' },
      ],
    }
    expect(() => applyPlan(root, plan)).toThrow('the file c.txt exists')
    expect(tree()).toEqual({ 'a.txt': 'a', 'b.txt': 'b', 'c.txt': 'c' })
  })

  test('a move removes the folders that it left empty, up to the screens folder', () => {
    folder({ 'screens/flow/deep/a.tsx': 'a', 'screens/other.tsx': 'o' })
    expect(applyPlan(root, { ...emptyPlan, moves: [{ from: 'screens/flow/deep/a.tsx', to: 'screens/a.tsx' }] })).toEqual({
      applied: true,
    })
    expect(tree()).toEqual({ 'screens/a.tsx': 'a', 'screens/other.tsx': 'o' })
    expect(readdirSync(join(root, 'screens')).sort()).toEqual(['a.tsx', 'other.tsx'])
  })

  test('a rename that changes only the case of the name, on the disk', () => {
    folder(project())
    const plan = planRename(diskReader(root), 'onboarding/workspace', { flow: 'onboarding', name: 'Workspace' })
    expect(applyPlan(root, plan)).toEqual({ applied: true })
    const names = readdirSync(join(root, 'screens/onboarding'))
    expect(names).toContain('Workspace.tsx')
    expect(names).not.toContain('workspace.tsx')
    expect(readdirSync(join(root, '.canvas/requests/onboarding'))).toEqual(['Workspace.json'])
  })
})

describe('trashItems', () => {
  const manifest = (screen: string, time: string) => json({ screen, files: [`screens/${screen}.tsx`], flowOrder: null, time })

  test('gives the folders with a valid manifest, the newest first', () => {
    const reader = memory({
      '.canvas/trash/20261122-090000-a/manifest.json': manifest('a', '2026-11-22T09:00:00.000Z'),
      '.canvas/trash/20261122-090000-a/screens/a.tsx': 'x',
      '.canvas/trash/20261123-101500-flow-b/manifest.json': manifest('flow/b', '2026-11-23T10:15:00.000Z'),
      '.canvas/trash/broken/manifest.json': '{',
      '.canvas/trash/empty/screens/c.tsx': 'x',
      '.canvas/trash/deep/screens/manifest.json': manifest('d', '2026-11-24T00:00:00.000Z'),
    })
    expect(trashItems(reader)).toEqual([
      { folder: '20261123-101500-flow-b', screen: 'flow/b', files: ['screens/flow/b.tsx'], time: '2026-11-23T10:15:00.000Z' },
      { folder: '20261122-090000-a', screen: 'a', files: ['screens/a.tsx'], time: '2026-11-22T09:00:00.000Z' },
    ])
  })

  test('an empty list with no trash', () => {
    expect(trashItems(memory({}))).toEqual([])
  })
})

describe('moveThrough', () => {
  // A fake rename over a map of paths, which fails for the steps of `fails`.
  const disk = (fails: readonly string[]) => {
    const files = new Map([['a', 'text']])
    const rename = (from: string, to: string) => {
      if (fails.includes(`${from}>${to}`)) throw new Error(`cannot move ${from}`)
      files.set(to, files.get(from)!)
      files.delete(from)
    }
    return { files, rename }
  }

  test('moves the file through the temporary name', () => {
    const { files, rename } = disk([])
    moveThrough('a', 'tmp', 'A', rename)
    expect([...files.keys()]).toEqual(['A'])
  })

  test('a second step that fails puts the file back and throws its error', () => {
    const { files, rename } = disk(['tmp>A'])
    expect(() => moveThrough('a', 'tmp', 'A', rename)).toThrow('cannot move tmp')
    expect([...files.keys()]).toEqual(['a'])
  })

  test('a file that cannot go back gives a StrandedMove with its place', () => {
    const { files, rename } = disk(['tmp>A', 'tmp>a'])
    let error: unknown
    try {
      moveThrough('a', 'tmp', 'A', rename)
    } catch (thrown) {
      error = thrown
    }
    expect(error).toBeInstanceOf(StrandedMove)
    expect((error as StrandedMove).temp).toBe('tmp')
    expect((error as StrandedMove).message).toBe('the file a is at tmp')
    expect(((error as StrandedMove).cause as Error).message).toBe('cannot move tmp')
    expect([...files.keys()]).toEqual(['tmp'])
  })
})
