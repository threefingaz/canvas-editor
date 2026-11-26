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

  it.each(['100vh', '100%', '1fr', 'center', 'primary.main', 'Up to 20px', 'Order #1234 is ready', 'Choose a color(s) for this tag', 'Format: rgb(r, g, b)', '', 'h2', 'row', '2', 'space-between', 'Pay 20px now'])(
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
  const facts = screenFacts(code, 'screens/flow/t.tsx', { packages: ['@lib/core'], folders: [] })

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

  it('gives the range of the literal of each link, with its quotes', () => {
    const source = "const a = <><Button href=\"#/a/b\" /><Link href={wide ? '#/a/c' : `#/a/d`} /><Link href={`#/${id}`} /></>"
    const links = screenFacts(source, 'screens/a.tsx', null).links
    expect(links.map((link) => source.slice(link.range.start, link.range.end))).toEqual(['"#/a/b"', "'#/a/c'", '`#/a/d`'])
    expect(links.map((link) => link.id)).toEqual(['a/b', 'a/c', 'a/d'])
  })

  it('gives the places of the elements that set a value in the file', () => {
    expect(facts.sets.map((place) => `${place.line}:${place.column}`)).toEqual(['10:7', '12:9', '16:9', '17:9', '18:9', '20:22'])
  })

  it('marks a size of the font in a responsive object, an array and a condition', () => {
    for (const sx of ['{ fontSize: { xs: 12, md: 14 } }', '[{ fontSize: 14 }]', 'wide && { letterSpacing: 2 }']) {
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

  it('finds a number that stands for pixels where the pack names the keys of its scales', () => {
    const code = `const a = <Box padding={3} sx={{ p: 2, fontSize: 14, borderRadius: 1, gap: 4, marginTop: -8, lineHeight: 1.5, width: 320, mb: 0 }} />`
    const scale = new Set(['padding', 'gap', 'borderRadius'])
    const facts = screenFacts(code, 'screens/a.tsx', null, scale)
    expect(facts.raw.map((raw) => `${raw.attribute} ${raw.text} ${raw.number}`)).toEqual(['sx fontSize: 14 true', 'sx marginTop: -8 true'])
    expect(facts.sets).toHaveLength(1)
    // With no list, a number is no finding, and only a size of the font marks the element.
    expect(screenFacts(code, 'screens/a.tsx', null).raw).toEqual([])
    expect(screenFacts(code, 'screens/a.tsx', null).sets).toHaveLength(1)
    expect(screenFacts('const a = <Box sx={{ marginTop: 8 }} />', 'screens/a.tsx', null).sets).toEqual([])
  })

  it('finds what a picture of one state must not have', () => {
    const code = `import { useState } from 'react'
import { Shared } from './shared.tsx'
import { rows } from './rows'
import { config } from '../../canvas.config.ts'
export default function S() {
  const [open] = useState(false)
  return <Box className="p-4" onClick={() => {}}>Lorem ipsum dolor</Box>
}`
    const facts = screenFacts(code, 'screens/a/s.tsx', null)
    expect(facts.behavior.map((item) => `${item.line} ${item.text}`)).toEqual(['6 the hook `useState`', '7 Box: the handler `onClick`'])
    expect(facts.classNames).toEqual([{ line: 7, column: 10, tag: 'Box' }])
    expect(facts.imports.map((item) => item.source)).toEqual(['./shared.tsx', './rows', '../../canvas.config.ts'])
    expect(facts.placeholders).toEqual([{ line: 7, column: 50 }])
  })

  it('takes a re-export and an `import()` of a text as imports too', () => {
    const code = `export { Panel } from '../../src/editor/App.tsx'
export * from 'virtual:canvas-screens'
const later = () => import('./later.tsx')
const computed = (name: string) => import(name)
export default function S() {
  return <Box />
}`
    const facts = screenFacts(code, 'screens/a/s.tsx', null)
    expect(facts.imports).toEqual([
      { line: 1, column: 1, source: '../../src/editor/App.tsx' },
      { line: 2, column: 1, source: 'virtual:canvas-screens' },
      { line: 3, column: 21, source: './later.tsx' },
    ])
  })

  it('reads no number of a call, and takes a number of the text style and a computed number as a mark', () => {
    const scale = new Set(['padding'])
    expect(screenFacts('const a = <Box sx={{ fontSize: theme.spacing(2) }} />', 'screens/a.tsx', null, scale).raw).toEqual([])
    for (const sx of ['{ lineHeight: 1.2 }', '{ fontWeight: 700 }', '{ fontSize: 14 * 2 }', '{ lineHeight: { xs: 1.2, md: 1.5 } }']) {
      const facts = screenFacts(`const a = <Box sx={${sx}} />`, 'screens/a.tsx', null, scale)
      expect(facts.raw).toEqual([])
      expect(facts.sets).toHaveLength(1)
    }
  })

  it('reads a computed key as no name of a property', () => {
    const facts = screenFacts('const a = <Box sx={{ [fontSize]: 14 }} />', 'screens/a.tsx', null, new Set(['padding']))
    expect(facts.raw).toEqual([])
    expect(facts.sets).toEqual([])
  })

  it('takes a handler with an expression and a hook of React only', () => {
    const code = 'const a = () => { user.useThing(); React[useKey](); React.useMemo(() => 1, []); return <Switch onColor="green" onChange={go} /> }'
    expect(screenFacts(code, 'screens/a.tsx', null).behavior.map((item) => item.text)).toEqual(['the hook `useMemo`', 'Switch: the handler `onChange`'])
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

describe('the source of a local element', () => {
  const code = [
    "import Default from '../../components/Default.tsx'",
    "import { Ring, Ring as Alias } from '../../components/Ring.tsx'",
    "import { Box } from '@lib/core'",
    'function Local() {',
    '  return <i />',
    '}',
    'export default function S() {',
    '  return <Box><Ring /><Ring.Part /><Alias /><Default /><Local /><div /></Box>',
    '}',
  ].join('\n')
  const elements = screenFacts(code, 'screens/a/t.tsx', { packages: ['@lib/core'], folders: [] }).elements
  const sourceOf = (tag: string) => elements.find((element) => element.tag === tag)

  it('is the import of the tag, also for a dotted tag, an alias and a default import', () => {
    expect(sourceOf('Ring')?.source).toBe('../../components/Ring.tsx')
    expect(sourceOf('Ring.Part')?.source).toBe('../../components/Ring.tsx')
    expect(sourceOf('Alias')?.source).toBe('../../components/Ring.tsx')
    expect(sourceOf('Default')?.source).toBe('../../components/Default.tsx')
  })

  it('is not there for a component of the file, a library element and a plain element', () => {
    expect(sourceOf('Local')).toEqual(expect.objectContaining({ origin: 'local' }))
    expect(sourceOf('Local')).not.toHaveProperty('source')
    expect(sourceOf('Box')).not.toHaveProperty('source')
    expect(sourceOf('div')).not.toHaveProperty('source')
  })
})
