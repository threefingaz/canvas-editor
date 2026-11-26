import { describe, expect, test } from 'vitest'
import { parseTokens, tokensAt, type Token } from './format.ts'
import { isColorText, joinQuery, mediaHoldsWithin, orderMedia, tokensFromCss, variablesFromCss, widthRange } from './from-css.ts'

// A stylesheet with each case of the test with a CSS library: rem lengths on
// a root font size that changes at a breakpoint, a gap scale redefined in a
// media rule, aliases on the root, and nested rules.
const library = `
/* The tokens of the widget library. { not a rule } */
@font-face { font-family: Widget; src: url("widget.woff2"); }
@layer base;

html { font-size: 16px; }

:root {
  --color-primary: #1F4FD8;
  --color-surface: rgb(255 255 255 / 0.9);
  --color-text: var(--color-ink);
  --color-ink: #101828;
  --gap-s: 0.5rem;
  --gap-m: 16px;
  --radius-xl: 1rem;
  --widget-radius: var(--radius-xl);
  --shadow-card: 0 1px 2px rgba(16, 24, 40, 0.1);
  --border-width-thin: 1px;
  --font-size-body: 1rem;
  --font-family: "Widget; {sans}", sans-serif;
  --gap-l: calc(var(--gap-m) * 2);
  --missing: var(--nothing);
  --fallback-gap: var(--nothing, 4px);
  --loop-a: var(--loop-b);
  --loop-b: var(--loop-a);

  &.dark { --color-primary: #ffffff; }
  @media (min-width: 1200px) { --gap-m: 20px; }
}

@media (width < 767px) {
  html { font-size: 14px; }
  :root { --gap-m: 12px; }
}

.button { --color-primary: red; padding: var(--gap-s); }
:root[data-theme='dark'] { --color-ink: #ffffff; }

@layer theme {
  :root { --radius-s: 4px; }
}
`

const tokens = tokensFromCss(library)

function token(id: string): Token {
  const found = tokens.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`no token ${id}`)
  return found
}

