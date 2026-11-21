import { describe, expect, test } from 'vitest'
import {
  declaredValue,
  factorsOf,
  matchingSelector,
  nestedSelector,
  ruleKind,
  selectorParts,
  shorthandPart,
  shorthandsOf,
  specificity,
  variablesIn,
  walkRules,
  winner,
  type DeclarationSource,
  type DeclarationsLike,
  type RuleEntry,
  type RuleLike,
  type StyleSource,
} from './declarations.ts'

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

function styleRule(selectorText: string, values: Record<string, string> = {}): RuleLike {
  return cssRule('CSSStyleRule', { selectorText, style: declarations(values) })
}

function mediaRule(mediaText: string, cssRules: RuleLike[]): RuleLike {
  return cssRule('CSSMediaRule', { media: { mediaText }, cssRules })
}

describe('shorthandsOf', () => {
  test('a side of the padding gives the shorthand, the axis and the logical side', () => {
    expect(shorthandsOf('padding-left')).toEqual(['padding', 'padding-inline', 'padding-inline-start'])
    expect(shorthandsOf('padding-top')).toEqual(['padding', 'padding-block', 'padding-block-start'])
    expect(shorthandsOf('margin-right')).toEqual(['margin', 'margin-inline', 'margin-inline-end'])
  })

  test('a side of the border gives the border shorthands', () => {
    expect(shorthandsOf('border-bottom-width')).toEqual([
      'border',
      'border-width',
      'border-bottom',
      'border-block',
      'border-block-width',
      'border-block-end',
      'border-block-end-width',
    ])
    expect(shorthandsOf('border-left-color')).toContain('border-color')
  })

  test('a corner gives the radius shorthand and the logical corner', () => {
    expect(shorthandsOf('border-top-left-radius')).toEqual(['border-radius', 'border-start-start-radius'])
    expect(shorthandsOf('border-bottom-right-radius')).toEqual(['border-radius', 'border-end-end-radius'])
  })

  test('other properties with a shorthand', () => {
    expect(shorthandsOf('background-color')).toEqual(['background'])
    expect(shorthandsOf('font-size')).toEqual(['font'])
    expect(shorthandsOf('row-gap')).toEqual(['gap'])
    expect(shorthandsOf('flex-direction')).toEqual(['flex-flow'])
    expect(shorthandsOf('justify-content')).toEqual(['place-content'])
  })

  test('a property with no shorthand gives an empty list', () => {
    expect(shorthandsOf('color')).toEqual([])
    expect(shorthandsOf('box-shadow')).toEqual([])
    expect(shorthandsOf('letter-spacing')).toEqual([])
    expect(shorthandsOf('padding')).toEqual([])
  })
})

describe('variablesIn', () => {
  test('gives each variable in the sequence of the text', () => {
    expect(variablesIn('var(--mui-palette-primary-main, #1f4fd8)')).toEqual(['--mui-palette-primary-main'])
    expect(variablesIn('calc(2 * var(--a)) var( --b ,1px) var(--a)')).toEqual(['--a', '--b'])
  })

  test('a variable in the fallback of a variable is read too', () => {
    expect(variablesIn('var(--a, var(--b, 2px))')).toEqual(['--a', '--b'])
  })

  test('a text with no variable gives an empty list', () => {
    expect(variablesIn('16px')).toEqual([])
    expect(variablesIn('')).toEqual([])
  })
})

