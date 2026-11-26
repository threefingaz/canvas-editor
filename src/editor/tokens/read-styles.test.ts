import { describe, expect, test } from 'vitest'
import type { Token } from '../../tokens/format.ts'
import type { DeclarationsLike, RuleLike } from './declarations.ts'
import { matchValue } from './match.ts'
import { readStyles, styleProperties } from './read-styles.ts'

// A plain object in place of a `CSSStyleDeclaration`. A name in `important`
// has the priority `important`.
function declarations(values: Record<string, string>, important: string[] = []): DeclarationsLike {
  return {
    getPropertyValue: (name) => values[name] ?? '',
    getPropertyPriority: (name) => (important.includes(name) && values[name] ? 'important' : ''),
  }
}

// A plain object whose constructor has the name of a CSS rule class, as a
// rule of a frame document has.
function cssRule(name: string, fields: RuleLike): RuleLike {
  const named = { [name]: class {} }[name]
  return Object.assign(new named(), fields)
}

function styleRule(selectorText: string, values: Record<string, string>, important?: string[]): RuleLike {
  return cssRule('CSSStyleRule', { selectorText, style: declarations(values, important) })
}

type Sheet = { disabled?: boolean; media?: { mediaText: string }; cssRules?: RuleLike[]; unreadable?: boolean }

