import { describe, expect, test } from 'vitest'
import { partWidth, pinsWidth, presentParts, relationIcon, titleGap, titleMin, titleParts, type TitlePart } from './title.ts'

// The width that the row needs for these parts, as `titleParts` counts it.
const need = (parts: readonly TitlePart[], icon = false) =>
  titleMin +
  (icon ? relationIcon + titleGap : 0) +
  parts.reduce((sum, part) => (part === 'title' ? sum : sum + partWidth[part] + titleGap), 0)

const base: TitlePart[] = ['title', 'width', 'issues', 'actions']
const all: TitlePart[] = ['mark', 'title', 'options', 'width', 'relation', 'issues', 'pins', 'asked', 'keep', 'actions']

describe('titleParts', () => {
  test('all parts fit: each stays, in the order of the row', () => {
    expect(titleParts(1000, all)).toEqual(all)
    expect(titleParts(need(base), base)).toEqual(base)
  })

  test('the parts go out one step after the other, in a fixed order', () => {
    const steps: TitlePart[][] = [
      all,
      ['mark', 'title', 'options', 'width', 'relation', 'issues', 'pins', 'asked'],
      ['mark', 'title', 'options', 'relation', 'issues', 'pins', 'asked'],
      ['mark', 'title', 'options', 'issues', 'pins', 'asked'],
      ['mark', 'title', 'options', 'issues', 'pins'],
      ['mark', 'title', 'issues', 'pins'],
      ['mark', 'title', 'issues'],
      ['mark', 'title'],
      ['title'],
    ]
    for (let index = 0; index < steps.length - 1; index++) {
      const width = need(steps[index], true)
      // At its threshold a step keeps its parts; one px less is the next step.
      expect(titleParts(width, all)).toEqual(steps[index])
      expect(titleParts(width - 1, all)).toEqual(steps[index + 1])
    }
  })

  test('the title never goes out', () => {
    expect(titleParts(0, all)).toEqual(['title'])
    expect(titleParts(-10, base)).toEqual(['title'])
    expect(titleParts(Number.NaN, base)).toEqual(['title'])
    expect(titleParts(10, ['title'])).toEqual(['title'])
  })

  test('a step with a part that the frame does not have removes nothing more', () => {
    // No pins and no options: after the width the issues go, then nothing.
    expect(titleParts(need(['title', 'issues']), base)).toEqual(['title', 'issues'])
    expect(titleParts(need(['title', 'issues']) - 1, base)).toEqual(['title'])
  })

  test('the mark of the asked options goes out after the relation error and before the count of options', () => {
    const asked: TitlePart[] = ['title', 'options', 'issues', 'asked']
    expect(titleParts(need(asked), asked)).toEqual(asked)
    expect(titleParts(need(asked) - 1, asked)).toEqual(['title', 'options', 'issues'])
  })

  test('"Keep this option" goes out with the actions', () => {
    const option: TitlePart[] = ['mark', 'title', 'width', 'issues', 'keep', 'actions']
    expect(titleParts(need(option), option)).toEqual(option)
    expect(titleParts(need(option) - 1, option)).toEqual(['mark', 'title', 'width', 'issues'])
  })

  test('the icon of a relation error stays in the count when its text goes out', () => {
    const error: TitlePart[] = ['title', 'relation', 'issues']
    expect(titleParts(need(error, true), error)).toEqual(error)
    expect(titleParts(need(error, true) - 1, error)).toEqual(['title', 'issues'])
    // The issues need the room of the icon too.
    expect(titleParts(need(['title', 'issues'], true) - 1, error)).toEqual(['title'])
    expect(titleParts(need(['title', 'issues']), error)).toEqual(['title'])
  })
})

describe('titleParts with a width of its own', () => {
  test('wide pins go out at a larger width than one pin with no count', () => {
    const parts: TitlePart[] = ['title', 'issues', 'pins']
    const wide = 54
    const width = need(['title', 'issues']) + wide + titleGap
    expect(titleParts(width, parts, { pins: wide })).toEqual(parts)
    expect(titleParts(width - 1, parts, { pins: wide })).toEqual(['title', 'issues'])
    // With the fixed width they would stay.
    expect(titleParts(width - 1, parts)).toEqual(parts)
  })
})

describe('pinsWidth', () => {
  test('no pin needs no room', () => {
    expect(pinsWidth([])).toBe(0)
  })

  test('one pin with no count is as wide as its least width', () => {
    expect(pinsWidth([{ number: 1, count: 1 }])).toBe(16)
  })

  test('two pins with counts need more than the fixed width of the part', () => {
    const width = pinsWidth([
      { number: 1, count: 3 },
      { number: 2, count: 2 },
    ])
    expect(width).toBe(25 + 4 + 25)
    expect(width).toBeGreaterThan(partWidth.pins)
  })

  test('more digits take more room', () => {
    expect(pinsWidth([{ number: 12, count: 10 }])).toBe(8 + 12 + 5 + 12)
  })
})

describe('presentParts', () => {
  const none = { related: false, options: false, relationError: false, pins: false, asked: false, keep: false }

  test('a base screen with nothing more has the title, the width, the issues and the actions', () => {
    expect(presentParts(none)).toEqual(['title', 'width', 'issues', 'actions'])
  })

  test('each part that the frame has, in the order of the row', () => {
    const every = { related: true, options: true, relationError: true, pins: true, asked: true, keep: true }
    expect(presentParts(every)).toEqual(all)
  })

  test('pins and the mark of the asked options only when the frame has them', () => {
    expect(presentParts({ ...none, pins: true })).toEqual(['title', 'width', 'issues', 'pins', 'actions'])
    expect(presentParts({ ...none, asked: true })).toEqual(['title', 'width', 'issues', 'asked', 'actions'])
  })
})