describe('factorsOf', () => {
  test('a factor before the variable', () => {
    expect(factorsOf('calc(2 * var(--x))', '--x')).toEqual([2])
    expect(factorsOf('calc(1.5*var(--x, 8px))', '--x')).toEqual([1.5])
    expect(factorsOf('calc(-1 * var(--x))', '--x')).toEqual([-1])
  })

  test('a factor after the variable', () => {
    expect(factorsOf('calc(var(--x) * 2)', '--x')).toEqual([2])
    expect(factorsOf('calc(var(--x, 8px) * 0.5)', '--x')).toEqual([0.5])
  })

  test('a division after the variable', () => {
    expect(factorsOf('calc(var(--x) / 2)', '--x')).toEqual([0.5])
  })

  test('a plain variable is the factor 1', () => {
    expect(factorsOf('var(--x, 8px)', '--x')).toEqual([1])
  })

  test('a fallback with parentheses does not hide a factor after it', () => {
    expect(factorsOf('calc(var(--x, rgba(0, 0, 0, 0.1)) * 3)', '--x')).toEqual([3])
  })

  test('a different variable with the same start gives no factor', () => {
    expect(factorsOf('calc(2 * var(--x-y))', '--x')).toEqual([])
    expect(factorsOf('16px', '--x')).toEqual([])
  })

  test('gives each use of the variable in a shorthand', () => {
    expect(factorsOf('calc(2 * var(--x)) calc(4 * var(--x)) var(--x)', '--x')).toEqual([2, 4, 1])
  })
})

describe('shorthandPart', () => {
  test('gives the side of a shorthand with one to four values, as CSS expands them', () => {
    expect(shorthandPart('padding-left', 'padding', '8px')).toBe('8px')
    expect(shorthandPart('padding-left', 'padding', '8px 16px')).toBe('16px')
    expect(shorthandPart('padding-bottom', 'padding', '8px 16px')).toBe('8px')
    expect(shorthandPart('margin-left', 'margin', '1px 2px 3px')).toBe('2px')
    expect(shorthandPart('margin-bottom', 'margin', '1px 2px 3px')).toBe('3px')
    expect(shorthandPart('margin-left', 'margin', '1px 2px 3px 4px')).toBe('4px')
    expect(shorthandPart('margin-left', 'margin', '0 auto')).toBe('auto')
  })

  test('keeps the parentheses of a value together', () => {
    expect(shorthandPart('padding-right', 'padding', 'calc(2 * var(--x)) calc(3 * var(--x))')).toBe('calc(3 * var(--x))')
  })

  test('gives the start or the end of an axis shorthand', () => {
    expect(shorthandPart('padding-left', 'padding-inline', '4px 8px')).toBe('4px')
    expect(shorthandPart('padding-right', 'padding-inline', '4px 8px')).toBe('8px')
    expect(shorthandPart('padding-bottom', 'padding-block', '4px')).toBe('4px')
    expect(shorthandPart('border-right-width', 'border-inline-width', '1px 2px')).toBe('2px')
  })

  test('gives the side of a border part, the corner of a radius, and the gap of an axis', () => {
    expect(shorthandPart('border-left-width', 'border-width', '1px 2px 3px 4px')).toBe('4px')
    expect(shorthandPart('border-top-color', 'border-color', 'red blue')).toBe('red')
    expect(shorthandPart('border-bottom-right-radius', 'border-radius', '1px 2px 3px')).toBe('3px')
    expect(shorthandPart('border-bottom-left-radius', 'border-radius', '1px 2px / 5px')).toBe('2px')
    expect(shorthandPart('column-gap', 'gap', '8px 16px')).toBe('16px')
    expect(shorthandPart('row-gap', 'gap', '8px')).toBe('8px')
  })

  test('keeps the whole text of a shorthand that is not by side, or that has too many values', () => {
    expect(shorthandPart('border-left-width', 'border', '1px solid var(--x)')).toBe('1px solid var(--x)')
    expect(shorthandPart('font-size', 'font', '400 1rem/1.5 Arial')).toBe('400 1rem/1.5 Arial')
    expect(shorthandPart('padding-left', 'padding-inline', '1px 2px 3px')).toBe('1px 2px 3px')
  })
})