describe('tokensFromCss', () => {
  test('gives a color token with its variable as the code', () => {
    expect(token('color-primary')).toEqual({
      id: 'color-primary',
      group: 'color',
      name: 'color-primary',
      value: '#1F4FD8',
      cssVar: '--color-primary',
      code: 'var(--color-primary)',
    })
    expect(token('color-surface')).toMatchObject({ group: 'color', value: 'rgb(255 255 255 / 0.9)' })
  })

  test('follows an alias to a variable that is declared later', () => {
    expect(token('color-text')).toMatchObject({ group: 'color', value: '#101828', cssVar: '--color-text' })
    expect(token('widget-radius')).toMatchObject({ group: 'radius', value: '16px', cssVar: '--widget-radius' })
  })

  test('gives rem lengths in px, with media values where the root font size changes', () => {
    expect(token('gap-s')).toMatchObject({
      group: 'spacing',
      value: '8px',
      media: [{ query: '(width < 767px)', value: '7px' }],
    })
    expect(token('widget-radius').media).toEqual([{ query: '(width < 767px)', value: '14px' }])
  })

  test('gives the media values of a variable that a media rule redefines, also in a nested rule', () => {
    expect(token('gap-m')).toMatchObject({
      value: '16px',
      media: [
        { query: '(min-width: 1200px)', value: '20px' },
        { query: '(width < 767px)', value: '12px' },
      ],
    })
  })

  test('computes a calc of px and numbers, in each context', () => {
    expect(token('gap-l')).toMatchObject({
      group: 'spacing',
      value: '32px',
      media: [
        { query: '(min-width: 1200px)', value: '40px' },
        { query: '(width < 767px)', value: '24px' },
      ],
    })
  })

  test('takes the group from the kind of the value and the words of the name', () => {
    expect(token('shadow-card').group).toBe('shadow')
    expect(token('border-width-thin').group).toBe('stroke')
    expect(token('radius-s')).toMatchObject({ group: 'radius', value: '4px' })
    expect(token('fallback-gap')).toMatchObject({ group: 'spacing', value: '4px' })
  })

  test('leaves out a length with no group word, a text, an unresolved variable and a loop', () => {
    const ids = tokens.map((candidate) => candidate.id)
    for (const id of ['font-size-body', 'font-family', 'missing', 'loop-a', 'loop-b']) {
      expect(ids, id).not.toContain(id)
    }
  })

  test('reads only the root rules: no class rule, no variant of the root, no nested variant, no font face', () => {
    expect(token('color-primary').media).toBeUndefined()
    expect(token('color-ink').value).toBe('#101828')
    expect(tokens.filter((candidate) => candidate.id === 'color-primary')).toHaveLength(1)
  })

  test('keeps the sequence of the first declaration', () => {
    expect(tokens.map((candidate) => candidate.id)).toEqual([
      'color-primary',
      'color-surface',
      'color-text',
      'color-ink',
      'gap-s',
      'gap-m',
      'radius-xl',
      'widget-radius',
      'shadow-card',
      'border-width-thin',
      'gap-l',
      'fallback-gap',
      'radius-s',
    ])
  })

  test('gives tokens that parse, and whose media values tokensAt takes', () => {
    expect(parseTokens({ tokens })).toEqual(tokens)
    const narrow = tokensAt(tokens, (query) => query === '(width < 767px)')
    expect(narrow.find((candidate) => candidate.id === 'gap-s')?.value).toBe('7px')
  })

  test('takes the name rules of the options first, and their code', () => {
    const list = tokensFromCss(library, {
      rules: [
        { match: /^--font-size-/, group: 'spacing' },
        { match: /^--shadow-/, group: null },
      ],
      code: (name) => name.slice(2),
    })
    expect(list.find((candidate) => candidate.id === 'font-size-body')).toMatchObject({ group: 'spacing', value: '16px', code: 'font-size-body' })
    expect(list.some((candidate) => candidate.id === 'shadow-card')).toBe(false)
  })

  test('takes the root font size of the options and a percent of it', () => {
    const list = tokensFromCss(':root { font-size: 62.5%; --space-2: 2rem; }', { rootFontSize: 20 })
    expect(list[0].value).toBe('25px')
  })

  test('reads a root font size through a variable, also one that a media rule redefines', () => {
    const css = ':root { --root-fs: 14px; font-size: var(--root-fs); --space-1: 1rem; } @media (min-width: 768px) { :root { --root-fs: 18px; } }'
    expect(tokensFromCss(css).find((candidate) => candidate.id === 'space-1')).toMatchObject({
      value: '14px',
      media: [{ query: '(min-width: 768px)', value: '18px' }],
    })
  })

  test('reads a variable of a media rule for all as one with no condition', () => {
    expect(tokensFromCss('@media all { :root { --space-2: 8px; } }')).toMatchObject([{ id: 'space-2', value: '8px' }])
  })

  test('reads a unit and the keyword none in each case', () => {
    const list = tokensFromCss(':root { font-size: 20PX; --space-a: 16PX; --space-b: calc(2PX * 3); --space-c: 1REM; --shadow-flat: NONE; }')
    const value = (id: string) => list.find((candidate) => candidate.id === id)?.value
    expect(value('space-a')).toBe('16PX')
    expect(value('space-b')).toBe('6px')
    expect(value('space-c')).toBe('20px')
    expect(list.some((candidate) => candidate.id === 'shadow-flat')).toBe(false)
  })

  test('takes other root selectors from the options', () => {
    expect(tokensFromCss('.theme { --gap-1: 4px; }')).toEqual([])
    expect(tokensFromCss('.theme { --gap-1: 4px; }', { rootSelectors: ['.theme'] })).toHaveLength(1)
  })

  test('joins the conditions of nested media rules, and drops !important', () => {
    const list = tokensFromCss(`
      :root { --gap-1: 4px !important; }
      @media screen { @media (min-width: 900px) { :root { --gap-1: 6px; } } }
    `)
    expect(list[0]).toMatchObject({ value: '4px', media: [{ query: 'screen and (min-width: 900px)', value: '6px' }] })
  })

  test('joins a media list of nested rules query by query', () => {
    const list = tokensFromCss(`
      :root { --gap-1: 4px; }
      @media screen, print { @media (min-width: 900px) { :root { --gap-1: 6px; } } }
    `)
    expect(list[0].media).toEqual([{ query: 'screen and (min-width: 900px), print and (min-width: 900px)', value: '6px' }])
  })

  test('reads a rem as a word of its own, a var in each case, and a quoted text in a call', () => {
    const list = tokensFromCss(`:root {
      --gap-1: 2REM;
      --gap-2: VAR(--gap-1);
      --gap-3: var(--none, var(--gap-1));
      --shadow-icon: url(icon-2rem.svg);
      --gap-4: var(--none, ")") ;
    }`)
    const value = (id: string) => list.find((token) => token.id === id)?.value
    expect(value('gap-1')).toBe('32px')
    expect(value('gap-2')).toBe('32px')
    expect(value('gap-3')).toBe('32px')
    expect(value('shadow-icon')).toBe('url(icon-2rem.svg)')
    expect(variablesFromCss(':root { --x: var(--none, ")"); }')['--x'].value).toBe('")"')
  })

  test('computes each calc it can, also after one that it cannot, and a sign before a bracket', () => {
    const variables = variablesFromCss(`:root {
      --a: calc(100% - 8px) calc(2 * 8px);
      --b: -webkit-calc(2 * 8px);
      --c: calc(-(2px + 2px) * 2);
    }`)
    expect(variables['--a'].value).toBe('calc(100% - 8px) 16px')
    expect(variables['--b'].value).toBe('-webkit-calc(2 * 8px)')
    expect(variables['--c'].value).toBe('-8px')
  })

  test('a declaration after a media rule wins over it, as in the stylesheet', () => {
    const list = tokensFromCss('@media (min-width: 900px) { :root { --gap-1: 6px; } } :root { --gap-1: 4px; }')
    expect(list[0].value).toBe('4px')
    expect(list[0].media).toBeUndefined()
  })

  test('leaves out a variable that only a media rule declares', () => {
    expect(tokensFromCss('@media (min-width: 900px) { :root { --gap-1: 6px; } }')).toEqual([])
  })

  test('reads on after a selector with escaped quotes, brackets and braces', () => {
    const css = String.raw`.content-\['x'\] { content: 'x'; } .w-\{1\} { width: 1px; } :root { --gap-1: 4px; }`
    expect(tokensFromCss(css).map((item) => item.id)).toEqual(['gap-1'])
  })

  test('a condition with its own root font size gives no entry to a value that has no rem', () => {
    const css = [
      ':root { --gap-1: 4px; --space-1: 1rem; }',
      '@media (prefers-color-scheme: dark) { :root { --gap-1: 6px; } }',
      '@media (width < 600px) { :root { font-size: 14px; } }',
    ].join(' ')
    const list = tokensFromCss(css)
    // The rule of the font size does not set the gap: the dark value stays
    // in a narrow frame.
    expect(list.find((item) => item.id === 'gap-1')?.media).toEqual([{ query: '(prefers-color-scheme: dark)', value: '6px' }])
    expect(list.find((item) => item.id === 'space-1')?.media).toEqual([{ query: '(width < 600px)', value: '14px' }])
  })
})

