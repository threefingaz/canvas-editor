import { parseSync } from 'vite'
import { describe, expect, test } from 'vitest'
import { config } from '../canvas.config.ts'
import {
  affectedScreenIds,
  folderPrefix,
  idInFolder,
  inFolder,
  libraryInfo,
  metaRanges,
  readScreenMeta,
  relationProblems,
  screenEntry,
  screenIdOf,
  screenList,
  screensModuleCode,
  toolProject,
  type GraphNode,
  type ScreenEntry,
} from './screens.ts'

const file = 'screens/onboarding/welcome.tsx'
const widths = [1440, 1024, 390]

function screen(meta: string) {
  return `import Stack from '@mui/material/Stack'

${meta}

export default function Welcome() {
  return <Stack />
}
`
}

describe('readScreenMeta', () => {
  test('reads a correct meta', () => {
    const code = screen(`export const meta = { title: 'Welcome', width: 1440 }`)
    expect(readScreenMeta(code, file, widths)).toEqual({ title: 'Welcome', width: 1440 })
  })

  test('reads a meta with `as const` or `satisfies`', () => {
    const asConst = screen(`export const meta = { title: 'Welcome', width: 390 } as const`)
    expect(readScreenMeta(asConst, file, widths)).toEqual({ title: 'Welcome', width: 390 })
    const satisfies = screen(`export const meta = { width: 1024, title: 'Welcome' } satisfies object`)
    expect(readScreenMeta(satisfies, file, widths)).toEqual({ title: 'Welcome', width: 1024 })
  })

  test('uses the widths of the config when no widths are given', () => {
    const code = screen(`export const meta = { title: 'Welcome', width: 1440 }`)
    expect(readScreenMeta(code, file)).toEqual({ title: 'Welcome', width: 1440 })
  })

  test('gives an error with the file name when there is no meta', () => {
    expect(() => readScreenMeta(screen(''), file, widths)).toThrow(
      `${file}: the file does not export \`meta\``,
    )
  })

  test('gives an error when meta is declared but not exported', () => {
    const code = screen(`const meta = { title: 'Welcome', width: 1440 }`)
    expect(() => readScreenMeta(code, file, widths)).toThrow(`${file}: the file does not export \`meta\``)
  })

  test('gives an error when meta is not an object literal', () => {
    const code = screen(`const base = { title: 'Welcome', width: 1440 }
export const meta = base`)
    expect(() => readScreenMeta(code, file, widths)).toThrow(`${file}: \`meta\` must be an object literal`)
  })

  test('gives an error for a spread in meta', () => {
    const code = screen(`const base = { width: 1440 }
export const meta = { title: 'Welcome', ...base }`)
    expect(() => readScreenMeta(code, file, widths)).toThrow(`${file}: \`meta\` must be an object literal`)
  })

  test('gives an error for a width that is not in the config', () => {
    const code = screen(`export const meta = { title: 'Welcome', width: 800 }`)
    expect(() => readScreenMeta(code, file, widths)).toThrow(
      `${file}: \`meta.width\` must be one of 1440, 1024, 390`,
    )
  })

  test('gives an error for a width that is not a number', () => {
    const code = screen(`export const meta = { title: 'Welcome', width: '1440' }`)
    expect(() => readScreenMeta(code, file, widths)).toThrow(
      `${file}: \`meta.width\` must be one of 1440, 1024, 390`,
    )
  })

  test('gives an error for a missing title', () => {
    const code = screen(`export const meta = { width: 1440 }`)
    expect(() => readScreenMeta(code, file, widths)).toThrow(`${file}: \`meta.title\` must be a text`)
  })

  test('gives an error for a title that a later property of the same name computes', () => {
    const code = screen(`export const meta = { title: 'Welcome', width: 1440, title: name }`)
    expect(() => readScreenMeta(code, file, widths)).toThrow(`${file}: \`meta.title\` must be a text`)
  })

  test('gives an error for an empty title', () => {
    const code = screen(`export const meta = { title: '', width: 1440 }`)
    expect(() => readScreenMeta(code, file, widths)).toThrow(`${file}: \`meta.title\` must be a text`)
  })

  test('reads `stateOf` and `optionOf`', () => {
    const state = screen(`export const meta = { title: 'Welcome, error', width: 1440, stateOf: 'onboarding/welcome' }`)
    expect(readScreenMeta(state, file, widths)).toEqual({
      title: 'Welcome, error',
      width: 1440,
      stateOf: 'onboarding/welcome',
    })
    const option = screen(`export const meta = { title: 'Welcome, option 1', width: 1440, optionOf: 'onboarding/welcome' }`)
    expect(readScreenMeta(option, file, widths)).toEqual({
      title: 'Welcome, option 1',
      width: 1440,
      optionOf: 'onboarding/welcome',
    })
  })

  test('gives no relation fields for a meta with neither', () => {
    const code = screen(`export const meta = { title: 'Welcome', width: 1440 }`)
    expect(Object.keys(readScreenMeta(code, file, widths))).toEqual(['title', 'width'])
  })

  test('gives an error for a file with the two relation fields', () => {
    const code = screen(`export const meta = { title: 'W', width: 1440, stateOf: 'a/b', optionOf: 'a/c' }`)
    expect(() => readScreenMeta(code, file, widths)).toThrow(
      `${file}: \`meta\` can have \`stateOf\` or \`optionOf\`, not the two`,
    )
  })

  test.each([
    ['an empty text', `''`],
    ['a number', '1'],
    ['a template literal', '`onboarding/welcome`'],
    ['a variable', 'base'],
    ['null', 'null'],
    ['a text with `as const`', `'onboarding/welcome' as const`],
  ])('gives an error for a relation field that is %s', (_name, value) => {
    for (const field of ['stateOf', 'optionOf']) {
      const code = screen(`const base = 'onboarding/welcome'
export const meta = { title: 'W', width: 1440, ${field}: ${value} }`)
      expect(() => readScreenMeta(code, file, widths)).toThrow(`${file}: \`meta.${field}\` must be a screen id`)
    }
  })

  test('gives an error with the file name for a syntax error', () => {
    const code = screen(`export const meta = { title: 'Welcome', width: 1440`)
    expect(() => readScreenMeta(code, file, widths)).toThrow(`${file}: `)
  })
})

