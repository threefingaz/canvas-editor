import { describe, expect, test } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkReport, checkScreens, forbiddenImport, importPath, isOwnComponent, ownComponentFiles, projectReader, screenArgument } from './check.ts'

const lib = { packages: ['@lib/core'], folders: [] }

function file(id: string, body: string, meta = `{ title: '${id}', width: 1440 }`) {
  return {
    file: `screens/${id}.tsx`,
    code: `import { Box, Button } from '${lib.packages[0]}'\nexport const meta = ${meta}\nexport default function S() {\n  return ${body}\n}\n`,
  }
}

describe('checkScreens', () => {
  test('finds nothing in a screen of library parts with scale values', () => {
    const result = checkScreens([file('a/one', `<Box sx={{ p: 2, minHeight: '100vh' }}><Button href="#/a/one">Go</Button></Box>`)], { library: lib })
    expect(result).toEqual({ screens: 1, findings: [], notes: [] })
  })

  test('finds each deviation of a file, in the order of the code', () => {
    const body = `<Box sx={{ gap: '16px' }}>
      <div style={{ color: '#667085' }}>x</div>
      <Button href="#/a/none">Go</Button>
    </Box>`
    const { findings } = checkScreens([file('a/one', body)], { library: lib })
    expect(findings.map((finding) => `${finding.line}:${finding.column} ${finding.kind}`)).toEqual([
      '4:10 raw-value',
      '5:7 not-library',
      '5:7 inline-style',
      '5:7 raw-value',
      '6:7 broken-link',
    ])
    expect(findings[0]).toMatchObject({ screen: 'a/one', file: 'screens/a/one.tsx', text: "Box: '16px' in `sx`" })
    expect(findings[4].text).toBe('Button: link to #/a/none, no screen with this id')
  })

  test('finds a file that is not a screen and a broken relation', () => {
    const result = checkScreens(
      [
        { file: 'screens/a/bad.tsx', code: 'export default () => null' },
        file('a/state', '<Box />', `{ title: 'S', width: 1440, stateOf: 'a/gone' }`),
      ],
      { library: lib },
    )
    expect(result.findings.map((finding) => finding.kind)).toEqual(['file', 'relation'])
    expect(result.findings[0].line).toBeUndefined()
  })

  test('the marker of a part: no finding in an option, a `part` finding where it breaks a rule', () => {
    const block = `<Box>\n      {/* canvas-part */}\n      <Button>Go</Button>\n    </Box>`
    const option = (id: string, body: string) => file(id, body, `{ title: 'O', width: 1440, optionOf: 'a/one' }`)
    const result = checkScreens(
      [
        file('a/one', block),
        option('a/one-option-1', block),
        option('a/one-option-2', block.replace('<Button>', '{/* canvas-part */}<Button>')),
        option('a/one-option-3', `<Box>\n      <Button>Go</Button>\n      {/* canvas-part */}\n    </Box>`),
      ],
      { library: lib },
    )
    expect(result.findings.map((finding) => `${finding.screen} ${finding.kind}`)).toEqual([
      'a/one part',
      'a/one-option-2 part',
      'a/one-option-3 part',
    ])
    expect(result.findings[0].line).toBeUndefined()
  })

  test('takes the widths of the project: a width that it does not have is an error of the file', () => {
    const files = [file('a/one', '<Box />', `{ title: 'One', width: 1280 }`)]
    expect(checkScreens(files, { library: lib }).findings.map((finding) => finding.kind)).toEqual(['file'])
    expect(checkScreens(files, { library: lib, widths: [1280, 375] }).findings).toEqual([])
  })

  test('with no library, finds no element that is not from the library', () => {
    const { findings } = checkScreens([file('a/one', `<div><Box sx={{ p: '3px' }} /></div>`)], { library: null })
    expect(findings.map((finding) => finding.kind)).toEqual(['raw-value'])
  })

  test('reports only the named screens, and reads the links against the whole list', () => {
    const files = [file('a/one', `<Button href="#/a/two">Go</Button>`), file('a/two', `<i />`)]
    const result = checkScreens(files, { library: lib, only: ['a/one'] })
    expect(result).toEqual({ screens: 1, findings: [], notes: [], named: ['a/one'] })
  })

  test('finds a flow.json that is not valid, as a finding of the kind file', () => {
    const files = [file('a/one', `<Button href="#/b/two">Go</Button>`), file('b/two', `<Box />`)]
    const flows = [
      { flow: 'a', file: 'screens/a/flow.json', text: '{ "order": ["one", "one"] }' },
      { flow: 'b', file: 'screens/b/flow.json', text: '{ "order": ["two"] }' },
    ]
    expect(checkScreens(files, { library: lib, flows }).findings).toEqual([
      { kind: 'file', screen: 'a', file: 'screens/a/flow.json', text: "the sequence of the row: `order` names 'one' two times" },
    ])
    // With named screens, only the file of their flows.
    expect(checkScreens(files, { library: lib, flows, only: ['b/two'] }).findings).toEqual([])
    expect(checkScreens(files, { library: lib, flows, only: ['a/one'] }).findings).toHaveLength(1)
  })

  test('notes the block of each option, and names the screens of the arguments', () => {
    const block = `<Box>\n      {/* canvas-part */}\n      <Button>Go</Button>\n    </Box>`
    const option = (id: string, body: string) => file(id, body, `{ title: 'O', width: 1440, optionOf: 'a/one' }`)
    const files = [file('a/one', '<Box />'), option('a/one-option-1', block), option('a/one-option-2', '<Box />')]
    const result = checkScreens(files, { library: lib, only: ['a/one-option-1', 'a/one-option-2'] })
    expect(result.notes.map((note) => note.text)).toEqual([
      expect.stringMatching(/^screens\/a\/one-option-1\.tsx: an option of a\/one; its block is <Button> at \d+:\d+$/),
      'screens/a/one-option-2.tsx: an option of a/one with no marker `canvas-part`: the canvas shows the whole screen',
    ])
    expect(result.named).toEqual(['a/one-option-1', 'a/one-option-2'])
    expect(checkReport(result)).toContain('Checked: a/one-option-1, a/one-option-2.')
  })

  describe('own components', () => {
    const screenWith = (source: string, id = 'a/one') => ({
      file: `screens/${id}.tsx`,
      code: `import { Box } from '${lib.packages[0]}'\nimport { Ring } from '${source}'\nexport const meta = { title: 'A', width: 1440 }\nexport default function S() {\n  return <Box><Ring value={3} /></Box>\n}\n`,
    })
    const ring = `export function Ring() {\n  return <svg style={{ color: '#ff0000' }}><circle className="a" /></svg>\n}\n`
    const reader = (files: Record<string, string>) => (path: string) => files[path] ?? null
    const texts = (result: { notes: { text: string }[] }) => result.notes.map((note) => note.text)

    test('an own component is a note, not a finding', () => {
      const result = checkScreens([screenWith('../../components/Ring.tsx')], { library: lib, only: ['a/one'] })
      expect(result.findings).toEqual([])
      expect(texts(result)).toEqual(['screens/a/one.tsx: own components, not from the library: Ring'])
    })

    test('a component of the same name above the project, and one next to the screen, are findings', () => {
      for (const source of ['../../../components/Ring.tsx', './Ring.tsx', '../../components-old/Ring.tsx']) {
        const result = checkScreens([screenWith(source)], { library: lib, only: ['a/one'] })
        expect(result.findings.map((finding) => finding.kind), source).toEqual(['import', 'not-library'])
        expect(result.notes, source).toEqual([])
      }
    })

    test('with no library the note is there too, and the check says what the file has', () => {
      const result = checkScreens([screenWith('../../components/Ring.tsx')], { library: null, only: ['a/one'], readFile: reader({ 'components/Ring.tsx': ring }) })
      expect(texts(result)).toEqual([
        'screens/a/one.tsx: own components, not from the library: Ring',
        'components/Ring.tsx: an own component, with 2 plain elements, 1 `style` attribute, 1 raw value, 1 `className` attribute',
      ])
    })

    test('one note for a file that two screens import, and none for the component of a screen that is not checked', () => {
      const files = [screenWith('../../components/Ring.tsx'), screenWith('../../components/Ring.tsx', 'a/two'), screenWith('../../components/Other.tsx', 'a/three')]
      const readFile = reader({ 'components/Ring.tsx': ring, 'components/Other.tsx': ring })
      const result = checkScreens(files, { library: lib, only: ['a/one', 'a/two'], readFile })
      expect(texts(result).filter((text) => text.startsWith('components/'))).toEqual([
        'components/Ring.tsx: an own component, with 2 plain elements, 1 `style` attribute, 1 raw value, 1 `className` attribute',
      ])
      expect(result.notes.find((note) => note.text.startsWith('components/'))?.screen).toBeUndefined()
    })

    test('the note names state, a link, and a file with no deviation', () => {
      const last = (code: string) => texts(checkScreens([screenWith('../../components/Ring')], { library: lib, only: ['a/one'], readFile: reader({ 'components/Ring.tsx': code }) })).at(-1)
      const stateful = `import { useState } from 'react'\nexport function Ring() {\n  const [on] = useState(false)\n  return <b onClick={() => {}}>{on}</b>\n}\n`
      expect(last(stateful)).toBe('components/Ring.tsx: an own component, with 1 plain element, 2 handlers or hooks')
      const linked = `import { Button } from '${lib.packages[0]}'\nexport function Ring() {\n  return <Button href="#/a/one">Go</Button>\n}\n`
      expect(last(linked)).toBe('components/Ring.tsx: an own component, with 1 link to a screen that the check does not read')
      const clean = `import { Box } from '${lib.packages[0]}'\nexport function Ring() {\n  return <Box />\n}\n`
      expect(last(clean)).toBe('components/Ring.tsx: an own component, with no deviation in its code')
    })

    test('an import with no extension: a file, the index of a folder, no file, a file that is not read', () => {
      const last = (files: Record<string, string>) => texts(checkScreens([screenWith('../../components/Ring')], { library: lib, only: ['a/one'], readFile: reader(files) })).at(-1)
      expect(last({ 'components/Ring.tsx': ring })).toContain('components/Ring.tsx: an own component, with 2 plain elements')
      expect(last({ 'components/Ring/index.tsx': ring })).toContain('components/Ring/index.tsx: an own component, with 2 plain elements')
      expect(last({})).toBe('components/Ring: an own component whose file is not found')
      expect(last({ 'components/Ring.tsx': 'export const x = <' })).toContain('components/Ring.tsx: an own component that is not read')
    })

    test('only a `.tsx` file is read: a `.jsx` file and a file with no JSX get a note that says so', () => {
      const last = (files: Record<string, string>) => texts(checkScreens([screenWith('../../components/Ring')], { library: lib, only: ['a/one'], readFile: reader(files) })).at(-1)
      expect(last({ 'components/Ring.jsx': ring })).toBe(
        'components/Ring.jsx: an own component in a `.jsx` file: the editor reads only `.tsx` files, thus its elements cannot be selected',
      )
      expect(last({ 'components/Ring/index.ts': `export { Ring } from './Ring.tsx'` })).toBe(
        'components/Ring/index.ts: a file with no JSX: import each own component from its own file, thus the check reads it',
      )
    })

    test('follows the own components that an own component imports, each one time', () => {
      const outer = `import { Dot } from './Dot.tsx'\nimport './Ring.css'\nimport { Ring as Self } from './Ring.tsx'\nexport function Ring() {\n  return <Dot />\n}\n`
      const dot = `export function Dot() {\n  return <i />\n}\n`
      const result = checkScreens([screenWith('../../components/Ring.tsx')], {
        library: lib,
        only: ['a/one'],
        readFile: reader({ 'components/Ring.tsx': outer, 'components/Dot.tsx': dot, 'components/Ring.css': '.a {}' }),
      })
      expect(texts(result).filter((text) => text.startsWith('components/'))).toEqual([
        'components/Ring.tsx: an own component, with no deviation in its code',
        'components/Dot.tsx: an own component, with 1 plain element',
      ])
    })
  })

  test('notes the screens that no link reaches', () => {
    const files = [file('a/one', '<Box />'), file('a/two', '<Box />')]
    expect(checkScreens(files, { library: lib }).notes).toEqual([
      { screen: 'a/one', text: 'screens/a/one.tsx: no link leads to this screen' },
      { screen: 'a/two', text: 'screens/a/two.tsx: no link leads to this screen' },
    ])
  })
})