describe('isColorText', () => {
  test('takes hex, color functions and the keywords that the editor reads', () => {
    for (const text of ['#fff', '#1F4FD8', 'rgba(0, 0, 0, 0.5)', 'oklch(70% 0.1 200)', 'transparent', 'White']) {
      expect(isColorText(text), text).toBe(true)
    }
    expect(isColorText('color(display-p3 1 0 0 / ")")')).toBe(true)
    for (const text of ['8px', 'red', 'var(--x)', '#12', '#12345', '#1234567', '1px solid #000', 'rgba(0,0,0,0.1) 0 1px 2px, 0 2px 4px rgba(0,0,0,0.05)']) {
      expect(isColorText(text), text).toBe(false)
    }
  })
})

describe('tokensFromCss on a stylesheet that is not complete', () => {
  test('gives a finite list and does not throw', () => {
    const broken = [
      ':root { --color-primary: #1F4FD8;',
      ':root { --gap-m: 16px; } .a { content: "cut',
      '@media (min-width: 900px)',
      '@media (min-width: 900px) { :root { --gap-m: 20px; }',
      '} } :root { --gap-s: 8px; }',
      ':root { --x: var(--y',
      '/* a comment with no end :root { --gap-m: 4px; }',
      '',
    ]
    for (const css of broken) {
      const list = tokensFromCss(css)
      expect(Array.isArray(list), css).toBe(true)
      expect(list.length, css).toBeLessThan(10)
    }
    expect(tokensFromCss('} } :root { --gap-s: 8px; }').map((token) => token.code)).toEqual(['var(--gap-s)'])
  })
})