describe('walkRules', () => {
  const always = () => true
  const selectors = (entries: RuleEntry[]) => entries.map((entry) => entry.rule.selectorText)

  test('gives the condition of the media rules and import rules that hold a rule', () => {
    const imported = cssRule('CSSImportRule', { media: { mediaText: 'screen' }, styleSheet: { cssRules: [styleRule('.d')] } })
    const supports = cssRule('CSSSupportsRule', { conditionText: '(display: grid)', cssRules: [styleRule('.c')] })
    const rules = [
      styleRule('.a'),
      mediaRule('(min-width: 900px)', [styleRule('.b'), mediaRule('(max-width: 1200px)', [supports])]),
      imported,
      mediaRule('', [styleRule('.e')]),
    ]
    expect(walkRules(rules, always).map((entry) => [entry.rule.selectorText, entry.media])).toEqual([
      ['.a', undefined],
      ['.b', '(min-width: 900px)'],
      ['.c', '(min-width: 900px) and (max-width: 1200px)'],
      ['.d', 'screen'],
      ['.e', undefined],
    ])
  })

  test('gives the style rules in sequence', () => {
    const rules = [styleRule('.a'), styleRule('.b')]
    expect(selectors(walkRules(rules, always))).toEqual(['.a', '.b'])
  })

  test('goes into a media rule that applies', () => {
    const rules = [styleRule('.a'), mediaRule('(min-width: 900px)', [styleRule('.b')]), styleRule('.c')]
    expect(selectors(walkRules(rules, always))).toEqual(['.a', '.b', '.c'])
  })

  test('leaves out a media rule that does not apply', () => {
    const rules = [styleRule('.a'), mediaRule('(min-width: 900px)', [styleRule('.b')])]
    const applies = (rule: RuleLike) => rule.media?.mediaText !== '(min-width: 900px)'
    expect(selectors(walkRules(rules, applies))).toEqual(['.a'])
  })

  test('goes into group rules in group rules, and into supports rules', () => {
    const supports = cssRule('CSSSupportsRule', { conditionText: '(display: grid)', cssRules: [styleRule('.c')] })
    const rules = [mediaRule('screen', [mediaRule('(min-width: 1px)', [styleRule('.b')]), supports])]
    expect(selectors(walkRules(rules, always))).toEqual(['.b', '.c'])
  })

  test('reads the kind of a rule from the constructor name', () => {
    const layer = cssRule('CSSLayerBlockRule', { cssRules: [styleRule('.in-layer')] })
    const container = cssRule('CSSContainerRule', { cssRules: [styleRule('.in-container')] })
    const keyframes = cssRule('CSSKeyframesRule', { cssRules: [styleRule('from')] })
    expect(ruleKind(layer)).toBe('group')
    expect(ruleKind(keyframes)).toBe('other')
    expect(ruleKind({ selectorText: '.plain' })).toBe('other')
    expect(selectors(walkRules([layer, container, keyframes], always))).toEqual(['.in-layer', '.in-container'])
  })

  test('goes into the sheet of an import rule that applies', () => {
    const imported = cssRule('CSSImportRule', { media: { mediaText: '' }, styleSheet: { cssRules: [styleRule('.d')] } })
    expect(selectors(walkRules([imported], always))).toEqual(['.d'])
    expect(walkRules([cssRule('CSSImportRule', { styleSheet: null })], always)).toEqual([])
  })

  test('skips rules that are not style rules or group rules', () => {
    const fontFace = cssRule('CSSFontFaceRule', { style: declarations({}) })
    expect(walkRules([fontFace, cssRule('CSSKeyframesRule', { cssRules: [styleRule('50%')] })], always)).toEqual([])
  })

  test('an empty list gives an empty list', () => {
    expect(walkRules([], always)).toEqual([])
  })

  test('goes into nested rules after the rule, with absolute selectors', () => {
    const nested = cssRule('CSSStyleRule', {
      selectorText: '.button',
      style: declarations({ padding: 'var(--m)' }),
      cssRules: [
        styleRule('&.S', { padding: 'var(--s)' }),
        mediaRule('(width < 767px)', [styleRule('& svg')]),
        cssRule('CSSNestedDeclarations', { style: declarations({ color: 'red' }) }),
      ],
    })
    const entries = walkRules([nested], always)
    expect(entries.map((entry) => [entry.rule.selectorText, entry.media])).toEqual([
      ['.button', undefined],
      [':is(.button).S', undefined],
      [':is(.button) svg', '(width < 767px)'],
      ['.button', undefined],
    ])
    expect(entries[1].rule.style.getPropertyValue('padding')).toBe('var(--s)')
    expect(entries[3].rule.style.getPropertyValue('color')).toBe('red')
  })

  test('declarations of a nested rule outside a style rule are skipped', () => {
    expect(walkRules([cssRule('CSSNestedDeclarations', { style: declarations({ color: 'red' }) })], always)).toEqual([])
  })
})

