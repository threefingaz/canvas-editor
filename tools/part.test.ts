import { describe, expect, test } from 'vitest'
import { addSourceLocations } from './source-location.ts'
import { partFacts, partMarker, partOf } from './part.ts'
import { screenFacts } from './screen-facts.ts'

const file = 'screens/a/one-option-1.tsx'

const screen = (body: string) => `import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'

export const meta = { title: 'One, option 1', width: 1440, optionOf: 'a/one' }

export default function One() {
  return (
${body}
  )
}
`

const marked = screen(`    <Stack>
      <Button>First</Button>
      {/* canvas-part */}
      <Stack direction="row">
        <Button>Second</Button>
      </Stack>
    </Stack>`)

describe('partFacts', () => {
  test('a file with no marker has no part', () => {
    expect(partFacts(screen('    <Stack />'), file)).toEqual({ markers: 0, place: null })
  })

  test('the part is the first JSX element after the marker', () => {
    // Line 11 of the file, the `<` of `<Stack direction="row">`.
    expect(partFacts(marked, file)).toEqual({ markers: 1, place: { line: 11, column: 7 } })
  })

  test('the place is the place of the location of that element', () => {
    const located = addSourceLocations(marked, file, null)!.code
    expect(located).toContain(`data-loc-11-7={"${file}:11:7 Stack local"}`)
  })

  test('a marker before the root element marks the root', () => {
    const code = screen(`    /* canvas-part */
    <Stack>
      <Button>First</Button>
    </Stack>`)
    expect(partFacts(code, file).place).toEqual({ line: 9, column: 5 })
  })

  test('a line comment and spaces around the text count', () => {
    const code = screen(`    // canvas-part
    <Stack />`)
    expect(partFacts(code, file).place).toEqual({ line: 9, column: 5 })
    expect(partFacts(marked.replace('{/* canvas-part */}', '{/*canvas-part*/}'), file).markers).toBe(1)
  })

  test('a comment with more text is not a marker', () => {
    const code = marked.replace('canvas-part', 'canvas-part: the row of buttons')
    expect(partFacts(code, file)).toEqual({ markers: 0, place: null })
  })

  test('the text in a string is not a marker', () => {
    const code = screen(`    <Stack aria-label="canvas-part" />`)
    expect(partFacts(code, file)).toEqual({ markers: 0, place: null })
  })

  test('an element that only contains the marker is not the part', () => {
    const code = screen(`    <Stack>
      <Button>First</Button>
      {/* canvas-part */}
    </Stack>`)
    expect(partFacts(code, file)).toEqual({ markers: 1, place: null })
  })

  test('a fragment after the marker gives its first element', () => {
    const code = screen(`    <Stack>
      {/* canvas-part */}
      <>
        <Button>First</Button>
        <Button>Second</Button>
      </>
    </Stack>`)
    expect(partFacts(code, file).place).toEqual({ line: 11, column: 9 })
  })

  test('two markers give the count and no place', () => {
    const code = marked.replace('<Button>First</Button>', '{/* canvas-part */}\n      <Button>First</Button>')
    expect(partFacts(code, file)).toEqual({ markers: 2, place: null })
  })

  test('a file with a syntax error has no part', () => {
    expect(partFacts(`${marked}\n<`, file)).toEqual({ markers: 0, place: null })
  })
})

describe('the marker in the other readers of a screen file', () => {
  test('the element-to-code step gives the marker no location and keeps each element', () => {
    const plain = addSourceLocations(marked.replace('      {/* canvas-part */}\n', ''), file, null)!.code
    const located = addSourceLocations(marked, file, null)!.code
    const count = (code: string) => code.match(/data-loc-/g)?.length
    expect(count(located)).toBe(count(plain))
    expect(located).toContain(`{/* ${partMarker} */}`)
  })

  test('the static facts of the screen are the same with the marker', () => {
    const facts = screenFacts(marked, file, null)
    const plain = screenFacts(marked.replace('{/* canvas-part */}', ''), file, null)
    expect(facts.elements.map((element) => element.tag)).toEqual(plain.elements.map((element) => element.tag))
    expect(facts.behavior).toEqual([])
    expect(facts.placeholders).toEqual([])
    expect(facts.raw).toEqual([])
  })
})

describe('partOf', () => {
  test('no marker gives nothing', () => {
    expect(partOf({ markers: 0, place: null }, true)).toEqual({})
    expect(partOf({ markers: 0, place: null }, false)).toEqual({})
  })

  test('one marker of an option gives the place', () => {
    expect(partOf({ markers: 1, place: { line: 12, column: 7 } }, true)).toEqual({ part: '12:7' })
  })

  test('a marker in a screen that is not an option is a problem and no part', () => {
    const result = partOf({ markers: 1, place: { line: 12, column: 7 } }, false)
    expect(result.part).toBeUndefined()
    expect(result.problem).toContain('not an option')
  })

  test('more than one marker is a problem and no part', () => {
    const result = partOf({ markers: 2, place: null }, true)
    expect(result.part).toBeUndefined()
    expect(result.problem).toContain('2 markers')
  })

  test('a marker with no element after it is a problem and no part', () => {
    const result = partOf({ markers: 1, place: null }, true)
    expect(result.part).toBeUndefined()
    expect(result.problem).toContain('no JSX element')
  })
})