// Two media conditions that overlap: the root font size changes at one width
// and a gap at a width that is 1px less.
const overlap = `
:root { font-size: 118%; --gap-xs: 0.5rem; --gap-fixed: 4px; --font-size-xl: 1.5rem; --font-weight-bold: 700; }
@media (width < 768px) { :root { font-size: 100%; } }
@media (width < 767px) { :root { --gap-xs: 0.35rem; } }
`

const overlapReversed = `
:root { font-size: 118%; --gap-xs: 0.5rem; }
@media (width < 767px) { :root { --gap-xs: 0.35rem; } }
@media (width < 768px) { :root { font-size: 100%; } }
`

function widthHolds(width: number) {
  return (query: string) => {
    const range = widthRange(query)
    if (!range) return false
    const low = range.minOpen ? width > range.min : width >= range.min
    const high = range.maxOpen ? width < range.max : width <= range.max
    return low && high
  }
}

function valueAtWidth(list: Token[], id: string, width: number) {
  return tokensAt(list, widthHolds(width)).find((candidate) => candidate.id === id)?.value
}

describe('tokensFromCss with media conditions that overlap', () => {
  test('computes the value of a narrower condition with the root font size of a wider one', () => {
    expect(tokensFromCss(overlap)[0]).toMatchObject({
      id: 'gap-xs',
      value: '9.44px',
      media: [
        { query: '(width < 768px)', value: '8px' },
        { query: '(width < 767px)', value: '5.6px' },
      ],
    })
  })

  test('gives the value of the page at each width through tokensAt', () => {
    for (const css of [overlap, overlapReversed]) {
      const list = tokensFromCss(css)
      expect(valueAtWidth(list, 'gap-xs', 1280)).toBe('9.44px')
      expect(valueAtWidth(list, 'gap-xs', 767)).toBe('8px')
      expect(valueAtWidth(list, 'gap-xs', 390)).toBe('5.6px')
    }
  })

  test('puts the wider condition first, also when the stylesheet has it last', () => {
    expect(tokensFromCss(overlapReversed)[0].media).toEqual([
      { query: '(width < 768px)', value: '8px' },
      { query: '(width < 767px)', value: '5.6px' },
    ])
  })

  test('a later declaration of a wider condition wins over a narrower one, as in the stylesheet', () => {
    const list = tokensFromCss(`
      :root { --gap-1: 8px; }
      @media (max-width: 600px) { :root { --gap-1: 4px; } }
      @media (max-width: 900px) { :root { --gap-1: 6px; } }
    `)
    expect(list[0].media).toEqual([{ query: '(max-width: 900px)', value: '6px' }])
    expect(valueAtWidth(list, 'gap-1', 390)).toBe('6px')
  })

  test('keeps an entry that puts the base value back in a narrower condition', () => {
    const list = tokensFromCss(`
      :root { --gap-1: 8px; }
      @media (width < 768px) { :root { --gap-1: 6px; } }
      @media (width < 500px) { :root { --gap-1: 8px; } }
    `)
    expect(list[0].media).toEqual([
      { query: '(width < 768px)', value: '6px' },
      { query: '(width < 500px)', value: '8px' },
    ])
    expect(valueAtWidth(list, 'gap-1', 390)).toBe('8px')
    expect(valueAtWidth(list, 'gap-1', 600)).toBe('6px')
  })

  test('keeps an entry of the base value when a condition that only overlaps it has a different value', () => {
    const list = tokensFromCss(`
      :root { --gap-1: 8px; }
      @media (min-width: 600px) { :root { --gap-1: 6px; } }
      @media (max-width: 900px) { :root { --gap-1: 8px; } }
    `)
    expect(list[0].media).toEqual([
      { query: '(min-width: 600px)', value: '6px' },
      { query: '(max-width: 900px)', value: '8px' },
    ])
    expect(valueAtWidth(list, 'gap-1', 700)).toBe('8px')
  })

  test('a narrower condition that declares nothing of a variable gives it no entry: an overlapping later condition wins there', () => {
    const list = tokensFromCss(`
      :root { --gap-1: 8px; --gap-2: 2px; }
      @media (width < 768px) { :root { --gap-1: 4px; } }
      @media (min-width: 600px) { :root { --gap-1: 6px; } }
      @media (width < 700px) { :root { --gap-2: 3px; } }
    `)
    expect(list[0].media).toEqual([
      { query: '(width < 768px)', value: '4px' },
      { query: '(min-width: 600px)', value: '6px' },
    ])
    expect(valueAtWidth(list, 'gap-1', 650)).toBe('6px')
    expect(valueAtWidth(list, 'gap-1', 500)).toBe('4px')
    expect(valueAtWidth(list, 'gap-1', 800)).toBe('6px')
    expect(valueAtWidth(list, 'gap-2', 650)).toBe('3px')
  })

  test('a condition that is not only about the width counts as one that overlaps each other one', () => {
    const list = tokensFromCss(`
      :root { --gap-1: 8px; }
      @media (prefers-reduced-motion: reduce) { :root { --gap-1: 4px; } }
      @media (width < 768px) { :root { --gap-1: 8px; } }
    `)
    expect(list[0].media).toEqual([
      { query: '(prefers-reduced-motion: reduce)', value: '4px' },
      { query: '(width < 768px)', value: '8px' },
    ])
  })

  test('a condition that is not only about the width takes the declarations of its own text only', () => {
    const list = tokensFromCss(`
      :root { font-size: 20px; --gap-1: 1rem; }
      @media (width < 768px) { :root { font-size: 10px; } }
      @media screen and (width < 600px) { :root { --gap-1: 2rem; } }
    `)
    expect(list[0].media).toEqual([
      { query: '(width < 768px)', value: '10px' },
      { query: 'screen and (width < 600px)', value: '40px' },
    ])
  })
})