describe('nestedSelector', () => {
  test('puts the parent in place of each &, and makes a part with no & a descendant', () => {
    expect(nestedSelector('.a, .b', '&.S, & > p, label')).toBe(':is(.a, .b).S, :is(.a, .b) > p, :is(.a, .b) label')
    expect(nestedSelector('.a', '.dark &')).toBe('.dark :is(.a)')
  })

  test('the specificity is that of the strongest part of the parent', () => {
    expect(specificity(nestedSelector('a.x, button.x', '&.M'))).toEqual([0, 2, 1])
  })
})

// A source of an element: a rule with the specificity of `selector`, or the
// inline style when `selector` is null. The position is the index in the list.
function sources(...list: [selector: string | null, values: Record<string, string>, important?: string[]][]): StyleSource[] {
  return list.map(([selector, values, important], position) =>
    selector === null
      ? { style: declarations(values, important), kind: 'inline', specificity: [0, 0, 0], position }
      : { style: declarations(values, important), kind: 'rule', specificity: specificity(selector), position },
  )
}

describe('declaredValue', () => {
  test('a variable that the element does not declare is read from the root sources', () => {
    const own = sources(['.widget', { 'border-top-left-radius': 'var(--widget-radius)' }])
    const root = sources([':root', { '--widget-radius': 'var(--radius-xl)', '--radius-xl': '0.75rem' }])
    expect(declaredValue('border-top-left-radius', own, () => root)?.texts).toEqual([
      'var(--widget-radius)',
      'var(--radius-xl)',
      '0.75rem',
    ])
  })

  test('a variable of the element wins over the root sources', () => {
    const own = sources(['.a', { color: 'var(--c)', '--c': 'var(--own)' }])
    const root = sources([':root', { '--c': 'var(--root)' }])
    expect(declaredValue('color', own, () => root)?.texts).toEqual(['var(--c)', 'var(--own)'])
  })

  test('the later of two rules with the same specificity wins', () => {
    const list = sources(['.a', { 'padding-left': '16px' }], ['.b', { 'padding-left': '13px' }])
    expect(declaredValue('padding-left', list)).toEqual({ texts: ['13px'], source: { inline: false } })
  })

  test('the rule with the higher specificity wins over a later rule', () => {
    const list = sources(['.a.b', { 'padding-left': '16px' }], ['.c', { 'padding-left': '13px' }])
    expect(declaredValue('padding-left', list)?.texts).toEqual(['16px'])
  })

  test('the inline style wins over a rule, and has no selector', () => {
    const list = sources(['#a', { 'padding-left': 'var(--mui-spacing)' }], [null, { 'padding-left': '64px' }])
    expect(declaredValue('padding-left', list)).toEqual({ texts: ['64px'], source: { inline: true } })
  })

  test('!important wins over the inline style and over a higher specificity', () => {
    const list = sources(
      ['.a', { color: 'var(--mui-palette-primary-main)' }, ['color']],
      ['#b.c', { color: '#111' }],
      [null, { color: '#222' }],
    )
    expect(declaredValue('color', list)).toEqual({
      texts: ['var(--mui-palette-primary-main)'],
      source: { inline: false },
    })
  })

  test('the priority of a shorthand counts for its longhand', () => {
    const list = sources(['.a', { padding: 'var(--x)' }, ['padding']], [null, { 'padding-left': '64px' }])
    expect(declaredValue('padding-left', list)?.texts).toEqual(['var(--x)'])
  })

  test('the source carries the media condition of the rule', () => {
    const [plain, wide] = sources(['.a', { 'padding-left': '8px' }], ['.a', { 'padding-left': '64px' }])
    expect(declaredValue('padding-left', [plain, { ...wide, media: '(min-width: 900px)' }])).toEqual({
      texts: ['64px'],
      source: { inline: false, media: '(min-width: 900px)' },
    })
  })

  test('reads the text of a shorthand when the longhand is empty', () => {
    // A shorthand with `var()` gives an empty text for its longhands.
    const list = sources(['.a', { padding: 'calc(4 * var(--mui-spacing, 8px))' }])
    expect(declaredValue('padding-left', list)?.texts).toEqual(['calc(4 * var(--mui-spacing, 8px))'])
  })

  test('reads only the part of a shorthand by side that sets the side', () => {
    // A fixed left padding is not linked by the variable of the top padding.
    const list = sources(['.a', { padding: 'calc(2 * var(--mui-spacing, 8px)) 16px' }])
    expect(declaredValue('padding-left', list)?.texts).toEqual(['16px'])
    expect(declaredValue('padding-top', list)?.texts).toEqual(['calc(2 * var(--mui-spacing, 8px))'])
  })

  test('the longhand comes before the shorthand of the same source, and the narrower shorthand before the wider', () => {
    expect(declaredValue('padding-left', sources(['.a', { padding: 'var(--a)', 'padding-left': '13px' }]))?.texts).toEqual(['13px'])
    const both = sources(['.a', { padding: 'var(--a)', 'padding-inline': 'var(--b)' }])
    expect(declaredValue('padding-left', both)?.texts).toEqual(['var(--b)'])
  })

  test('a shorthand in a later rule wins over a longhand in an earlier rule', () => {
    const list = sources(['.a', { 'padding-left': '13px' }], ['.b', { padding: 'var(--mui-spacing)' }])
    expect(declaredValue('padding-left', list)?.texts).toEqual(['var(--mui-spacing)'])
  })

  test('adds the text of the variable that wins among the sources', () => {
    const list = sources(
      ['.a', { '--variant-containedBg': 'var(--mui-palette-primary-main)' }],
      ['.b', { 'background-color': 'var(--variant-containedBg)' }],
      ['.c', { '--variant-containedBg': '#123456' }],
    )
    expect(declaredValue('background-color', list)?.texts).toEqual(['var(--variant-containedBg)', '#123456'])
  })

  test('a losing rule with a variable adds no text', () => {
    const list = sources(['.a', { color: 'var(--mui-palette-common-white)' }], ['.b.c', { color: '#fff' }])
    expect(declaredValue('color', list)).toEqual({ texts: ['#fff'], source: { inline: false } })
  })

  test('a variable that refers to itself does not loop', () => {
    const list = sources(['.a', { color: 'var(--a)', '--a': 'var(--b)', '--b': 'var(--a)' }])
    expect(declaredValue('color', list)?.texts).toEqual(['var(--a)', 'var(--b)', 'var(--a)'])
  })

  test('no source that declares the property gives null', () => {
    expect(declaredValue('color', [])).toBeNull()
    expect(declaredValue('color', sources(['.a', {}]))).toBeNull()
  })
})