describe('metaRanges', () => {
  test('gives the range of each text literal of title, stateOf and optionOf, with its quotes', () => {
    const code = screen(`export const meta = { title: "A \\"b\\"", width: 1440, 'stateOf': 'onboarding/x' } as const`)
    const ranges = metaRanges(code, file)
    expect(code.slice(ranges.title!.start, ranges.title!.end)).toBe('"A \\"b\\""')
    expect(code.slice(ranges.stateOf!.start, ranges.stateOf!.end)).toBe("'onboarding/x'")
    expect(ranges.optionOf).toBeUndefined()
  })

  test('gives no range for a field that is not a text literal', () => {
    expect(metaRanges(screen('export const meta = { title: `T`, width: 1440, optionOf: id }'), file)).toEqual({})
  })

  test('throws for a file with no meta', () => {
    expect(() => metaRanges('export default 1', file)).toThrow(file)
  })
})

describe('screenEntry', () => {
  const meta = { title: 'Welcome', width: 1440 }

  test('gives the id, the flow and the name from the path', () => {
    expect(screenEntry(file, meta)).toEqual({
      id: 'onboarding/welcome',
      flow: 'onboarding',
      name: 'welcome',
      title: 'Welcome',
      width: 1440,
      file,
      links: [],
    })
  })

  test('copies the relation fields', () => {
    expect(screenEntry(file, { ...meta, stateOf: 'onboarding/start' })).toMatchObject({
      stateOf: 'onboarding/start',
    })
    const option = screenEntry(file, { ...meta, optionOf: 'onboarding/start' })
    expect(option).toMatchObject({ optionOf: 'onboarding/start' })
    expect('stateOf' in option).toBe(false)
  })

  test('gives the flow "" for a file directly in the screens folder', () => {
    expect(screenEntry('screens/home.tsx', meta)).toMatchObject({ id: 'home', flow: '', name: 'home' })
  })

  test('keeps a flow with more than one folder', () => {
    expect(screenEntry('screens/settings/account/profile.tsx', meta)).toMatchObject({
      id: 'settings/account/profile',
      flow: 'settings/account',
      name: 'profile',
    })
  })

  test('reads a path with backslashes', () => {
    expect(screenEntry('screens\\onboarding\\welcome.tsx', meta)).toMatchObject({
      id: 'onboarding/welcome',
      file,
    })
  })

  test('uses the screens folder that is given', () => {
    expect(screenEntry('app/screens/home.tsx', meta, 'app/screens')).toMatchObject({ id: 'home', flow: '' })
  })

  test('gives an error for a file outside the screens folder', () => {
    expect(() => screenEntry('src/home.tsx', meta)).toThrow('src/home.tsx: the file is not in `screens/`')
  })
})

