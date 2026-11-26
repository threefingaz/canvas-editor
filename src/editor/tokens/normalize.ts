import type { TextStyle } from '../../tokens/format.ts'
import { clamp } from '../clamp.ts'

// One form for the values that the inspector compares: the computed styles of
// the frame document and the values of `tokens.json`. Colors become RGBA,
// lengths px numbers, shadows a list of layers. A value that cannot be read
// gives null.

export type Rgba = { r: number; g: number; b: number; a: number }

export type ShadowLayer = {
  inset: boolean
  x: number
  y: number
  blur: number
  spread: number
  // Null when the layer has no color: it has the text color.
  color: Rgba | null
}

// The difference of two lengths that is still the same length. The browser
// rounds computed values (26.1px can be 26.099999px).
const lengthTolerance = 0.02

// The difference of two opacities that is still the same opacity. A hex color
// has steps of 1/255, a theme has two decimals.
const alphaTolerance = 0.005

const namedColors: Record<string, Rgba> = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
}

function round(value: number, digits: number) {
  const result = Number(value.toFixed(digits))
  return result === 0 ? 0 : result
}

function rgba(r: number, g: number, b: number, a: number): Rgba {
  return {
    r: Math.round(clamp(r, 0, 255)),
    g: Math.round(clamp(g, 0, 255)),
    b: Math.round(clamp(b, 0, 255)),
    a: round(clamp(a, 0, 1), 3),
  }
}

function parseHex(hex: string): Rgba | null {
  if (!/^[0-9a-f]+$/i.test(hex)) return null
  const long = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex
  if (long.length !== 6 && long.length !== 8) return null
  const byte = (index: number) => parseInt(long.slice(index, index + 2), 16)
  return rgba(byte(0), byte(2), byte(4), long.length === 8 ? byte(6) / 255 : 1)
}

// A number, or a percentage of `whole`.
function parseNumber(text: string, whole: number): number | null {
  const match = /^(-?\d*\.?\d+(?:e[+-]?\d+)?)(%?)$/i.exec(text)
  if (!match) return null
  const value = Number(match[1])
  return match[2] ? (value / 100) * whole : value
}

// The parts of `name(a, b, c / d)` or `name(a b c / d)`: three channels and an
// optional opacity.
function functionParts(text: string, name: string): { channels: string[]; alpha: string | null } | null {
  const match = new RegExp(`^${name}\\((.*)\\)$`, 'i').exec(text)
  if (!match) return null
  const body = match[1].trim()
  if (body.includes(',')) {
    const parts = body.split(',').map((part) => part.trim())
    if (parts.length !== 3 && parts.length !== 4) return null
    return { channels: parts.slice(0, 3), alpha: parts[3] ?? null }
  }
  const [main, alpha, ...rest] = body.split('/').map((part) => part.trim())
  if (rest.length > 0) return null
  const channels = main.split(/\s+/)
  return { channels, alpha: alpha ?? null }
}

function parseFunction(text: string, name: string, whole: number): Rgba | null {
  const parts = functionParts(text, name)
  if (!parts || parts.channels.length !== 3) return null
  const channels = parts.channels.map((channel) => parseNumber(channel, whole))
  const alpha = parts.alpha === null ? 1 : parseNumber(parts.alpha, 1)
  if (channels.some((channel) => channel === null) || alpha === null) return null
  const [r, g, b] = channels.map((channel) => (channel as number) * (255 / whole))
  return rgba(r, g, b, alpha)
}

// An angle of a hue in degrees, from 0 to 360: a number (degrees) or a number
// with `deg`, `grad`, `rad` or `turn`.
function parseHue(text: string): number | null {
  const match = /^(-?\d*\.?\d+(?:e[+-]?\d+)?)(deg|grad|rad|turn)?$/i.exec(text)
  if (!match) return null
  const value = Number(match[1])
  const unit = match[2]?.toLowerCase()
  const degrees = unit === 'turn' ? value * 360 : unit === 'rad' ? (value * 180) / Math.PI : unit === 'grad' ? value * 0.9 : value
  return ((degrees % 360) + 360) % 360
}

// The saturation or the lightness of `hsl()`, from 0 to 1: a percentage, or a
// number of percent (the syntax with spaces takes one).
function parseShare(text: string): number | null {
  const match = /^(-?\d*\.?\d+(?:e[+-]?\d+)?)%?$/i.exec(text)
  return match ? clamp(Number(match[1]) / 100, 0, 1) : null
}

// `hsl()` and `hsla()`, as in CSS: a token can be written so, and the page
// computes it as `rgb()`.
function parseHsl(text: string): Rgba | null {
  const parts = functionParts(text, 'hsla?')
  if (!parts || parts.channels.length !== 3) return null
  const hue = parseHue(parts.channels[0])
  const saturation = parseShare(parts.channels[1])
  const lightness = parseShare(parts.channels[2])
  const alpha = parts.alpha === null ? 1 : parseNumber(parts.alpha, 1)
  if (hue === null || saturation === null || lightness === null || alpha === null) return null
  const amount = saturation * Math.min(lightness, 1 - lightness)
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12
    return (lightness - amount * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255
  }
  return rgba(channel(0), channel(8), channel(4), alpha)
}