describe('widthRange', () => {
  test('reads the conditions of the width', () => {
    expect(widthRange('(width < 767px)')).toEqual({ min: -Infinity, minOpen: false, max: 767, maxOpen: true })
    expect(widthRange('(width <= 767px)')).toMatchObject({ max: 767, maxOpen: false })
    expect(widthRange('(width > 600px)')).toMatchObject({ min: 600, minOpen: true, max: Infinity })
    expect(widthRange('(WIDTH >= 600px)')).toMatchObject({ min: 600, minOpen: false })
    expect(widthRange('(max-width: 48em)')).toMatchObject({ max: 768, maxOpen: false })
    expect(widthRange('(min-width:37.5rem)')).toMatchObject({ min: 600, minOpen: false })
    expect(widthRange('(600px <= width)')).toMatchObject({ min: 600, minOpen: false })
    expect(widthRange('(600px <= width < 900px)')).toEqual({ min: 600, minOpen: false, max: 900, maxOpen: true })
    expect(widthRange('(min-width: 600px) and (max-width: 900px)')).toMatchObject({ min: 600, max: 900 })
  })

  test('gives null for each other condition', () => {
    for (const query of [
      'screen',
      'screen and (min-width: 900px)',
      '(prefers-color-scheme: dark)',
      '(min-width: 600px), (max-width: 400px)',
      'not (width < 600px)',
      '(height < 600px)',
      '(width < 50vw)',
      '(min-width: 900px) and (max-width: 600px)',
      '(600px <= width >= 900px)',
      '',
    ]) {
      expect(widthRange(query), query).toBeNull()
    }
  })
})

describe('mediaHoldsWithin and orderMedia', () => {
  test('compares two conditions of the width, and each other condition by its text', () => {
    expect(mediaHoldsWithin('(width < 768px)', '(width < 767px)')).toBe(true)
    expect(mediaHoldsWithin('(width < 767px)', '(width < 768px)')).toBe(false)
    expect(mediaHoldsWithin('(max-width: 767px)', '(width < 767px)')).toBe(true)
    expect(mediaHoldsWithin('(width < 767px)', '(max-width: 767px)')).toBe(false)
    expect(mediaHoldsWithin('(min-width: 600px)', '(max-width: 900px)')).toBe(false)
    expect(mediaHoldsWithin('screen', 'screen')).toBe(true)
    expect(mediaHoldsWithin('screen', 'screen and (width < 600px)')).toBe(false)
  })

  test('puts a condition after each one that it is a part of, and keeps the other sequence', () => {
    expect(orderMedia(['(width < 500px)', 'print', '(min-width: 1200px)', '(width < 768px)', '(width < 600px)'])).toEqual([
      'print',
      '(min-width: 1200px)',
      '(width < 768px)',
      '(width < 600px)',
      '(width < 500px)',
    ])
  })
})