describe('screenList', () => {
  test('gives an entry for each file, sorted by flow and name', () => {
    const list = screenList(
      [
        { file: 'screens/onboarding/welcome.tsx', code: screen(`export const meta = { title: 'Welcome', width: 1440 }`) },
        { file: 'screens/home.tsx', code: screen(`export const meta = { title: 'Home', width: 390 }`) },
      ],
      widths,
    )
    expect(list).toEqual([
      { id: 'home', flow: '', name: 'home', title: 'Home', width: 390, file: 'screens/home.tsx', links: [] },
      {
        id: 'onboarding/welcome',
        flow: 'onboarding',
        name: 'welcome',
        title: 'Welcome',
        width: 1440,
        file: 'screens/onboarding/welcome.tsx',
        links: [],
      },
    ])
  })

  test('sorts each flow by its flow.json and keeps a state with its base', () => {
    const meta = (title: string, more = '') => screen(`export const meta = { title: '${title}', width: 1440${more} }`)
    const list = screenList(
      [
        { file: 'screens/a/alpha.tsx', code: meta('Alpha') },
        { file: 'screens/a/beta.tsx', code: meta('Beta') },
        { file: 'screens/a/beta-error.tsx', code: meta('Beta, error', ", stateOf: 'a/beta'") },
        { file: 'screens/b/one.tsx', code: meta('One') },
        { file: 'screens/b/two.tsx', code: meta('Two') },
      ],
      widths,
      undefined,
      null,
      [
        { flow: 'a', file: 'screens/a/flow.json', text: '{ "order": ["beta", "alpha"] }' },
        { flow: 'b', file: 'screens/b/flow.json', text: '{ "order": "two" }' },
      ],
    )
    // The file of `b` is not valid: the row has the sequence by name.
    expect(list.map((entry) => entry.id)).toEqual(['a/beta', 'a/beta-error', 'a/alpha', 'b/one', 'b/two'])
  })

  test('gives the links of a file, each one time, in the order of the code', () => {
    const code = `export const meta = { title: 'A', width: 1440 }
export default () => <div><a href="#/b/two">x</a><a href="#/b/one">y</a><a href="#/b/two">z</a><a href="#top">t</a></div>`
    expect(screenList([{ file: 'screens/a.tsx', code }], widths)[0].links).toEqual(['b/two', 'b/one'])
  })

  test('keeps a valid relation in the entry', () => {
    const list = screenList(
      [
        { file: 'screens/a/base.tsx', code: screen(`export const meta = { title: 'Base', width: 1440 }`) },
        { file: 'screens/a/error.tsx', code: screen(`export const meta = { title: 'Error', width: 1440, stateOf: 'a/base' }`) },
      ],
      widths,
    )
    expect(list[1]).toMatchObject({ id: 'a/error', stateOf: 'a/base' })
    expect(list.some((entry) => 'relationError' in entry)).toBe(false)
  })

  test('gives an entry with a broken relation its cause and no relation fields, not an error', () => {
    const list = screenList(
      [{ file: 'screens/a/option-1.tsx', code: screen(`export const meta = { title: 'Option', width: 390, optionOf: 'a/gone' }`) }],
      widths,
    )
    expect(list).toEqual([
      {
        id: 'a/option-1',
        flow: 'a',
        name: 'option-1',
        title: 'Option',
        width: 390,
        file: 'screens/a/option-1.tsx',
        links: [],
        relationError: "`optionOf`: no screen has the id 'a/gone'",
      },
    ])
  })

  test('accepts a base whose file has an error', () => {
    const list = screenList(
      [
        { file: 'screens/a/base.tsx', code: screen('') },
        { file: 'screens/a/error.tsx', code: screen(`export const meta = { title: 'Error', width: 1440, stateOf: 'a/base' }`) },
      ],
      widths,
    )
    expect(list[0].error).toBeDefined()
    expect(list[1]).toMatchObject({ id: 'a/error', stateOf: 'a/base' })
    expect('relationError' in list[1]).toBe(false)
  })

  test('judges a base by its file in one pass, also when its own relation is broken', () => {
    const list = screenList(
      [
        { file: 'screens/a/error.tsx', code: screen(`export const meta = { title: 'Error', width: 1440, stateOf: 'a/gone' }`) },
        { file: 'screens/a/x.tsx', code: screen(`export const meta = { title: 'X', width: 1440, stateOf: 'a/error' }`) },
        { file: 'screens/a/y.tsx', code: screen(`export const meta = { title: 'Y', width: 1440, optionOf: 'a/error' }`) },
      ],
      widths,
    )
    const [error, x, y] = ['a/error', 'a/x', 'a/y'].map((id) => list.find((entry) => entry.id === id)!)
    // The broken state shows as a base screen with its cause.
    expect(error).toMatchObject({ id: 'a/error', relationError: "`stateOf`: no screen has the id 'a/gone'" })
    expect('stateOf' in error).toBe(false)
    // A state of it is refused, because its file says that it is a state; the
    // cause names the broken relation of the base.
    expect(x.id).toBe('a/x')
    expect('stateOf' in x).toBe(false)
    expect(x.relationError).toBe(
      "`stateOf`: the screen 'a/error' is a state; a state has no states (its own relation is broken, thus it shows as a base screen)",
    )
    // An option of it stays a valid option: the base of an option can be a state.
    expect(y).toMatchObject({ id: 'a/y', optionOf: 'a/error' })
    expect('relationError' in y).toBe(false)
  })

  test('an option with the marker of its part gets the place of the block', () => {
    const marked = (meta: string) => screen(meta).replace('<Stack />', '(\n    /* canvas-part */\n    <Stack />\n  )')
    const list = screenList(
      [
        { file: 'screens/a/one.tsx', code: screen("export const meta = { title: 'A', width: 1440 }") },
        { file: 'screens/a/one-option-1.tsx', code: marked("export const meta = { title: 'A, option 1', width: 1440, optionOf: 'a/one' }") },
      ],
      widths,
    )
    expect('part' in list[0]).toBe(false)
    expect(list[1]).toMatchObject({ id: 'a/one-option-1', part: '8:5' })
    expect('partError' in list[1]).toBe(false)
  })

  test('a marker that breaks a rule gives the cause and no part', () => {
    const marked = (meta: string) => screen(meta).replace('<Stack />', '(\n    /* canvas-part */\n    <Stack />\n  )')
    const list = screenList(
      [
        { file: 'screens/a/one.tsx', code: marked("export const meta = { title: 'A', width: 1440 }") },
        // A broken relation is the one finding of its screen.
        { file: 'screens/a/two.tsx', code: marked("export const meta = { title: 'B', width: 1440, optionOf: 'a/gone' }") },
      ],
      widths,
    )
    expect('part' in list[0]).toBe(false)
    expect(list[0].partError).toContain('not an option')
    expect(list[1].relationError).toBeDefined()
    expect('part' in list[1]).toBe(false)
    expect('partError' in list[1]).toBe(false)
  })

  test('gives a file with an error an entry with the error text, not a failure', () => {
    const list = screenList([{ file: 'screens/onboarding/broken.tsx', code: screen('') }], widths)
    expect(list).toEqual([
      {
        id: 'onboarding/broken',
        flow: 'onboarding',
        name: 'broken',
        title: 'broken',
        width: 1440,
        file: 'screens/onboarding/broken.tsx',
        links: [],
        error: 'screens/onboarding/broken.tsx: the file does not export `meta`',
      },
    ])
  })
})