describe('screenArgument', () => {
  const entries = [{ id: 'a/one', file: 'screens/a/one.tsx' }]

  test('takes an id or the path of the file', () => {
    expect(screenArgument('a/one', entries)).toBe('a/one')
    expect(screenArgument('./screens/a/one.tsx', entries)).toBe('a/one')
    expect(screenArgument('screens\\a\\one.tsx', entries)).toBe('a/one')
    expect(screenArgument('a/two', entries)).toBeNull()
    // A path from the host root, and an absolute path.
    const place = { cwd: '/h', project: '/h/canvas' }
    expect(screenArgument('canvas/screens/a/one.tsx', entries, place)).toBe('a/one')
    expect(screenArgument('/h/canvas/screens/a/one.tsx', entries, place)).toBe('a/one')
    expect(screenArgument('canvas/screens/a/two.tsx', entries, place)).toBeNull()
  })

  test('takes an absolute path with a drive of Windows', () => {
    const place = { cwd: 'C:/h', project: 'C:/h/canvas' }
    expect(screenArgument('C:\\h\\canvas\\screens\\a\\one.tsx', entries, place)).toBe('a/one')
    expect(screenArgument('canvas\\screens\\a\\one.tsx', entries, place)).toBe('a/one')
    expect(screenArgument('D:/h/canvas/screens/a/one.tsx', entries, place)).toBeNull()
    // `..` above the root of the drive keeps the drive.
    expect(screenArgument('../../../h/canvas/screens/a/one.tsx', entries, place)).toBe('a/one')
  })

  test('takes a path in a different case of the letters, in the case of the disk', () => {
    const place = { cwd: '/h', project: '/h/canvas', real: (path: string) => path.replace('/H/Canvas/', '/h/canvas/') }
    expect(screenArgument('/H/Canvas/screens/a/one.tsx', entries, place)).toBe('a/one')
  })
})

