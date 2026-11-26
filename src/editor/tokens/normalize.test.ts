import { describe, expect, test } from 'vitest'
import {
  colorDistance,
  parseColor,
  parseLength,
  parseShadow,
  sameColor,
  sameLength,
  sameShadow,
  sameTextPart,
  shadowDistance,
  splitTop,
} from './normalize.ts'

describe('parseColor', () => {
  test('hex, rgb and rgba of one color give one value', () => {
    const forms = ['#1f4fd8', '#1F4FD8', 'rgb(31, 79, 216)', 'rgba(31, 79, 216, 1)', 'rgb(31 79 216)', '#1f4fd8ff']
    for (const form of forms) expect(parseColor(form)).toEqual({ r: 31, g: 79, b: 216, a: 1 })
  })

  test('hsl and hsla give the rgb value that the page computes', () => {
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    expect(parseColor('hsl(120 100% 25%)')).toEqual({ r: 0, g: 128, b: 0, a: 1 })
    expect(parseColor('hsla(240, 100%, 50%, 0.5)')).toEqual({ r: 0, g: 0, b: 255, a: 0.5 })
    expect(parseColor('hsl(0.5turn 100% 50% / 50%)')).toEqual({ r: 0, g: 255, b: 255, a: 0.5 })
    expect(parseColor('hsl(210 50 40)')).toEqual({ r: 51, g: 102, b: 153, a: 1 })
    expect(parseColor('hsl(210, 50%)')).toBeNull()
  })

  test('a name of a property of each object is no color', () => {
    for (const name of ['constructor', '__proto__', 'toString']) expect(parseColor(name)).toBeNull()
  })

  test('a short hex is read as the long form', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('#0008')).toEqual({ r: 0, g: 0, b: 0, a: 0.533 })
  })

  test('a color with opacity keeps the opacity', () => {
    expect(parseColor('rgba(0, 0, 0, 0.38)')).toEqual({ r: 0, g: 0, b: 0, a: 0.38 })
    expect(parseColor('rgb(0 0 0 / 38%)')).toEqual({ r: 0, g: 0, b: 0, a: 0.38 })
    expect(parseColor('#00000061')).toEqual({ r: 0, g: 0, b: 0, a: 0.38 })
  })

  test('the srgb form of a computed color mix is read', () => {
    expect(parseColor('color(srgb 1 0.5 0 / 0.5)')).toEqual({ r: 255, g: 128, b: 0, a: 0.5 })
  })

  test('transparent, black and white are read', () => {
    expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    expect(parseColor('black')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(parseColor('WHITE')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
  })

  test('a value that cannot be read gives null', () => {
    const texts = ['', 'red-ish', '#12', '#12345', 'rgb(1, 2)', 'var(--x)', 'currentcolor', 'hsl(0 0%)', 'oklch(0.5 0.1 200)']
    for (const text of texts) expect(parseColor(text)).toBeNull()
  })
})

describe('splitTop', () => {
  test('splits at the top level only', () => {
    expect(splitTop('calc(2 * var(--x)) 16px', /\s/)).toEqual(['calc(2 * var(--x))', '16px'])
    expect(splitTop(' 8px  ', /\s/)).toEqual(['8px'])
    expect(splitTop('a(1, 2), b', /,/)).toEqual(['a(1, 2)', 'b'])
  })
})

describe('sameColor and colorDistance', () => {
  test('a small difference of opacity from rounding is the same color', () => {
    expect(sameColor(parseColor('#00000061')!, parseColor('rgba(0, 0, 0, 0.38)')!)).toBe(true)
  })

  test('a different channel is a different color', () => {
    expect(sameColor(parseColor('#1f4fd8')!, parseColor('#1f4fd9')!)).toBe(false)
  })

  test('the distance is zero for the same color and grows with the difference', () => {
    const blue = parseColor('#1f4fd8')!
    expect(colorDistance(blue, blue)).toBe(0)
    expect(colorDistance(blue, parseColor('#1f4fda')!)).toBeLessThan(colorDistance(blue, parseColor('#ffffff')!))
  })

  test('the opacity counts in the distance', () => {
    expect(colorDistance(parseColor('rgba(0, 0, 0, 1)')!, parseColor('rgba(0, 0, 0, 0)')!)).toBe(255)
  })
})

describe('parseLength', () => {
  test('a length in px gives its number', () => {
    expect(parseLength('16px')).toBe(16)
    expect(parseLength('-0.96px')).toBe(-0.96)
    expect(parseLength(' 0.5px ')).toBe(0.5)
    expect(parseLength('1e+2px')).toBe(100)
  })

  test('0 and 0px are equal', () => {
    expect(parseLength('0')).toBe(0)
    expect(parseLength('0px')).toBe(0)
    expect(sameLength(parseLength('0')!, parseLength('0px')!)).toBe(true)
  })

  test('a value that cannot be read gives null', () => {
    for (const text of ['', 'auto', 'normal', '16', '1rem', '50%', 'calc(2 * 8px)', 'px']) {
      expect(parseLength(text)).toBeNull()
    }
  })

  test('sameLength accepts the rounding of the browser', () => {
    expect(sameLength(26.1, 26.099999)).toBe(true)
    expect(sameLength(16, 16.5)).toBe(false)
  })
})