describe('selectorParts', () => {
  test('splits a selector list at the commas', () => {
    expect(selectorParts('.a, .b ,#c')).toEqual(['.a', '.b', '#c'])
    expect(selectorParts('.a')).toEqual(['.a'])
  })

  test('keeps the commas in a parenthesis, a bracket and a quoted text', () => {
    expect(selectorParts(':is(.a, .b) .c, .d')).toEqual([':is(.a, .b) .c', '.d'])
    expect(selectorParts('[title="a, b"], .e')).toEqual(['[title="a, b"]', '.e'])
    expect(selectorParts("[title='x,y']")).toEqual(["[title='x,y']"])
    expect(selectorParts('.a\\,b, .c')).toEqual(['.a\\,b', '.c'])
  })

  test('leaves out empty parts', () => {
    expect(selectorParts('.a,, .b,')).toEqual(['.a', '.b'])
    expect(selectorParts('')).toEqual([])
  })
})

describe('matchingSelector', () => {
  const matches = (part: string) => part === '.a' || part === '.b'

  test('counts only the parts of a list that match', () => {
    expect(matchingSelector('.a, #id', matches)).toEqual([0, 1, 0])
    expect(matchingSelector('#id, .a, .b', matches)).toEqual([0, 1, 0])
  })

  test('a selector with no list is tested as it is', () => {
    expect(matchingSelector(' .a ', matches)).toEqual([0, 1, 0])
  })

  test('no part that matches gives null', () => {
    expect(matchingSelector('.c, #id', matches)).toBeNull()
    expect(matchingSelector('.c', matches)).toBeNull()
  })
})

