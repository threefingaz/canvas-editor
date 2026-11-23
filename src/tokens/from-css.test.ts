import { describe, expect, test } from 'vitest'
import { parseTokens, tokensAt, type Token } from './format.ts'
import { isColorText, tokensFromCss } from './from-css.ts'

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

  test('a declaration after a media rule wins over it, as in the stylesheet', () => {
    const list = tokensFromCss('@media (min-width: 900px) { :root { --gap-1: 6px; } } :root { --gap-1: 4px; }')
    expect(list[0].value).toBe('4px')
    expect(list[0].media).toBeUndefined()
  })

  test('leaves out a variable that only a media rule declares', () => {
    expect(tokensFromCss('@media (min-width: 900px) { :root { --gap-1: 6px; } }')).toEqual([])
  })
})

describe('isColorText', () => {
  test('takes hex, color functions and the keywords that the editor reads', () => {
    for (const text of ['#fff', '#1F4FD8', 'rgba(0, 0, 0, 0.5)', 'oklch(70% 0.1 200)', 'transparent', 'White']) {
      expect(isColorText(text), text).toBe(true)
    }
    for (const text of ['8px', 'red', 'var(--x)', '#12', '1px solid #000']) {
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