describe('shadows', () => {
  const token = '0px 1px 2px 0px rgba(16, 24, 40, 0.10), 0px 1px 1px 0px rgba(16, 24, 40, 0.06)'
  const computed = 'rgba(16, 24, 40, 0.1) 0px 1px 2px 0px, rgba(16, 24, 40, 0.06) 0px 1px 1px 0px'

  test('the computed form, with the color first, is read as the form of the theme', () => {
    expect(parseShadow(computed)).toEqual(parseShadow(token))
    expect(parseShadow(token)).toEqual([
      { inset: false, x: 0, y: 1, blur: 2, spread: 0, color: { r: 16, g: 24, b: 40, a: 0.1 } },
      { inset: false, x: 0, y: 1, blur: 1, spread: 0, color: { r: 16, g: 24, b: 40, a: 0.06 } },
    ])
  })

  test('a missing blur and spread are zero, and inset is kept', () => {
    expect(parseShadow('inset 0 1px #000')).toEqual([{ inset: true, x: 0, y: 1, blur: 0, spread: 0, color: { r: 0, g: 0, b: 0, a: 1 } }])
  })

  test('a layer with no color has no color: it has the text color', () => {
    expect(parseShadow('0px 1px')).toEqual([{ inset: false, x: 0, y: 1, blur: 0, spread: 0, color: null }])
  })

  test('none gives no layers', () => {
    expect(parseShadow('none')).toEqual([])
  })

  test('a value that cannot be read gives null', () => {
    expect(parseShadow('')).toBeNull()
    expect(parseShadow('0px #000')).toBeNull()
    expect(parseShadow('0px 1px 2px, oops')).toBeNull()
    expect(parseShadow('0px 1px 2px 3px 4px #000')).toBeNull()
    expect(parseShadow('1em 1em #000')).toBeNull()
  })
})

describe('sameShadow and shadowDistance', () => {
  const shadow = (text: string) => parseShadow(text)!

  test('the same layers are the same shadow, with a distance of zero', () => {
    const a = shadow('0px 1px 2px rgba(0, 0, 0, 0.2)')
    expect(sameShadow(a, shadow('rgba(0, 0, 0, 0.2) 0 1px 2px 0'))).toBe(true)
    expect(shadowDistance(a, a)).toBe(0)
  })

  test('an inset layer and an outer layer are different, at an infinite distance', () => {
    const outer = shadow('0px 1px 2px #000')
    const inner = shadow('inset 0px 1px 2px #000')
    expect(sameShadow(outer, inner)).toBe(false)
    expect(shadowDistance(outer, inner)).toBe(Infinity)
  })

  test('a different number of layers is an infinite distance', () => {
    expect(shadowDistance(shadow('0 1px #000'), shadow('0 1px #000, 0 2px #000'))).toBe(Infinity)
  })

  test('two layers with no color have the same color; one color and no color are different', () => {
    expect(sameShadow(shadow('0px 1px'), shadow('0 1px 0 0'))).toBe(true)
    expect(sameShadow(shadow('0px 1px'), shadow('0px 1px #000'))).toBe(false)
  })

  test('the distance adds the px of the lengths and the color distance, 1px for 255 steps', () => {
    const a = shadow('0px 1px 2px rgba(0, 0, 0, 1)')
    expect(shadowDistance(a, shadow('0px 3px 2px rgba(0, 0, 0, 1)'))).toBe(2)
    expect(shadowDistance(a, shadow('0px 1px 2px rgba(255, 0, 0, 1)'))).toBe(1)
    // With no color on one side, only the lengths count.
    expect(shadowDistance(a, shadow('0px 2px 2px'))).toBe(1)
  })
})

describe('sameTextPart', () => {
  test('font families compare with no quotes, case or spaces', () => {
    expect(sameTextPart('fontFamily', 'system-ui, "Segoe UI", Arial', "system-ui,'segoe ui',arial")).toBe(true)
    expect(sameTextPart('fontFamily', 'Arial', 'Roboto')).toBe(false)
  })

  test('sizes and line heights compare in px', () => {
    expect(sameTextPart('fontSize', '16px', '16px')).toBe(true)
    expect(sameTextPart('lineHeight', '26.1px', '26.099999px')).toBe(true)
    expect(sameTextPart('lineHeight', 'normal', 'normal')).toBe(true)
    expect(sameTextPart('lineHeight', 'normal', '24px')).toBe(false)
  })

  test('weights compare as numbers', () => {
    expect(sameTextPart('fontWeight', '700', 'bold')).toBe(true)
    expect(sameTextPart('fontWeight', '400', 'normal')).toBe(true)
    expect(sameTextPart('fontWeight', '500', '600')).toBe(false)
  })

  test('a letter spacing of normal is zero', () => {
    expect(sameTextPart('letterSpacing', 'normal', '0px')).toBe(true)
    expect(sameTextPart('letterSpacing', '-0.96px', '-0.96px')).toBe(true)
    expect(sameTextPart('letterSpacing', '0.12px', 'normal')).toBe(false)
  })
})