describe('declarations fixture', () => {
  test('gives the priority of a property', () => {
    const style = declarations({ color: 'red', padding: '1px' }, ['color'])
    expect(style.getPropertyPriority('color')).toBe('important')
    expect(style.getPropertyPriority('padding')).toBe('')
    expect(style.getPropertyPriority('margin')).toBe('')
  })
})

describe('specificity', () => {
  test('counts ids, classes, attributes, pseudo classes, types and pseudo elements', () => {
    expect(specificity('#a')).toEqual([1, 0, 0])
    expect(specificity('.a')).toEqual([0, 1, 0])
    expect(specificity('[data-x="1"]')).toEqual([0, 1, 0])
    expect(specificity(':hover')).toEqual([0, 1, 0])
    expect(specificity('div')).toEqual([0, 0, 1])
    expect(specificity('::before')).toEqual([0, 0, 1])
    expect(specificity('#a.b.c[d] div > span:hover::after')).toEqual([1, 4, 3])
    expect(specificity('.MuiButton-root.MuiButton-sizeLarge')).toEqual([0, 2, 0])
    expect(specificity('.css-1x2y3z')).toEqual([0, 1, 0])
  })

  test('the universal selector, the combinators and white space count as zero', () => {
    expect(specificity('*')).toEqual([0, 0, 0])
    expect(specificity('* + *')).toEqual([0, 0, 0])
    expect(specificity('  .a   ~  .b  ')).toEqual([0, 2, 0])
    expect(specificity('ul>li')).toEqual([0, 0, 2])
  })

  test('an old pseudo element with one colon counts as a type', () => {
    expect(specificity('p:first-line')).toEqual([0, 0, 2])
    expect(specificity('.a:before')).toEqual([0, 1, 1])
  })

  test('a pseudo class with an argument counts as a class', () => {
    expect(specificity('li:nth-child(2n + 1)')).toEqual([0, 1, 1])
    expect(specificity(':lang(en)')).toEqual([0, 1, 0])
  })

  test('a pseudo class with a selector list that is not :is(), :not() or :has() counts as one class', () => {
    expect(specificity(':nth-child(2n of .a, #b)')).toEqual([0, 1, 0])
    expect(specificity(':-webkit-any(#a, .b)')).toEqual([0, 1, 0])
  })

  test(':where() counts as zero', () => {
    expect(specificity(':where(#a, .b)')).toEqual([0, 0, 0])
    expect(specificity(':where(.MuiButton-root) .x')).toEqual([0, 1, 0])
  })

  test(':is(), :not() and :has() count as their strongest argument', () => {
    expect(specificity(':is(.a, #b, div)')).toEqual([1, 0, 0])
    expect(specificity(':not(.a)')).toEqual([0, 1, 0])
    expect(specificity('a:not(.b, p span)')).toEqual([0, 1, 1])
    expect(specificity('.a:has(> img)')).toEqual([0, 1, 1])
    expect(specificity(':is(:not(#a), .b)')).toEqual([1, 0, 0])
  })

  test('a selector list gives its strongest part', () => {
    expect(specificity('.a, #b')).toEqual([1, 0, 0])
  })

  test('reads escapes, quotes and brackets in a name or an attribute', () => {
    expect(specificity('.sm\\:p-2')).toEqual([0, 1, 0])
    expect(specificity('[title="a, b ] (c"]')).toEqual([0, 1, 0])
    expect(specificity("[data-x='#y'] .z")).toEqual([0, 2, 0])
  })

  test('a selector that cannot be read gives zero', () => {
    expect(specificity('')).toEqual([0, 0, 0])
    expect(specificity('.')).toEqual([0, 0, 0])
    expect(specificity('#')).toEqual([0, 0, 0])
    expect(specificity('.a,')).toEqual([0, 0, 0])
    expect(specificity(':is(.a')).toEqual([0, 0, 0])
    expect(specificity('[x')).toEqual([0, 0, 0])
    expect(specificity('.a)')).toEqual([0, 0, 0])
    expect(specificity('.a { color: red }')).toEqual([0, 0, 0])
  })
})