describe('variablesFromCss', () => {
  const variables = variablesFromCss(overlap)

  test('computes a calc of px and numbers, a calc in a calc, and leaves a calc it cannot compute', () => {
    const css = `:root {
  --m: 8px;
  --alias: calc(var(--m) + 2px);
  --nested: calc(var(--alias) * 2);
  --brackets: calc((4px + 2px) * 3 / 2);
  --number: calc(3 / 2);
  --by-zero: calc(8px / 0);
  --squared: calc(8px * 8px);
  --mixed: calc(8px + 1);
  --percent: calc(100% - 8px);
  --by-length: calc(8 / 2px);
  --open: calc((8px + 2px);
}`
    const value = (name: string) => variablesFromCss(css)[name]?.value
    expect(value('--alias')).toBe('10px')
    expect(value('--nested')).toBe('20px')
    expect(value('--brackets')).toBe('9px')
    expect(value('--number')).toBe('1.5')
    for (const name of ['--by-zero', '--squared', '--mixed', '--percent', '--by-length']) {
      expect(value(name), name).toMatch(/^calc\(/)
    }
    // An open bracket takes the rest of the block, as in CSS.
    expect(value('--open')).toMatch(/^calc\(\(8px \+ 2px\)/)
  })

  test('gives each variable of the root rules with its resolved value, also one that is no token', () => {
    expect(Object.keys(variables)).toEqual(['--gap-xs', '--gap-fixed', '--font-size-xl', '--font-weight-bold'])
    expect(variables['--font-size-xl'].value).toBe('28.32px')
    expect(variables['--font-weight-bold'].value).toBe('700')
  })

  test('gives one media value for each condition, in one sequence for all variables', () => {
    expect(variables['--font-size-xl'].media).toEqual([
      { query: '(width < 768px)', value: '24px' },
      { query: '(width < 767px)', value: '24px' },
    ])
    expect(variables['--font-weight-bold'].media).toEqual([
      { query: '(width < 768px)', value: '700' },
      { query: '(width < 767px)', value: '700' },
    ])
    expect(variables['--gap-xs'].media.map((entry) => entry.value)).toEqual(['8px', '5.6px'])
  })

  test('follows an alias and a calc, leaves out what has no value, and takes the options', () => {
    const list = variablesFromCss(library)
    expect(list['--widget-radius']).toEqual({
      value: '16px',
      media: [
        { query: '(min-width: 1200px)', value: '16px' },
        { query: '(width < 767px)', value: '14px' },
      ],
    })
    expect(list['--gap-l'].value).toBe('32px')
    expect(list['--font-size-body'].value).toBe('16px')
    expect(list['--missing']).toBeUndefined()
    expect(list['--loop-a']).toBeUndefined()
    expect(variablesFromCss('.theme { --size: 2rem; }', { rootSelectors: ['.theme'], rootFontSize: 10 })).toEqual({
      '--size': { value: '20px', media: [] },
    })
    expect(variablesFromCss('')).toEqual({})
  })
})

describe('joinQuery', () => {
  test('joins two conditions, and a media type with a condition', () => {
    expect(joinQuery('(min-width: 768px)', '(max-width: 1024px)')).toBe('(min-width: 768px) and (max-width: 1024px)')
    expect(joinQuery('screen', '(min-width: 768px)')).toBe('screen and (min-width: 768px)')
    expect(joinQuery('(min-width: 768px)', 'screen and (hover: hover)')).toBe('screen and (min-width: 768px) and (hover: hover)')
  })

  test('names a media type once, and gives not all for two different ones', () => {
    expect(joinQuery('screen', 'screen and (max-width: 768px)')).toBe('screen and (max-width: 768px)')
    expect(joinQuery('all', 'print')).toBe('print')
    expect(joinQuery('print', 'screen and (min-width: 768px)')).toBe('not all')
  })

  test('keeps the inner query alone after a not before a media type, and puts a not or an or of conditions in brackets', () => {
    expect(joinQuery('not print', '(min-width: 768px)')).toBe('(min-width: 768px)')
    expect(joinQuery('not (hover: hover)', '(min-width: 768px)')).toBe('(not (hover: hover)) and (min-width: 768px)')
    expect(joinQuery('(width < 400px) or (width > 900px)', '(hover: hover)')).toBe('((width < 400px) or (width > 900px)) and (hover: hover)')
  })
})