describe('checkReport', () => {
  test('says that there is no finding', () => {
    expect(checkReport({ screens: 2, findings: [], notes: [] })).toBe('No finding in 2 screens.')
  })

  test('lists the findings by file, with the total and the notes', () => {
    const report = checkReport({
      screens: 3,
      findings: [
        { kind: 'relation', screen: 'a/s', file: 'screens/a/s.tsx', text: 'broken' },
        { kind: 'raw-value', screen: 'a/s', file: 'screens/a/s.tsx', line: 4, column: 10, text: "Box: '16px' in `sx`" },
      ],
      notes: [{ screen: 'a/t', text: 'screens/a/t.tsx: no link leads to this screen' }],
    })
    expect(report.split('\n')).toEqual([
      'screens/a/s.tsx',
      '          relation     broken',
      "  4:10    raw-value    Box: '16px' in `sx`",
      '',
      '2 findings in 1 of 3 screens.',
      '',
      'Notes (not findings):',
      '  screens/a/t.tsx: no link leads to this screen',
    ])
  })

  test('counts a finding of a flow.json apart from the screens', () => {
    const flow = { kind: 'file' as const, screen: 'a', file: 'screens/a/flow.json', text: 'not valid' }
    const screen = { kind: 'relation' as const, screen: 'a/s', file: 'screens/a/s.tsx', text: 'broken' }
    expect(checkReport({ screens: 1, findings: [flow], notes: [] }).split('\n').at(-1)).toBe('1 finding in 1 flow.json file.')
    expect(checkReport({ screens: 1, findings: [flow, screen], notes: [] }).split('\n').at(-1)).toBe('2 findings in 1 of 1 screen and 1 flow.json file.')
  })
})