describe('relationProblems', () => {
  function entry(id: string, relation: Partial<ScreenEntry> = {}): ScreenEntry {
    const slash = id.lastIndexOf('/')
    const flow = slash === -1 ? '' : id.slice(0, slash)
    return { id, flow, name: id.slice(slash + 1), title: id, width: 1440, file: `screens/${id}.tsx`, links: [], ...relation }
  }

  test('gives no problem for valid relations', () => {
    const problems = relationProblems([
      entry('a/base'),
      entry('a/error', { stateOf: 'a/base' }),
      entry('a/option-1', { optionOf: 'a/base' }),
      entry('a/error-option-1', { optionOf: 'a/error' }),
    ])
    expect(problems.size).toBe(0)
  })

  test('gives a problem for an unknown base', () => {
    const problems = relationProblems([entry('a/error', { stateOf: 'a/gone' })])
    expect(problems).toEqual(new Map([['a/error', "`stateOf`: no screen has the id 'a/gone'"]]))
  })

  test('gives a problem for a base in a different flow', () => {
    const problems = relationProblems([entry('a/base'), entry('b/option-1', { optionOf: 'a/base' })])
    expect(problems.get('b/option-1')).toBe("`optionOf`: the screen 'a/base' is in a different flow")
  })

  test('gives a problem for a base that is the screen itself', () => {
    const problems = relationProblems([entry('a/base', { stateOf: 'a/base' })])
    expect(problems.get('a/base')).toBe('`stateOf` names the screen itself')
  })

  test('gives a problem for a state of a state', () => {
    const problems = relationProblems([
      entry('a/base'),
      entry('a/error', { stateOf: 'a/base' }),
      entry('a/error-2', { stateOf: 'a/error' }),
    ])
    expect([...problems]).toEqual([['a/error-2', "`stateOf`: the screen 'a/error' is a state; a state has no states"]])
  })

  test('gives a problem for an option of an option', () => {
    const problems = relationProblems([
      entry('a/base'),
      entry('a/option-1', { optionOf: 'a/base' }),
      entry('a/option-2', { optionOf: 'a/option-1' }),
    ])
    expect([...problems]).toEqual([
      ['a/option-2', "`optionOf`: the screen 'a/option-1' is an option; an option has no options"],
    ])
  })

  test('gives a problem for a state of an option', () => {
    const problems = relationProblems([
      entry('a/base'),
      entry('a/option-1', { optionOf: 'a/base' }),
      entry('a/error', { stateOf: 'a/option-1' }),
    ])
    expect([...problems]).toEqual([
      ['a/error', "`stateOf`: the screen 'a/option-1' is an option; an option has no states"],
    ])
  })

  test('accepts a base whose file has an error', () => {
    const problems = relationProblems([entry('a/base', { error: 'broken' }), entry('a/error', { stateOf: 'a/base' })])
    expect(problems.size).toBe(0)
  })
})