// A node of a frame document with the members that `readStyles` reads. The
// node has the classes in `classes` and the id `id`; it matches a selector of
// ids and classes (`#a.b.c`) when it has each of them. The frame is 1440px
// wide. `children` are its child nodes: a text is a text node, `null` an
// element.
function frameNode(options: {
  classes: string[]
  id?: string
  sheets: Sheet[]
  computed?: Record<string, string>
  inline?: Record<string, string>
  inlineImportant?: string[]
  parent?: Element
  children?: (string | null)[]
}) {
  const window = {
    getComputedStyle: () => declarations(options.computed ?? {}),
    matchMedia: (query: string) => {
      const minWidth = /min-width:\s*(\d+)px/.exec(query)
      return { matches: minWidth ? 1440 >= Number(minWidth[1]) : query !== 'print' }
    },
    CSS: { supports: (condition: string) => condition !== '(display: nothing)' },
  }
  const styleSheets = options.sheets.map((sheet) => ({
    disabled: sheet.disabled ?? false,
    media: sheet.media ?? { mediaText: '' },
    get cssRules() {
      if (sheet.unreadable) throw new Error('SecurityError')
      return sheet.cssRules ?? []
    },
  }))
  const node = {
    ownerDocument: { defaultView: window, styleSheets },
    matches: (selector: string) => {
      if (selector.includes('::') || selector.includes(',')) throw new Error('SyntaxError')
      const names = selector.match(/[.#][\w-]+/g) ?? []
      if (names.join('') !== selector) return false
      return names.every((name) => (name[0] === '#' ? name.slice(1) === options.id : options.classes.includes(name.slice(1))))
    },
    style: options.inline ? declarations(options.inline, options.inlineImportant) : undefined,
    parentElement: options.parent ?? null,
    childNodes: (options.children ?? []).map((child) =>
      child === null ? { nodeType: 1, textContent: 'inner' } : { nodeType: 3, textContent: child },
    ),
  }
  return node as unknown as Element
}

describe('readStyles', () => {
  test('gives the computed value and the declared values of the matching rules', () => {
    const node = frameNode({
      classes: ['button'],
      computed: { 'background-color': 'rgb(31, 79, 216)' },
      sheets: [
        {
          cssRules: [
            styleRule('.button', { 'background-color': 'var(--mui-palette-primary-main, #1f4fd8)' }),
            styleRule('.other', { 'background-color': '#000' }),
          ],
        },
      ],
    })
    const styles = readStyles(node)
    expect(styles.values['background-color']).toEqual({
      group: 'color',
      computed: 'rgb(31, 79, 216)',
      declared: ['var(--mui-palette-primary-main, #1f4fd8)'],
      source: { inline: false },
    })
  })

  test('gives each property of the inspector', () => {
    const styles = readStyles(frameNode({ classes: [], sheets: [] }))
    expect(Object.keys(styles.values)).toEqual(styleProperties.map((entry) => entry.property))
    expect(styles.values['padding-left'].declared).toEqual([])
    expect(styles.values['padding-left'].source).toBeNull()
    expect(styles.values.display.group).toBeNull()
  })

  test('the rule of a media rule that applies at the width of the frame wins, with its condition', () => {
    const node = frameNode({
      classes: ['stack'],
      sheets: [
        {
          cssRules: [
            styleRule('.stack', { 'padding-left': 'calc(2 * var(--mui-spacing, 8px))' }),
            cssRule('CSSMediaRule', { media: { mediaText: '(min-width: 900px)' }, cssRules: [styleRule('.stack', { 'padding-left': 'calc(8 * var(--mui-spacing, 8px))' })] }),
            cssRule('CSSMediaRule', { media: { mediaText: '(min-width: 1536px)' }, cssRules: [styleRule('.stack', { 'padding-left': '1px' })] }),
          ],
        },
      ],
    })
    expect(readStyles(node).values['padding-left']).toMatchObject({
      declared: ['calc(8 * var(--mui-spacing, 8px))'],
      source: { inline: false, media: '(min-width: 900px)' },
    })
  })

  test('skips a sheet that cannot be read, a disabled sheet, and a sheet for print', () => {
    const rule = styleRule('.box', { color: '#000' })
    const node = frameNode({
      classes: ['box'],
      sheets: [
        { unreadable: true },
        { disabled: true, cssRules: [rule] },
        { media: { mediaText: 'print' }, cssRules: [rule] },
        { cssRules: [styleRule('.box', { color: 'var(--mui-palette-text-primary)' })] },
      ],
    })
    expect(readStyles(node).values.color.declared).toEqual(['var(--mui-palette-text-primary)'])
  })

  test('a supports rule that does not apply is left out', () => {
    const node = frameNode({
      classes: ['box'],
      sheets: [
        {
          cssRules: [
            cssRule('CSSSupportsRule', { conditionText: '(display: nothing)', cssRules: [styleRule('.box', { color: '#111' })] }),
            cssRule('CSSSupportsRule', { conditionText: '(display: grid)', cssRules: [styleRule('.box', { color: '#222' })] }),
          ],
        },
      ],
    })
    expect(readStyles(node).values.color.declared).toEqual(['#222'])
  })

  test('a selector that the node cannot test is no match', () => {
    const node = frameNode({ classes: ['box'], sheets: [{ cssRules: [styleRule('.box::before', { color: '#111' })] }] })
    expect(readStyles(node).values.color.declared).toEqual([])
  })

  test('the inline style wins over the rules', () => {
    const node = frameNode({
      classes: ['footer'],
      sheets: [{ cssRules: [styleRule('.footer', { padding: 'var(--mui-spacing)' })] }],
      inline: { 'padding-left': '64px' },
    })
    expect(readStyles(node).values['padding-left']).toMatchObject({ declared: ['64px'], source: { inline: true } })
    expect(readStyles(node).values['padding-top']).toMatchObject({
      declared: ['var(--mui-spacing)'],
      source: { inline: false },
    })
  })

  test('a rule with !important wins over the inline style and over a rule with a higher specificity', () => {
    const node = frameNode({
      classes: ['chip', 'strong'],
      id: 'main',
      sheets: [
        {
          cssRules: [
            styleRule('.chip', { 'row-gap': 'var(--mui-spacing)' }, ['row-gap']),
            styleRule('#main.strong', { 'row-gap': '13px' }),
          ],
        },
      ],
      inline: { 'row-gap': '20px' },
    })
    expect(readStyles(node).values['row-gap']).toMatchObject({
      declared: ['var(--mui-spacing)'],
      source: { inline: false },
    })
  })

  test('an inline style with !important wins over a rule with !important', () => {
    const node = frameNode({
      classes: ['chip'],
      sheets: [{ cssRules: [styleRule('.chip', { 'row-gap': 'var(--mui-spacing)' }, ['row-gap'])] }],
      inline: { 'row-gap': '20px' },
      inlineImportant: ['row-gap'],
    })
    expect(readStyles(node).values['row-gap']).toMatchObject({ declared: ['20px'], source: { inline: true } })
  })

  test('of a selector list, only the part that matches gives the specificity and the selector', () => {
    // `#main, .a` has the specificity of `#main` only for an element with that id.
    const node = frameNode({
      classes: ['a', 'b'],
      sheets: [{ cssRules: [styleRule('#main, .a', { color: '#111' }), styleRule('.a.b', { color: '#222' })] }],
    })
    expect(readStyles(node).values.color).toMatchObject({ declared: ['#222'], source: { inline: false } })
    const withId = frameNode({
      classes: ['a', 'b'],
      id: 'main',
      sheets: [{ cssRules: [styleRule('#main, .a', { color: '#111' }), styleRule('.a.b', { color: '#222' })] }],
    })
    expect(readStyles(withId).values.color).toMatchObject({ declared: ['#111'], source: { inline: false } })
  })

  test('a losing rule with the token variable does not link an equal fixed value that wins', () => {
    // The open issue of the read-only path: the state was `linked`.
    const white: Token = {
      id: 'palette.common.white',
      group: 'color',
      name: 'common.white',
      value: '#fff',
      cssVar: '--mui-palette-common-white',
      code: 'common.white',
    }
    const node = frameNode({
      classes: ['button', 'contained'],
      computed: { 'background-color': 'rgb(255, 255, 255)' },
      sheets: [
        {
          cssRules: [
            styleRule('.button', { 'background-color': 'var(--mui-palette-common-white)' }),
            styleRule('.button.contained', { 'background-color': '#fff' }),
          ],
        },
      ],
    })
    const value = readStyles(node).values['background-color']
    expect(value.declared).toEqual(['#fff'])
    expect(matchValue('color', value.computed, value.declared, [white])).toEqual({ state: 'equal', token: white })
  })

  test('a variable is resolved through the winner among the sources of the element', () => {
    const node = frameNode({
      classes: ['button', 'primary'],
      sheets: [
        {
          cssRules: [
            styleRule('.button', { 'background-color': 'var(--variant-bg)', '--variant-bg': '#000' }),
            styleRule('.button.primary', { '--variant-bg': 'var(--mui-palette-primary-main)' }),
          ],
        },
      ],
    })
    expect(readStyles(node).values['background-color'].declared).toEqual([
      'var(--variant-bg)',
      'var(--mui-palette-primary-main)',
    ])
  })

  test('the text style has the five computed parts, the font texts, and a selector test', () => {
    const node = frameNode({
      classes: ['MuiTypography-body1'],
      computed: {
        'font-family': 'system-ui',
        'font-size': '16px',
        'font-weight': '400',
        'line-height': '24px',
        'letter-spacing': 'normal',
      },
      sheets: [{ cssRules: [styleRule('.MuiTypography-body1', { 'font-size': '1rem', 'font-weight': '400' })] }],
    })
    const { textStyle } = readStyles(node)
    expect(textStyle.computed).toEqual({
      fontFamily: 'system-ui',
      fontSize: '16px',
      fontWeight: '400',
      lineHeight: '24px',
      letterSpacing: 'normal',
    })
    expect(textStyle.texts).toEqual(['1rem', '400'])
    expect(textStyle.matches('.MuiTypography-body1')).toBe(true)
    expect(textStyle.matches('.MuiTypography-h6')).toBe(false)
  })

  test('an inherited property with no declaration of its own reads the nearest parent that declares it', () => {
    const sheets = [
      {
        cssRules: [
          styleRule('.body', { color: 'var(--mui-palette-text-primary)', 'font-size': '1rem', 'padding-left': '8px' }),
          styleRule('.title', { color: 'inherit' }),
          styleRule('.card', { 'font-weight': '500' }),
          styleRule('.title', { 'font-weight': '700' }),
        ],
      },
    ]
    const body = frameNode({ classes: ['body', 'MuiTypography-body1'], sheets })
    const card = frameNode({ classes: ['card'], sheets, parent: body })
    const title = frameNode({ classes: ['title'], sheets, parent: card })
    const styles = readStyles(title)
    expect(styles.values.color).toMatchObject({
      declared: ['var(--mui-palette-text-primary)'],
      source: { inline: false },
    })
    expect(styles.textStyle.texts).toEqual(['1rem', '700'])
    // A property that is not inherited reads only the element.
    expect(styles.values['padding-left'].declared).toEqual([])
    // The selector test is true for a parent with the class too.
    expect(styles.textStyle.matches('.MuiTypography-body1')).toBe(true)
    expect(styles.textStyle.matches('.MuiTypography-h6')).toBe(false)
  })

  test('the selector test leaves out a parent that gives no part of the text style', () => {
    const sheets = [
      {
        cssRules: [
          styleRule('.MuiTypography-body1', { 'font-size': '1rem', 'font-weight': '400' }),
          styleRule('.own', {
            'font-family': 'system-ui',
            'font-size': '16px',
            'font-weight': '400',
            'line-height': '24px',
            'letter-spacing': 'normal',
          }),
        ],
      },
    ]
    const body = frameNode({ classes: ['MuiTypography-body1'], sheets })
    const own = frameNode({ classes: ['own'], sheets, parent: body })
    const plain = frameNode({ classes: ['plain'], sheets, parent: body })
    expect(readStyles(own).textStyle.matches('.MuiTypography-body1')).toBe(false)
    expect(readStyles(plain).textStyle.matches('.MuiTypography-body1')).toBe(true)
  })

  test('the mark of a previewed text style counts on its element and on a node that declares no part of its own', () => {
    const mark = '--canvas-preview-text-style'
    const sheets = [
      {
        cssRules: [
          styleRule(
            '.target',
            { 'font-size': '16px', 'font-weight': '400', [mark]: '"typography.plain"' },
            ['font-size', 'font-weight', mark],
          ),
          styleRule('.raw', { 'font-size': '15px' }),
        ],
      },
    ]
    // The mark inherits: each node computes it.
    const computed = { [mark]: '"typography.plain"' }
    const target = frameNode({ classes: ['target'], sheets, computed })
    const plain = frameNode({ classes: ['plain'], sheets, computed, parent: target })
    const raw = frameNode({ classes: ['raw'], sheets, computed, parent: target })
    expect(readStyles(target).textStyle.previewed).toBe('typography.plain')
    expect(readStyles(plain).textStyle.previewed).toBe('typography.plain')
    // A node inside it that declares its own part does not take the mark.
    expect(readStyles(raw).textStyle.previewed).toBeNull()
  })

  test('a value from a parent is inherited, and an inline text style of a parent is not inline', () => {
    const sheets = [{ cssRules: [styleRule('.title', { 'font-weight': '700' })] }]
    const footer = frameNode({ classes: ['footer'], sheets, inline: { color: '#667085', 'font-size': '14px' } })
    const title = frameNode({ classes: ['title'], sheets, parent: footer })
    const styles = readStyles(title)
    expect(styles.values.color).toMatchObject({ declared: ['#667085'], source: { inline: true }, inherited: true })
    expect(styles.textStyle.inline).toBe(false)
    // The footer itself declares them.
    const own = readStyles(footer)
    expect(own.values.color.inherited).toBeUndefined()
    expect(own.textStyle.inline).toBe(true)
  })

  test('an inherited property declared as inherit or currentcolor reads on to the parent', () => {
    const sheets = [
      {
        cssRules: [
          styleRule('.body', { color: 'var(--mui-palette-text-primary)', 'font-size': '1rem' }),
          styleRule('.button-base', { color: 'inherit' }),
          styleRule('.label', { color: 'currentColor' }),
          styleRule('.input', { font: 'inherit' }),
        ],
      },
    ]
    const body = frameNode({ classes: ['body'], sheets })
    const button = frameNode({ classes: ['button-base'], sheets, parent: body })
    const label = frameNode({ classes: ['label'], sheets, parent: button })
    expect(readStyles(button).values.color.declared).toEqual(['var(--mui-palette-text-primary)'])
    expect(readStyles(label).values.color.declared).toEqual(['var(--mui-palette-text-primary)'])
    // `font: inherit` sets the font size of the element to the size of the parent.
    const input = frameNode({ classes: ['input'], sheets, parent: body })
    expect(readStyles(input).textStyle.texts).toContain('1rem')
    expect(readStyles(input).textStyle.texts).not.toContain('inherit')
  })

  test('an inherited property whose winner is inherit reads the parent, also when a losing rule has a value', () => {
    const sheets = [
      {
        cssRules: [
          styleRule('.body', { color: 'var(--mui-palette-text-primary)' }),
          styleRule('.label', { color: '#123456' }),
          styleRule('.label.muted', { color: 'inherit' }),
        ],
      },
    ]
    const body = frameNode({ classes: ['body'], sheets })
    const label = frameNode({ classes: ['label', 'muted'], sheets, parent: body })
    expect(readStyles(label).values.color).toMatchObject({
      declared: ['var(--mui-palette-text-primary)'],
      source: { inline: false },
    })
  })

  test('own text: a text node with more than white space', () => {
    const read = (children: (string | null)[]) => readStyles(frameNode({ classes: [], sheets: [], children })).ownText
    expect(read(['Get started'])).toBe(true)
    expect(read([null, '  \n '])).toBe(false)
    expect(read([null])).toBe(false)
    expect(read([])).toBe(false)
  })

  test('an element with no window is an error', () => {
    const node = { ownerDocument: { defaultView: null, styleSheets: [] } } as unknown as Element
    expect(() => readStyles(node)).toThrow('not in a document with a window')
  })
})