// A color in hex, `rgb()`, `rgba()`, `hsl()`, `hsla()`, `color(srgb …)` (the
// computed form of a color mix in sRGB) or one of a few names. Other forms
// give null. Limit: a
// computed color stays in its own space when it is written in one
// (`oklch()`, `lab()`, `color(display-p3 …)`, a mix in such a space); such a
// value cannot be compared and the inspector leaves its row out.
export function parseColor(text: string): Rgba | null {
  const value = text.trim().toLowerCase()
  if (Object.hasOwn(namedColors, value)) return namedColors[value]
  if (value.startsWith('#')) return parseHex(value.slice(1))
  if (value.startsWith('rgb')) return parseFunction(value, 'rgba?', 255)
  if (value.startsWith('hsl')) return parseHsl(value)
  if (value.startsWith('color(')) {
    const srgb = /^color\(srgb\s+(.*)\)$/.exec(value)
    return srgb ? parseFunction(`c(${srgb[1]})`, 'c', 1) : null
  }
  return null
}

export function sameColor(a: Rgba, b: Rgba): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && Math.abs(a.a - b.a) <= alphaTolerance
}

// The distance in RGB, with the opacity on the same scale as a channel.
export function colorDistance(a: Rgba, b: Rgba): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b, (a.a - b.a) * 255)
}

// A length in px, as a number. `0` with no unit is 0. Other units give null:
// computed lengths and token values are in px.
export function parseLength(text: string): number | null {
  const value = text.trim()
  if (value === '0') return 0
  const match = /^(-?\d*\.?\d+(?:e[+-]?\d+)?)px$/i.exec(value)
  if (!match) return null
  const result = Number(match[1])
  return result === 0 ? 0 : result
}

export function sameLength(a: number, b: number): boolean {
  return Math.abs(a - b) <= lengthTolerance
}

// The parts of a text at the top level (not in parentheses), split at each
// character that matches `separator`. Empty parts are left out.
export function splitTop(text: string, separator: RegExp): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of text) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (depth === 0 && separator.test(char)) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.map((part) => part.trim()).filter((part) => part !== '')
}

function parseLayer(text: string): ShadowLayer | null {
  let inset = false
  let color: Rgba | null = null
  const lengths: number[] = []
  for (const word of splitTop(text, /\s/)) {
    if (word.toLowerCase() === 'inset' && !inset) {
      inset = true
      continue
    }
    const length = parseLength(word)
    if (length !== null) {
      lengths.push(length)
      continue
    }
    const wordColor = parseColor(word)
    if (wordColor === null || color !== null) return null
    color = wordColor
  }
  if (lengths.length < 2 || lengths.length > 4) return null
  const [x, y, blur = 0, spread = 0] = lengths
  return { inset, x, y, blur, spread, color }
}

// The layers of a `box-shadow`, in either order of the color and the lengths.
// `none` gives no layers.
export function parseShadow(text: string): ShadowLayer[] | null {
  const value = text.trim()
  if (value.toLowerCase() === 'none') return []
  const layers = splitTop(value, /,/).map(parseLayer)
  if (layers.length === 0 || layers.some((layer) => layer === null)) return null
  return layers as ShadowLayer[]
}

function sameLayer(a: ShadowLayer, b: ShadowLayer): boolean {
  const sameColors = a.color && b.color ? sameColor(a.color, b.color) : a.color === b.color
  return (
    a.inset === b.inset &&
    sameLength(a.x, b.x) &&
    sameLength(a.y, b.y) &&
    sameLength(a.blur, b.blur) &&
    sameLength(a.spread, b.spread) &&
    sameColors
  )
}

export function sameShadow(a: ShadowLayer[], b: ShadowLayer[]): boolean {
  return a.length === b.length && a.every((layer, index) => sameLayer(layer, b[index]))
}

// The distance of two shadows: the px difference of the lengths, and the color
// distance on the scale of 1px per channel step. Infinity when the shadows
// have a different number of layers or a different inset.
export function shadowDistance(a: ShadowLayer[], b: ShadowLayer[]): number {
  if (a.length !== b.length) return Infinity
  let total = 0
  for (const [index, layer] of a.entries()) {
    const other = b[index]
    if (layer.inset !== other.inset) return Infinity
    total +=
      Math.abs(layer.x - other.x) +
      Math.abs(layer.y - other.y) +
      Math.abs(layer.blur - other.blur) +
      Math.abs(layer.spread - other.spread)
    if (layer.color && other.color) total += colorDistance(layer.color, other.color) / 255
  }
  return total
}

const fontWeights: Record<string, number> = { normal: 400, bold: 700 }

function fontFamilyKey(text: string) {
  return text
    .split(',')
    .map((name) => name.trim().replace(/^["']|["']$/g, '').toLowerCase())
    .join(',')
}

function weightOf(text: string): number | null {
  const value = text.trim().toLowerCase()
  if (Object.hasOwn(fontWeights, value)) return fontWeights[value]
  const number = Number(value)
  return value !== '' && Number.isFinite(number) ? number : null
}

function sameLengthText(a: string, b: string) {
  const lengthA = parseLength(a)
  const lengthB = parseLength(b)
  if (lengthA !== null && lengthB !== null) return sameLength(lengthA, lengthB)
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

// True when one part of two text styles is the same value. A letter spacing of
// `normal` is 0.
export function sameTextPart(part: keyof TextStyle, a: string, b: string): boolean {
  switch (part) {
    case 'fontFamily':
      return fontFamilyKey(a) === fontFamilyKey(b)
    case 'fontWeight': {
      const weightA = weightOf(a)
      return weightA !== null && weightA === weightOf(b)
    }
    case 'letterSpacing': {
      const zero = (text: string) => (text.trim().toLowerCase() === 'normal' ? '0px' : text)
      return sameLengthText(zero(a), zero(b))
    }
    default:
      return sameLengthText(a, b)
  }
}
