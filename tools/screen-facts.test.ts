import { describe, expect, it } from 'vitest'
import { isRawValue, linkIds, screenFacts } from './screen-facts.ts'

describe('isRawValue in an object', () => {
  it.each(['1px solid currentColor', 'translateY(-2px)', '16px !important', '14px/20px Inter', 'calc(100% - 2*8px)'])(
    'takes %s',
    (text) => {
      expect(isRawValue(text, true)).toBe(true)
    },
  )

  it.each(['url(#fade)', 'opacity 0.2s', 'repeat(3, 1fr)', 'Inter, sans-serif'])('leaves %s', (text) => {
    expect(isRawValue(text, true)).toBe(false)
    expect(isRawValue(text)).toBe(false)
  })
})

describe('isRawValue', () => {
  it.each(['16px', '24px 64px', '#667085', '#FFF', '1px solid #ccc', 'calc(100% - 16px)', 'rgba(0, 0, 0, 0.2)', '0.875rem', '1.5em', '-4px', 'oklch(60% 0.1 200)'])(
    'takes %s',
    (text) => expect(isRawValue(text)).toBe(true),
  )

  it.each(['100vh', '100%', '1fr', 'center', 'primary.main', 'Up to 20px', 'Order #1234 is ready', '', 'h2', 'row', '2', 'space-between', 'Pay 20px now'])(
    'leaves %s',
    (text) => expect(isRawValue(text)).toBe(false),
  )
})

const code = `import { Box, Button, Stack } from '@lib/core'
import { Fragment } from 'react'
import { Chart } from './chart'

export const meta = { title: 'T', width: 1440 }

export default function Screen() {
  return (
    <Box sx={{ p: 2, minHeight: '100vh' }}>
      <Stack spacing={2} sx={{ gap: '16px', color: wide ? '#fff' : 'text.primary' }}>
        <Button href="#/flow/next" label="Up to 20px">Go</Button>
        <Button href={'#/flow/next/'} sx={{ border: \`1px solid red\` }}>Again</Button>
        <a href="#fade">x</a>
      </Stack>
      <Fragment>
        <div style={{ padding: 8 }} title="12px">plain</div>
        <Box sx={{ fontSize: 14 }} />
        <Box sx={{ width: \`\${share}%\`, p: 2 }} />
        <Box sx={{ p: 2, width: 480 }} label="#1234" />
        <Chart icon={<Box sx={{ m: '3px' }} />} />
      </Fragment>
    </Box>
  )
}
`

describe('screenFacts', () => {
  const facts = screenFacts(code, 'screens/flow/t.tsx', '@lib/core')

  it('gives each element but a fragment, with its origin', () => {
    expect(facts.elements.map((element) => `${element.tag} ${element.origin}`)).toEqual([
      'Box library',
      'Stack library',
      'Button library',
      'Button library',
      'a host',
      'div host',
      'Box library',
      'Box library',
      'Box library',
      'Chart local',
      'Box library',
    ])
    expect(facts.elements[1]).toMatchObject({ line: 10, column: 7 })
  })

  it('gives the raw values with the place of their element', () => {
    expect(facts.raw.map((raw) => `${raw.line} ${raw.tag} ${raw.attribute} ${raw.text}`)).toEqual([
      '10 Stack sx 16px',
      '10 Stack sx #fff',
      '12 Button sx 1px solid red',
      '20 Box sx 3px',
    ])
  })

  it('gives the elements with a style attribute', () => {
    expect(facts.styles).toEqual([{ line: 16, column: 9, tag: 'div' }])
  })

  it('gives the literal links to a screen', () => {
    expect(facts.links.map((link) => `${link.line} ${link.id}`)).toEqual(['11 flow/next', '12 flow/next'])
    expect(linkIds(facts)).toEqual(['flow/next'])
  })

  it('gives the places of the elements that set a value in the file', () => {
    expect(facts.sets.map((place) => `${place.line}:${place.column}`)).toEqual(['10:7', '12:9', '16:9', '17:9', '18:9', '20:22'])
  })

  it('marks a size of the font in a responsive object, an array and a condition', () => {
    for (const sx of ['{ fontSize: { xs: 12, md: 14 } }', '[{ fontSize: 14 }]', 'wide && { lineHeight: 20 }']) {
      expect(screenFacts(`const a = <Box sx={${sx}} />`, 'screens/a.tsx', null).sets).toHaveLength(1)
    }
  })

  it('reads a text of a person as no raw value, and a value of a style object as one', () => {
    const facts = screenFacts(
      `const a = <List primary="20px" secondary="#1234" fill="url(#fade)" sx={{ border: '1px solid currentColor' }} />`,
      'screens/a.tsx',
      null,
    )
    expect(facts.raw.map((raw) => raw.text)).toEqual(['1px solid currentColor'])
  })

  it('does not mark a computed label of an attribute', () => {
    const labels = screenFacts('const a = <Button aria-label={`Remove ${name}`} sx={{ p: 2 }} />', 'screens/a.tsx', null)
    expect(labels.sets).toEqual([])
  })

  it('has no library element with no library package', () => {
    const none = screenFacts(code, 'screens/flow/t.tsx', null)
    expect(none.elements.every((element) => element.origin !== 'library')).toBe(true)
  })

  it('throws for a syntax error', () => {
    expect(() => screenFacts('const a = <', 'screens/a.tsx', null)).toThrow('screens/a.tsx')
  })
})