describe('winner', () => {
  function source(fields: Partial<DeclarationSource>): DeclarationSource {
    return { text: '1px', important: false, kind: 'rule', specificity: [0, 1, 0], position: 0, ...fields }
  }

  test('no source gives null', () => {
    expect(winner([])).toBeNull()
  })

  test('a source with an empty text does not win', () => {
    expect(winner([source({ text: '' })])).toBeNull()
    const set = source({ text: '2px', position: 0 })
    expect(winner([set, source({ text: '', position: 1, kind: 'inline' })])).toBe(set)
  })

  test('the later position wins at equal specificity', () => {
    const first = source({ text: '1px', position: 0 })
    const second = source({ text: '2px', position: 1 })
    expect(winner([first, second])).toBe(second)
    expect(winner([second, first])).toBe(second)
  })

  test('the higher specificity wins over the later position', () => {
    const strong = source({ text: '1px', specificity: [0, 2, 0], position: 0 })
    const weak = source({ text: '2px', specificity: [0, 1, 5], position: 1 })
    expect(winner([strong, weak])).toBe(strong)
    const id = source({ text: '3px', specificity: [1, 0, 0], position: 0 })
    expect(winner([source({ specificity: [0, 9, 9], position: 1 }), id])).toBe(id)
  })

  test('the inline style wins over a rule with a higher specificity', () => {
    const inline = source({ text: '13px', kind: 'inline', specificity: [0, 0, 0], position: 1 })
    const rule = source({ text: '16px', specificity: [1, 1, 0], position: 2 })
    expect(winner([rule, inline])).toBe(inline)
  })

  test('!important wins over the inline style and over a higher specificity', () => {
    const important = source({ text: '8px', important: true, specificity: [0, 1, 0], position: 0 })
    const inline = source({ text: '13px', kind: 'inline', position: 2 })
    const strong = source({ text: '16px', specificity: [1, 0, 0], position: 1 })
    expect(winner([important, strong, inline])).toBe(important)
  })

  test('among !important sources the inline style wins, then specificity, then position', () => {
    const rule = source({ text: '1px', important: true, specificity: [1, 0, 0], position: 0 })
    const inline = source({ text: '2px', important: true, kind: 'inline', position: 1 })
    expect(winner([rule, inline])).toBe(inline)
    const later = source({ text: '3px', important: true, position: 2 })
    expect(winner([rule, later])).toBe(rule)
  })

  test('the media condition does not change the winner and stays on the source', () => {
    const inMedia = source({ text: '1px', media: '(min-width: 900px)', position: 1 })
    const plain = source({ text: '2px', position: 0 })
    expect(winner([plain, inMedia])).toEqual(inMedia)
  })
})
