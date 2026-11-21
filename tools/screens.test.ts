import { parseSync } from 'vite'
import { describe, expect, test } from 'vitest'
import {
  affectedScreenIds,
  folderPrefix,
  idInFolder,
  inFolder,
  libraryInfo,
  readScreenMeta,
  screenEntry,
  screenIdOf,
  screenList,
  screensModuleCode,
  sortScreens,
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

  test('gives an error for an empty title', () => {
    const code = screen(`export const meta = { title: '', width: 1440 }`)
    expect(() => readScreenMeta(code, file, widths)).toThrow(`${file}: \`meta.title\` must be a text`)
  })

  test('gives an error with the file name for a syntax error', () => {
    const code = screen(`export const meta = { title: 'Welcome', width: 1440`)
    expect(() => readScreenMeta(code, file, widths)).toThrow(`${file}: `)
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
    })
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

describe('sortScreens', () => {
  function entry(flow: string, name: string): ScreenEntry {
    const id = flow ? `${flow}/${name}` : name
    return { id, flow, name, title: name, width: 1440, file: `screens/${id}.tsx` }
  }

  test('sorts by flow, then by name', () => {
    const sorted = sortScreens([
      entry('onboarding', 'welcome'),
      entry('', 'home'),
      entry('account', 'profile'),
      entry('onboarding', 'start'),
    ])
    expect(sorted.map((screen) => screen.id)).toEqual([
      'home',
      'account/profile',
      'onboarding/start',
      'onboarding/welcome',
    ])
  })

  test('does not change the list that is given', () => {
    const list = [entry('b', 'x'), entry('a', 'y')]
    sortScreens(list)
    expect(list.map((screen) => screen.id)).toEqual(['b/x', 'a/y'])
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
      { id: 'home', flow: '', name: 'home', title: 'Home', width: 390, file: 'screens/home.tsx' },
      {
        id: 'onboarding/welcome',
        flow: 'onboarding',
        name: 'welcome',
        title: 'Welcome',
        width: 1440,
        file: 'screens/onboarding/welcome.tsx',
      },
    ])
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
        error: 'screens/onboarding/broken.tsx: the file does not export `meta`',
      },
    ])
  })
})

describe('libraryInfo', () => {
  test('gives the name of the one pack', () => {
    const pack = { name: 'kit', package: '@acme/kit', folder: 'packs/kit' }
    expect(libraryInfo(pack)).toEqual({ name: 'kit' })
  })

  test('gives null with no pack', () => {
    expect(libraryInfo(null)).toBeNull()
  })
})

describe('screensModuleCode', () => {
  const home: ScreenEntry = { id: 'home', flow: '', name: 'home', title: 'Home', width: 390, file: 'screens/home.tsx' }

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
    const code = screensModuleCode([home], { name: 'kit' })
    expect(exportsOf(code)).toEqual({ screens: [home], library: { name: 'kit' } })
    expect(code.endsWith('\n')).toBe(true)
  })

  test('with no pack, carries the screens and a null library', () => {
    const code = screensModuleCode([home], null)
    expect(exportsOf(code)).toEqual({ screens: [home], library: null })
    expect(code).toContain('export const library = null\n')
  })

  test('with no screens, carries an empty list', () => {
    expect(exportsOf(screensModuleCode([], null))).toEqual({ screens: [], library: null })
  })

  test('is valid module code', () => {
    const result = parseSync('virtual.js', screensModuleCode([home], { name: 'kit' }))
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