describe('checkScreens with the scale keys of the pack', () => {
  const body = `<Box sx={{ p: 2, padding: 3, fontSize: 14, borderRadius: 1 }} />`

  test('finds a number that stands for pixels', () => {
    const { findings } = checkScreens([file('a/one', body)], { library: lib, scaleKeys: ['padding', 'borderRadius'] })
    expect(findings.map((finding) => `${finding.kind} ${finding.text}`)).toEqual(['raw-value Box: `fontSize: 14` in `sx`, a number of pixels'])
  })

  test('finds no number when the pack has no list', () => {
    expect(checkScreens([file('a/one', body)], { library: lib }).findings).toEqual([])
  })
})

describe('checkScreens and the rules of a picture', () => {
  test('finds a handler, a hook, a class name, an import of a component and a placeholder text', () => {
    const code = `import { Box } from '${lib.packages[0]}'
import { useState } from 'react'
import { Row } from './row.tsx'
export const meta = { title: 'T', width: 1440 }
export default function S() {
  const [on] = useState(false)
  return <Box className="wide" onClick={() => {}}>Lorem ipsum</Box>
}
`
    const { findings } = checkScreens([{ file: 'screens/a/one.tsx', code }], { library: lib })
    expect(findings.map((finding) => `${finding.line} ${finding.kind}`)).toEqual(['3 import', '6 behavior', '7 behavior', '7 class-name', '7 placeholder'])
  })

  test('an import of a folder of the host that the pack names is the library, also with JSX in it', () => {
    const code = `import { Card } from '../../../src/ui/card'
import { Row } from '../../../src/parts/row'
export const meta = { title: 'T', width: 1440 }
export default function S() {
  return <Card><Row /></Card>
}
`
    const isComponent = () => true
    const library = { packages: [], folders: ['../src/ui'] }
    const { findings } = checkScreens([{ file: 'screens/a/one.tsx', code }], { library, isComponent })
    expect(findings.map((finding) => `${finding.line} ${finding.kind} ${finding.text.split(':')[0]}`)).toEqual([
      '2 import the import of \'../../../src/parts/row\'',
      '5 not-library Row',
    ])
  })
})