describe('libraryInfo', () => {
  const pack = { name: 'kit', sources: ['@acme/kit'], folder: 'packs/kit' }

  test('gives the name of the one pack and its level', () => {
    expect(libraryInfo(pack, [{ id: 'palette.primary' }])).toEqual({ name: 'kit', level: 'ready' })
    expect(libraryInfo(pack, null)).toEqual({ name: 'kit', level: 'ready' })
  })

  test('a pack with an empty token file is connected', () => {
    expect(libraryInfo(pack, [])).toEqual({ name: 'kit', level: 'connected' })
  })

  test('gives null with no pack', () => {
    expect(libraryInfo(null)).toBeNull()
    expect(libraryInfo(null, [])).toBeNull()
  })
})

describe('screensModuleCode', () => {
  const home: ScreenEntry = { id: 'home', flow: '', name: 'home', title: 'Home', width: 390, file: 'screens/home.tsx', links: [] }

  // The values of the module text, read back as data.
  function exportsOf(code: string): Record<string, unknown> {
    const values: Record<string, unknown> = {}
    for (const part of code.split(/^export const /m).filter((text) => text !== '')) {
      const match = /^(\w+) = ([\s\S]*)$/.exec(part.trim())
      if (match) values[match[1]] = JSON.parse(match[2])
    }
    return values
  }

  test('with a pack, carries the screens and the name of the library', () => {
    const code = screensModuleCode([home], { name: 'kit', level: 'ready' })
    expect(exportsOf(code)).toEqual({ screens: [home], library: { name: 'kit', level: 'ready' }, flowErrors: [], project: toolProject })
    expect(code.endsWith('\n')).toBe(true)
  })

  test('with no pack, carries the screens and a null library', () => {
    const code = screensModuleCode([home], null)
    expect(exportsOf(code)).toEqual({ screens: [home], library: null, flowErrors: [], project: toolProject })
    expect(code).toContain('export const library = null\n')
  })

  test('with no screens, carries an empty list', () => {
    expect(exportsOf(screensModuleCode([], null))).toEqual({ screens: [], library: null, flowErrors: [], project: toolProject })
  })

  test('carries the flow files that are not valid', () => {
    const error = { flow: 'onboarding', file: 'screens/onboarding/flow.json', error: 'the name "a" is two times in `order`' }
    expect(exportsOf(screensModuleCode([home], null, [error])).flowErrors).toEqual([error])
  })

  test('carries the widths and the guide of the project; the tool gives its own with none', () => {
    expect(toolProject).toEqual({ widths: config.widths, guide: 'AGENTS.md' })
    const project = { widths: [1280, 375], guide: 'canvas/AGENTS.md' }
    expect(exportsOf(screensModuleCode([home], null, [], project)).project).toEqual(project)
  })

  test('is valid module code', () => {
    const result = parseSync('virtual.js', screensModuleCode([home], { name: 'kit', level: 'ready' }))
    expect(result.errors).toEqual([])
  })
})

