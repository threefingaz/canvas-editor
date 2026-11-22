import { describe, expect, test } from 'vitest'
import { checkReport, checkScreens, forbiddenImport, screenArgument } from './check.ts'

const lib = '@lib/core'

function file(id: string, body: string, meta = `{ title: '${id}', width: 1440 }`) {
  return {
    file: `screens/${id}.tsx`,
    code: `import { Box, Button } from '${lib}'\nexport const meta = ${meta}\nexport default function S() {\n  return ${body}\n}\n`,
  }
}

describe('checkScreens', () => {
  test('finds nothing in a screen of library parts with scale values', () => {
    const result = checkScreens([file('a/one', `<Box sx={{ p: 2, minHeight: '100vh' }}><Button href="#/a/one">Go</Button></Box>`)], { libraryPackage: lib })
    expect(result).toEqual({ screens: 1, findings: [], notes: [] })
  })

  test('finds each deviation of a file, in the order of the code', () => {
    const body = `<Box sx={{ gap: '16px' }}>
      <div style={{ color: '#667085' }}>x</div>
      <Button href="#/a/none">Go</Button>
    </Box>`
    const { findings } = checkScreens([file('a/one', body)], { libraryPackage: lib })
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
      { libraryPackage: lib },
    )
    expect(result.findings.map((finding) => finding.kind)).toEqual(['file', 'relation'])
    expect(result.findings[0].line).toBeUndefined()
  })

  test('with no library, finds no element that is not from the library', () => {
    const { findings } = checkScreens([file('a/one', `<div><Box sx={{ p: '3px' }} /></div>`)], { libraryPackage: null })
    expect(findings.map((finding) => finding.kind)).toEqual(['raw-value'])
  })

  test('reports only the named screens, and reads the links against the whole list', () => {
    const files = [file('a/one', `<Button href="#/a/two">Go</Button>`), file('a/two', `<i />`)]
    const result = checkScreens(files, { libraryPackage: lib, only: ['a/one'] })
    expect(result).toEqual({ screens: 1, findings: [], notes: [] })
  })

  test('notes the screens that no link reaches', () => {
    const files = [file('a/one', '<Box />'), file('a/two', '<Box />')]
    expect(checkScreens(files, { libraryPackage: lib }).notes).toEqual([
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
})

describe('checkScreens with the scale keys of the pack', () => {
  const body = `<Box sx={{ p: 2, padding: 3, fontSize: 14, borderRadius: 1 }} />`

  test('finds a number that stands for pixels', () => {
    const { findings } = checkScreens([file('a/one', body)], { libraryPackage: lib, scaleKeys: ['padding', 'borderRadius'] })
    expect(findings.map((finding) => `${finding.kind} ${finding.text}`)).toEqual(['raw-value Box: `fontSize: 14` in `sx`, a number of pixels'])
  })

  test('finds no number when the pack has no list', () => {
    expect(checkScreens([file('a/one', body)], { libraryPackage: lib }).findings).toEqual([])
  })
})

describe('checkScreens and the rules of a picture', () => {
  test('finds a handler, a hook, a class name, an import of a component and a placeholder text', () => {
    const code = `import { Box } from '${lib}'
import { useState } from 'react'
import { Row } from './row.tsx'
export const meta = { title: 'T', width: 1440 }
export default function S() {
  const [on] = useState(false)
  return <Box className="wide" onClick={() => {}}>Lorem ipsum</Box>
}
`
    const { findings } = checkScreens([{ file: 'screens/a/one.tsx', code }], { libraryPackage: lib })
    expect(findings.map((finding) => `${finding.line} ${finding.kind}`)).toEqual(['3 import', '6 behavior', '7 behavior', '7 class-name', '7 placeholder'])
  })
})

describe('forbiddenImport', () => {
  const file = 'screens/tools/list.tsx'

  test('takes a module with JSX, a file of the tool and a virtual module', () => {
    expect(forbiddenImport(file, './row.tsx')).toBe(true)
    expect(forbiddenImport(file, '../../src/editor/copy.ts')).toBe(true)
    expect(forbiddenImport(file, '../../canvas.config.ts')).toBe(true)
    expect(forbiddenImport(file, 'virtual:canvas-screens')).toBe(true)
    expect(forbiddenImport(file, '../shared/rows', (path) => path === 'screens/shared/rows')).toBe(true)
  })

  test('leaves plain data, also in a flow with the name of a folder of the tool', () => {
    expect(forbiddenImport(file, './rows.ts')).toBe(false)
    expect(forbiddenImport(file, './rows')).toBe(false)
    expect(forbiddenImport(file, '../tools/data.ts')).toBe(false)
  })
})