describe('forbiddenImport', () => {
  const file = 'screens/tools/list.tsx'

  test('leaves an own component of the project, with and with no extension', () => {
    expect(forbiddenImport(file, '../../components/Ring.tsx')).toBe(false)
    expect(forbiddenImport(file, '../../components/Ring', () => true)).toBe(false)
    expect(forbiddenImport(file, '../../components/Ring.css')).toBe(false)
    expect(forbiddenImport(file, '../../../components/Ring.tsx')).toBe(true)
    expect(forbiddenImport(file, '../../components-old/Ring.tsx')).toBe(true)
  })

  test('takes a module with JSX, a file of the tool and a virtual module', () => {
    expect(forbiddenImport(file, './row.tsx')).toBe(true)
    expect(forbiddenImport(file, '../../src/editor/copy.ts')).toBe(true)
    expect(forbiddenImport(file, '../../canvas.config.ts')).toBe(true)
    expect(forbiddenImport(file, '/src/editor/copy.ts')).toBe(true)
    expect(forbiddenImport(file, '/tools/check.ts')).toBe(true)
    expect(forbiddenImport(file, '/canvas.config.ts')).toBe(true)
    expect(forbiddenImport(file, 'virtual:canvas-screens')).toBe(true)
    expect(forbiddenImport(file, '../shared/rows', (path) => path === 'screens/shared/rows')).toBe(true)
  })

  test('leaves plain data, also in a flow with the name of a folder of the tool', () => {
    expect(forbiddenImport(file, './rows.ts')).toBe(false)
    expect(forbiddenImport(file, './rows')).toBe(false)
    expect(forbiddenImport(file, '../tools/data.ts')).toBe(false)
  })

  test('reads an import with a dot in its name as a path with no extension', () => {
    expect(forbiddenImport(file, './step.view', (path) => path === 'screens/tools/step.view')).toBe(true)
    expect(forbiddenImport(file, './step.data.ts', () => true)).toBe(false)
  })
})