describe('folderPrefix', () => {
  test('ends the folder with one slash', () => {
    expect(folderPrefix('screens')).toBe('screens/')
    expect(folderPrefix('screens/')).toBe('screens/')
    expect(folderPrefix('/project/screens//')).toBe('/project/screens/')
  })
})

describe('screenIdOf and inFolder', () => {
  const folder = '/project/screens'

  test('a .tsx file in the folder or a sub folder is a screen', () => {
    expect(screenIdOf('/project/screens/home.tsx', folder)).toBe('home')
    expect(screenIdOf('/project/screens/onboarding/welcome.tsx', '/project/screens/')).toBe('onboarding/welcome')
  })

  test('a .tsx part in a sub folder is a screen too: shared parts with JSX go outside the folder', () => {
    expect(screenIdOf('/project/screens/parts/Header.tsx', folder)).toBe('parts/Header')
  })

  test('a .ts part, or a file outside the folder, is not a screen', () => {
    expect(screenIdOf('/project/screens/parts/brand.ts', folder)).toBeNull()
    expect(screenIdOf('/project/screens-old/home.tsx', folder)).toBeNull()
    expect(screenIdOf('/project/packs/demo/library/theme.ts', folder)).toBeNull()
  })

  test('a file of the folder of any kind is in the folder', () => {
    expect(inFolder('/project/screens/parts/brand.ts', folder)).toBe(true)
    expect(inFolder('/project/screens-old/home.tsx', folder)).toBe(false)
    expect(inFolder('/project/screens', folder)).toBe(false)
  })
})

