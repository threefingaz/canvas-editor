// The test checks the value against the parser of the editor
// (`src/editor/locate/fiber.ts`), a module with DOM types; the Node config of
// `tools/` has no DOM library of its own.
/// <reference lib="dom" />

import { describe, expect, test } from 'vitest'
import { locationPrefix, parseLoc, setMark } from '../src/editor/locate/fiber.ts'
import type { LibrarySources } from './jsx.ts'
import { addSourceLocations, locationPrefix as buildPrefix, screenModuleFile, setMark as buildMark } from './source-location.ts'

const file = 'screens/onboarding/welcome.tsx'
const library: LibrarySources = { packages: ['@mui/material'], folders: [] }

// The code after the step, or a failure when the step gives no change.
function changed(code: string, relativeFile = file, libraryPackage: LibrarySources | null = library) {
  const result = addSourceLocations(code, relativeFile, libraryPackage)
  if (!result) throw new Error('expected a change')
  return result.code
}

// The values of the location attributes of the code after the step.
function values(code: string, libraryPackage: LibrarySources | null = library): string[] {
  return [...changed(code, file, libraryPackage).matchAll(/data-loc-\d+-\d+=\{("[^"]*")\}/g)].map((match) => JSON.parse(match[1]) as string)
}

describe('addSourceLocations', () => {
  test('adds the location to a host element', () => {
    expect(changed('const a = <div>x</div>')).toBe(
      `const a = <div data-loc-1-11={"${file}:1:11 div host"}>x</div>`,
    )
  })

  test('adds the location to a component element', () => {
    expect(changed('const a = <Button>x</Button>')).toBe(
      `const a = <Button data-loc-1-11={"${file}:1:11 Button local"}>x</Button>`,
    )
  })

  test('adds the location to a self-closing element, before `/>`', () => {
    expect(changed('const a = <Divider />')).toBe(`const a = <Divider data-loc-1-11={"${file}:1:11 Divider local"} />`)
    expect(changed('const a = <br/>')).toBe(`const a = <br data-loc-1-11={"${file}:1:11 br host"}/>`)
  })

  test('puts the location after the other attributes and a spread', () => {
    const code = 'const a = <Button variant="text" {...props} data-x={1}>x</Button>'
    expect(changed(code)).toBe(
      `const a = <Button variant="text" {...props} data-x={1} data-loc-1-11={"${file}:1:11 Button local"}>x</Button>`,
    )
    const selfClosing = 'const a = <Input {...props} disabled />'
    expect(changed(selfClosing)).toBe(
      `const a = <Input {...props} disabled data-loc-1-11={"${file}:1:11 Input local"} />`,
    )
  })

  test('adds the location to an element on more than one line', () => {
    const code = [
      'const a = (',
      '  <Stack',
      '    spacing={2}',
      '    direction="row"',
      '  >',
      '    x',
      '  </Stack>',
      ')',
    ].join('\n')
    const expected = code.replace('direction="row"', `direction="row" data-loc-2-3={"${file}:2:3 Stack local"}`)
    expect(changed(code)).toBe(expected)
  })

  test('adds the location to each element, inner and outer', () => {
    const code = ['const a = (', '  <Card>', '    <Button>x</Button>', '  </Card>', ')'].join('\n')
    const out = changed(code)
    expect(out).toContain(`<Card data-loc-2-3={"${file}:2:3 Card local"}>`)
    expect(out).toContain(`<Button data-loc-3-5={"${file}:3:5 Button local"}>`)
  })

  test('adds the location to an element with a member name', () => {
    expect(changed('const a = <Card.Header title="t" />')).toBe(
      `const a = <Card.Header title="t" data-loc-1-11={"${file}:1:11 Card.Header local"} />`,
    )
  })

  test('adds the location to a component with a generic type argument', () => {
    expect(changed('const a = <Select<string> value="a">x</Select>')).toBe(
      `const a = <Select<string> value="a" data-loc-1-11={"${file}:1:11 Select local"}>x</Select>`,
    )
  })

  test('line and column are 1-based and point to `<`', () => {
    const code = 'const x = 1\n\n  const a =   <span />'
    const out = changed(code)
    expect(out).toContain(`data-loc-3-15={"${file}:3:15 span host"}`)
    expect(code.split('\n')[2][15 - 1]).toBe('<')
  })

  test('counts the column in UTF-16 code units, also after text that is not ASCII', () => {
    const code = "const a = ['Привет', '👋'] ; const b = <div />"
    const out = changed(code)
    const column = code.indexOf('<div') + 1
    expect(out).toContain(`data-loc-1-${column}={"${file}:1:${column} div host"}`)
    expect(out).toBe(code.replace('<div />', `<div data-loc-1-${column}={"${file}:1:${column} div host"} />`))
  })

  test('keeps a quote or an entity in the file name as it is', () => {
    const out = changed('const a = <p />', 'screens/a "b" &amp;.tsx')
    expect(out).toBe(String.raw`const a = <p data-loc-1-11={"screens/a \"b\" &amp;.tsx:1:11 p host"} />`)
  })

  test('writes the attribute that the editor reads', () => {
    expect(buildPrefix).toBe(locationPrefix)
    expect(buildMark).toBe(setMark)
    expect(changed('const a = <p />')).toContain(` ${locationPrefix}1-11=`)
  })

  test('marks an element that sets a value in the file', () => {
    const out = changed(`const a = <Box sx={{ gap: '16px' }}><Box sx={{ p: 2 }} /><i style={{}} /></Box>`)
    expect(out).toContain(`${file}:1:11 Box local set=16"`)
    expect(changed(`const a = <Box sx={{ p: '24px 64px', color: '#abc', m: '1rem' }} />`)).toContain('Box local set"')
    expect(changed(`const a = <Box sx={{ p: '24px 64px', color: '#abc' }} />`)).toContain('Box local set=24,64,#AABBCC"')
    expect(out).toContain(`Box local"} />`)
    expect(out).toContain(`i host set"`)
  })

  test('gives each element its own attribute name', () => {
    const code = ['const a = (', '  <Fade in>', '    <Card />', '  </Fade>', ')'].join('\n')
    const out = changed(code)
    expect(out).toContain(`<Fade in data-loc-2-3={"${file}:2:3 Fade local"}>`)
    expect(out).toContain(`<Card data-loc-3-5={"${file}:3:5 Card local"} />`)
  })

  test('writes the relative file that it gets', () => {
    expect(changed('const a = <p />', 'screens/a/b.tsx')).toBe(
      'const a = <p data-loc-1-11={"screens/a/b.tsx:1:11 p host"} />',
    )
  })
})

describe('addSourceLocations: tag and origin', () => {
  test('the value is the location, the tag and the origin', () => {
    const code = "import { Stack } from '@mui/material'\nconst a = <Stack />"
    expect(values(code)).toEqual([`${file}:2:11 Stack library`])
  })

  test('a name imported from the library package or from a sub path of it is `library`', () => {
    const code = [
      "import { Button } from '@mui/material'",
      "import Card from '@mui/material/Card'",
      "import * as M from '@mui/material'",
      'const a = <><Button /><Card /><M.Chip /></>',
    ].join('\n')
    expect(values(code).map((value) => value.split(' ').slice(1).join(' '))).toEqual([
      'Button library',
      'Card library',
      'M.Chip library',
    ])
  })

  test('a package with the same start is not the library', () => {
    const code = "import { Icon } from '@mui/material-icons'\nconst a = <Icon />"
    expect(values(code)[0]).toMatch(/ Icon local$/)
  })

  test('an import with an alias takes the origin of its module', () => {
    const code = [
      "import { Button as B } from '@mui/material'",
      "import { Logo as L } from '../parts/logo'",
      'const a = <><B /><L /></>',
    ].join('\n')
    expect(values(code).map((value) => value.split(' ').slice(1).join(' '))).toEqual(['B library', 'L local'])
  })

  test('a lowercase tag is `host`, also a custom element and a namespaced name', () => {
    const code = 'const a = <div><my-element /><svg:rect /></div>'
    expect(values(code).map((value) => value.split(' ').slice(1).join(' '))).toEqual([
      'div host',
      'my-element host',
      'svg:rect host',
    ])
  })

  test('a component of the file and an import from a different module are `local`', () => {
    const code = [
      "import { Brand } from '../parts/brand'",
      'function Row() { return null }',
      'const a = <><Row /><Brand /></>',
    ].join('\n')
    expect(values(code).map((value) => value.split(' ').slice(1).join(' '))).toEqual(['Row local', 'Brand local'])
  })

  test('a member name takes the origin of its first part', () => {
    const code = [
      "import { Card } from '@mui/material'",
      "import { Menu } from './menu'",
      'const a = <><Card.Header /><Menu.Item /><Local.Part /></>',
    ].join('\n')
    expect(values(code).map((value) => value.split(' ').slice(1).join(' '))).toEqual([
      'Card.Header library',
      'Menu.Item local',
      'Local.Part local',
    ])
  })

  test('the tag of a member name with spaces has no spaces', () => {
    const code = "import { Card } from '@mui/material'\nconst a = <Card . Header />"
    expect(values(code)[0]).toBe(`${file}:2:11 Card.Header library`)
  })

  test('each package of the sources and a folder of the host give `library`', () => {
    const sources: LibrarySources = { packages: ['@acme/kit', '@acme/icons'], folders: ['../src/ui'] }
    const code = [
      "import { Button } from '@acme/kit'",
      "import { StarIcon } from '@acme/icons/star'",
      "import { Card } from '../../../src/ui/card'",
      "import { Panel } from '../../../src/ui-old/panel'",
      "import { Row } from '../../parts/row'",
      'const a = <><Button /><StarIcon /><Card /><Panel /><Row /></>',
    ].join('\n')
    // The screen is `screens/onboarding/welcome.tsx` of a project in
    // `canvas/` of the host, thus `../../../src/ui` is `src/ui` of the host.
    expect(values(code, sources).map((value) => value.split(' ').slice(1).join(' '))).toEqual([
      'Button library',
      'StarIcon library',
      'Card library',
      'Panel local',
      'Row local',
    ])
  })

  test('with no library package, an import from any package is `local`', () => {
    const code = [
      "import { Button } from '@mui/material'",
      "import Card from '@mui/material/Card'",
      'const a = <><Button /><Card /><div /></>',
    ].join('\n')
    expect(values(code, null).map((value) => value.split(' ').slice(1).join(' '))).toEqual(['Button local', 'Card local', 'div host'])
  })

  test('the editor reads the value that the step writes', () => {
    const code = "import { Stack } from '@mui/material'\nconst a = <Stack />"
    const value = values(code)[0]
    expect(parseLoc(value)).toEqual({ loc: `${file}:2:11`, file, line: 2, column: 11, tag: 'Stack', origin: 'library' })
  })
})

describe('addSourceLocations: no change', () => {
  test('does not change a fragment', () => {
    expect(addSourceLocations('const a = <>x</>', file, library)).toBeNull()
    expect(addSourceLocations('const a = <Fragment>x</Fragment>', file, library)).toBeNull()
    expect(addSourceLocations('const a = <React.Fragment key="k">x</React.Fragment>', file, library)).toBeNull()
  })

  test('does not change a fragment with a local name', () => {
    const code = "import { Fragment as F } from 'react'\nconst a = <F>x</F>"
    expect(addSourceLocations(code, file, library)).toBeNull()
  })

  test('changes the children of a fragment', () => {
    const out = changed('const a = <><b /></>')
    expect(out).toBe(`const a = <><b data-loc-1-13={"${file}:1:13 b host"} /></>`)
  })

  test('does not change an element that has a location attribute', () => {
    expect(addSourceLocations('const a = <div data-loc-1-1="x:1:1" />', file, library)).toBeNull()
    const out = changed('const a = <div data-loc-1-1="x:1:1"><b /></div>')
    expect(out).toBe(`const a = <div data-loc-1-1="x:1:1"><b data-loc-1-37={"${file}:1:37 b host"} /></div>`)
  })

  test('returns null for a file with no JSX', () => {
    expect(addSourceLocations('export const a = 1 < 2', file, library)).toBeNull()
    expect(addSourceLocations('', file, library)).toBeNull()
  })

  test('returns null for code with a syntax error', () => {
    expect(addSourceLocations('const a = <div>', file, library)).toBeNull()
    expect(addSourceLocations('const = <div />', file, library)).toBeNull()
  })
})

describe('addSourceLocations: source map', () => {
  test('the result has a source map of the file', () => {
    const result = addSourceLocations('const a = <div />', file, library)
    expect(result).not.toBeNull()
    expect(result?.map.version).toBe(3)
    expect(result?.map.sources).toEqual([file])
    expect(result?.map.mappings).not.toBe('')
  })

  test('the source map can name a different source', () => {
    const result = addSourceLocations('const a = <div />', file, library, '/root/screens/onboarding/welcome.tsx')
    expect(result?.map.sources).toEqual(['/root/screens/onboarding/welcome.tsx'])
  })
})

describe('screenModuleFile', () => {
  const root = '/project'

  test('gives the relative path of a screen file', () => {
    expect(screenModuleFile('/project/screens/onboarding/welcome.tsx', root, 'screens')).toBe('screens/onboarding/welcome.tsx')
    expect(screenModuleFile('/project/screens/a.tsx', '/project/', 'screens/')).toBe('screens/a.tsx')
  })

  test('gives the relative path of an own component, with the components folder', () => {
    expect(screenModuleFile('/project/components/Ring.tsx', root, 'components')).toBe('components/Ring.tsx')
    expect(screenModuleFile('/project/components/Ring.tsx', root, 'screens')).toBeNull()
    expect(screenModuleFile('/project/components-old/Ring.tsx', root, 'components')).toBeNull()
    // Only a `.tsx` file gets the locations: the check says so for a `.jsx` own component.
    expect(screenModuleFile('/project/components/Ring.jsx', root, 'components')).toBeNull()
  })

  test('gives null for a .jsx file, which is not a screen', () => {
    expect(screenModuleFile('/project/screens/a.jsx', root, 'screens')).toBeNull()
  })

  test('gives null for a module id with a query', () => {
    expect(screenModuleFile('/project/screens/a.tsx?import', root, 'screens')).toBeNull()
    expect(screenModuleFile('/project/screens/a.tsx?raw', root, 'screens')).toBeNull()
  })

  test('gives null for a file outside the screens folder, or of another kind', () => {
    expect(screenModuleFile('/project/library/provider.tsx', root, 'screens')).toBeNull()
    expect(screenModuleFile('/project/screens-old/a.tsx', root, 'screens')).toBeNull()
    expect(screenModuleFile('/project/screens/parts/brand.ts', root, 'screens')).toBeNull()
    expect(screenModuleFile('/other/screens/a.tsx', root, 'screens')).toBeNull()
  })

  test('reads a Windows separator as a slash', () => {
    expect(screenModuleFile('C:\\work\\screens\\a.tsx', 'C:\\work', 'screens')).toBe('screens/a.tsx')
  })
})