describe('importPath', () => {
  test('gives the path relative to the project root, and `../` for a path that leaves it', () => {
    expect(importPath('screens/a/one.tsx', '../../components/Ring.tsx')).toBe('components/Ring.tsx')
    expect(importPath('screens/a/one.tsx', './data.ts')).toBe('screens/a/data.ts')
    expect(importPath('screens/a/one.tsx', '../../../src/ds/index.tsx')).toBe('../src/ds/index.tsx')
    expect(importPath('screens\\a\\one.tsx', '..\\..\\components\\Ring.tsx')).toBe('components/Ring.tsx')
    expect(importPath('components/Ring.tsx', './Dot.tsx')).toBe('components/Dot.tsx')
  })

  test('reads a path that starts with / from the root, not from the folder of the file', () => {
    expect(importPath('screens/a/one.tsx', '/src/editor/copy.ts')).toBe('src/editor/copy.ts')
    expect(importPath('screens/a/one.tsx', '/canvas.config.ts')).toBe('canvas.config.ts')
  })
})

describe('isOwnComponent', () => {
  const file = 'screens/a/one.tsx'

  test('takes a relative import into the components folder of the project', () => {
    expect(isOwnComponent(file, '../../components/Ring.tsx')).toBe(true)
    expect(isOwnComponent(file, '../../components/Ring')).toBe(true)
    expect(isOwnComponent(file, '../../components')).toBe(true)
  })

  test('leaves a folder with the same start, a path above the project, and a package', () => {
    expect(isOwnComponent(file, '../../components-old/Ring.tsx')).toBe(false)
    expect(isOwnComponent(file, '../../../components/Ring.tsx')).toBe(false)
    expect(isOwnComponent(file, 'components/Ring')).toBe(false)
    expect(isOwnComponent(file, './Ring.tsx')).toBe(false)
  })
})

describe('ownComponentFiles', () => {
  test('gives the path as it is with an extension, else the file of a component first', () => {
    expect(ownComponentFiles('components/Ring.tsx')).toEqual(['components/Ring.tsx'])
    expect(ownComponentFiles('components/Ring.jsx')).toEqual(['components/Ring.jsx'])
    expect(ownComponentFiles('components/Ring').slice(0, 2)).toEqual(['components/Ring.tsx', 'components/Ring/index.tsx'])
    expect(ownComponentFiles('components')).toContain('components/index.ts')
  })

  test('a dot in the name is not an extension', () => {
    expect(ownComponentFiles('components/user.card').slice(0, 2)).toEqual(['components/user.card.tsx', 'components/user.card/index.tsx'])
    expect(ownComponentFiles('components/Ring.CSS')).toEqual(['components/Ring.CSS'])
  })
})

describe('projectReader', () => {
  test('reads a file of the project, and nothing above it, no folder and no missing file', () => {
    const root = mkdtempSync(join(tmpdir(), 'canvas-check-'))
    try {
      const project = join(root, 'project')
      mkdirSync(join(project, 'components', 'Folder.tsx'), { recursive: true })
      writeFileSync(join(project, 'components', 'Ring.tsx'), 'ring')
      writeFileSync(join(root, 'outside.tsx'), 'outside')
      const read = projectReader(project)
      expect(read('components/Ring.tsx')).toBe('ring')
      expect(read('components/Folder.tsx')).toBeNull()
      expect(read('components/Missing.tsx')).toBeNull()
      expect(read('../outside.tsx')).toBeNull()
      expect(read('components/../../outside.tsx')).toBeNull()
      expect(read(join(root, 'outside.tsx'))).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