describe('idInFolder', () => {
  test('is the path in the folder with no extension', () => {
    expect(idInFolder('/work/.canvas/requests/onboarding/welcome.json', '/work/.canvas/requests', '.json')).toBe(
      'onboarding/welcome',
    )
    expect(idInFolder('/project/screens/home.tsx', '/project/screens/', '.tsx')).toBe('home')
  })

  test('a path outside the folder or with a different extension gives null', () => {
    expect(idInFolder('/project/screens-old/home.tsx', '/project/screens', '.tsx')).toBeNull()
    expect(idInFolder('/project/screens/home.ts', '/project/screens', '.tsx')).toBeNull()
  })
})

describe('affectedScreenIds', () => {
  const folder = '/project/screens'

  // A module and the modules that import it.
  function node(file: string | null, importers: GraphNode[] = []): GraphNode {
    return { file, importers: new Set(importers) }
  }

  test('gives the id of a changed screen file', () => {
    const file = '/project/screens/onboarding/welcome.tsx'
    const frame = node('/project/src/frame/main.tsx')
    expect(affectedScreenIds(file, [node(file, [frame])], folder)).toEqual(['onboarding/welcome'])
  })

  test('gives the screens that import a changed file outside the screens folder (an own component)', () => {
    const frame = node('/project/src/frame/main.tsx')
    const welcome = node('/project/screens/onboarding/welcome.tsx', [frame])
    const badge = node('/project/components/Badge.tsx', [welcome])
    const ring = node('/project/components/Ring.tsx', [badge])
    expect(affectedScreenIds('/project/components/Ring.tsx', [ring], folder)).toEqual(['onboarding/welcome'])
  })

  test('gives the id of a changed file that no frame has loaded yet', () => {
    expect(affectedScreenIds('/project/screens/home.tsx', [], folder)).toEqual(['home'])
  })

  test('gives each screen that imports the changed file, also through other files', () => {
    const frame = node('/project/src/frame/main.tsx')
    const welcome = node('/project/screens/onboarding/welcome.tsx', [frame])
    const mobile = node('/project/screens/onboarding/welcome-mobile.tsx', [frame])
    const header = node('/project/screens/parts/header.ts', [welcome])
    const brand = node('/project/screens/parts/brand.ts', [header, mobile])
    expect(affectedScreenIds('/project/screens/parts/brand.ts', [brand], folder).sort()).toEqual([
      'onboarding/welcome',
      'onboarding/welcome-mobile',
    ])
  })

  test('a .tsx part in the folder is a screen id of its own', () => {
    const welcome = node('/project/screens/onboarding/welcome.tsx')
    const header = node('/project/screens/parts/Header.tsx', [welcome])
    expect(affectedScreenIds('/project/screens/parts/Header.tsx', [header], folder).sort()).toEqual([
      'onboarding/welcome',
      'parts/Header',
    ])
  })

  test('gives a screen that failed to import a file that now exists', () => {
    const broken = node('/project/screens/settings.tsx')
    expect(affectedScreenIds('/project/screens/parts/new.ts', [broken], folder)).toEqual(['settings'])
  })

  test('ends on a cycle of imports', () => {
    const a = node('/project/screens/a.tsx')
    const b = node('/project/screens/b.tsx', [a])
    a.importers = new Set([b])
    expect(affectedScreenIds('/project/screens/a.tsx', [a], folder).sort()).toEqual(['a', 'b'])
  })

  test('gives no id for a file outside the screens folder, or a module with no file', () => {
    const virtual = node(null)
    const theme = node('/project/packs/demo/library/theme.ts', [virtual])
    expect(affectedScreenIds('/project/packs/demo/library/theme.ts', [theme], folder)).toEqual([])
    expect(affectedScreenIds('/project/screens-old/home.tsx', [], folder)).toEqual([])
  })
})
