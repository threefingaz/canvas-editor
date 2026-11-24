import { describe, expect, test } from 'vitest'
import { minCropWidth } from './part.ts'
import { markText, markWidth, partWidth, pinsWidth, presentParts, relationIcon, titleGap, titleMin, titleParts, type TitlePart } from './title.ts'

// The width that the row needs for these parts, as `titleParts` counts it.
const need = (parts: readonly TitlePart[], icon = false) =>
  titleMin +
  (icon ? relationIcon + titleGap : 0) +
  parts.reduce((sum, part) => (part === 'title' ? sum : sum + partWidth[part] + titleGap), 0)

const base: TitlePart[] = ['title', 'width', 'issues', 'actions']
const all: TitlePart[] = ['mark', 'title', 'options', 'width', 'relation', 'issues', 'pins', 'asked', 'keep', 'whole', 'actions', 'menu']

test('the mark of an option is its number in a row with no room for it', () => {
  expect(markText('option', 2, markWidth(2))).toBe('Option 2')
  expect(markText('option', 2, markWidth(2) - 1)).toBe('2')
  expect(markText('option', undefined, 0)).toBe('Option')
  expect(markText('state', undefined, 0)).toBe('State')
})

describe('titleParts', () => {
  test('keeps a part of `stays` at each width', () => {
    expect(titleParts(0, all, {}, ['mark'])).toEqual(['mark', 'title'])
    expect(titleParts(need(['mark', 'title', 'menu']) - 1, all, {}, ['mark'])).toEqual(['mark', 'title'])
    expect(titleParts(0, ['title', 'menu'], {}, ['mark'])).toEqual(['title'])
  })

  test('all parts fit: each stays, in the order of the row', () => {
    expect(titleParts(1000, all)).toEqual(all)
    expect(titleParts(need(base), base)).toEqual(base)
  })

  test('the parts go out one step after the other, in a fixed order', () => {
    const steps: TitlePart[][] = [
      all,
      ['mark', 'title', 'options', 'width', 'relation', 'issues', 'pins', 'asked', 'keep', 'whole', 'menu'],
      ['mark', 'title', 'options', 'relation', 'issues', 'pins', 'asked', 'keep', 'whole', 'menu'],
      ['mark', 'title', 'options', 'issues', 'pins', 'asked', 'keep', 'whole', 'menu'],
      ['mark', 'title', 'options', 'issues', 'pins', 'keep', 'whole', 'menu'],
      ['mark', 'title', 'issues', 'pins', 'keep', 'whole', 'menu'],
      ['mark', 'title', 'issues', 'keep', 'whole', 'menu'],
      ['mark', 'title', 'keep', 'whole', 'menu'],
      ['mark', 'title', 'whole', 'menu'],
      ['mark', 'title', 'menu'],
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

  test('the menu is the last action to go out: after the counts, before the mark', () => {
    const parts: TitlePart[] = ['mark', 'title', 'width', 'issues', 'actions', 'menu']
    expect(titleParts(need(['mark', 'title', 'issues', 'menu']) - 1, parts)).toEqual(['mark', 'title', 'menu'])
    expect(titleParts(need(['mark', 'title', 'menu']) - 1, parts)).toEqual(['mark', 'title'])
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

  test('"Keep this option" and the switch of the whole screen stay after the actions and the counts', () => {
    const option: TitlePart[] = ['mark', 'title', 'width', 'issues', 'keep', 'whole', 'actions']
    expect(titleParts(need(option), option)).toEqual(option)
    expect(titleParts(need(option) - 1, option)).toEqual(['mark', 'title', 'width', 'issues', 'keep', 'whole'])
    expect(titleParts(need(['mark', 'title', 'keep', 'whole']), option)).toEqual(['mark', 'title', 'keep', 'whole'])
    expect(titleParts(need(['mark', 'title', 'keep', 'whole']) - 1, option)).toEqual(['mark', 'title', 'whole'])
  })

  test('the row of an option with a part at the least width of a crop has the mark, the title, the issues, "Keep this option", the switch and the menu', () => {
    const option: TitlePart[] = ['mark', 'title', 'width', 'issues', 'keep', 'whole', 'actions', 'menu']
    expect(titleParts(minCropWidth, option)).toEqual(['mark', 'title', 'issues', 'keep', 'whole', 'menu'])
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

describe('markText', () => {
  test('the mark of a state has no number', () => {
    expect(markText('state')).toBe('State')
    expect(markText('state', 2)).toBe('State')
  })

  test('the mark of an option has its number, also with one option', () => {
    expect(markText('option', 1)).toBe('Option 1')
    expect(markText('option', 3)).toBe('Option 3')
    expect(markText('option', 12)).toBe('Option 12')
  })

  test('an option with no number is "Option"', () => {
    expect(markText('option')).toBe('Option')
  })
})

describe('markWidth', () => {
  test('a mark with no number has the fixed width of the part', () => {
    expect(markWidth()).toBe(partWidth.mark)
  })

  test('a number makes the mark wider, and each digit more', () => {
    expect(markWidth(1)).toBe(partWidth.mark + 4 + 7)
    expect(markWidth(12)).toBe(partWidth.mark + 4 + 14)
  })

  test('the mark with a number goes out at a larger width than the mark of a state', () => {
    const parts: TitlePart[] = ['mark', 'title', 'menu']
    const mark = markWidth(3)
    const width = need(['title', 'menu']) + mark + titleGap
    expect(titleParts(width, parts, { mark })).toEqual(parts)
    expect(titleParts(width - 1, parts, { mark })).toEqual(['mark', 'title'])
    // With the fixed width the menu would stay, and the row would be too full.
    expect(titleParts(width - 1, parts)).toEqual(parts)
  })

  test('the row of an option with a part at the least width of a crop keeps its parts with a number of two digits', () => {
    const option: TitlePart[] = ['mark', 'title', 'width', 'issues', 'keep', 'whole', 'actions', 'menu']
    expect(titleParts(minCropWidth, option, { mark: markWidth(12) })).toEqual(['mark', 'title', 'issues', 'keep', 'whole', 'menu'])
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
  const none = { related: false, options: false, relationError: false, pins: false, asked: false, keep: false, part: false, menu: false }

  test('a base screen with nothing more has the title, the width, the issues and the actions', () => {
    expect(presentParts(none)).toEqual(['title', 'width', 'issues', 'actions'])
  })

  test('each part that the frame has, in the order of the row', () => {
    const every = { related: true, options: true, relationError: true, pins: true, asked: true, keep: true, part: true, menu: true }
    expect(presentParts(every)).toEqual(all)
  })

  test('the menu of the screen actions is last, and only when the frame has it', () => {
    expect(presentParts({ ...none, menu: true })).toEqual(['title', 'width', 'issues', 'actions', 'menu'])
  })

  test('pins and the mark of the asked options only when the frame has them', () => {
    expect(presentParts({ ...none, pins: true })).toEqual(['title', 'width', 'issues', 'pins', 'actions'])
    expect(presentParts({ ...none, asked: true })).toEqual(['title', 'width', 'issues', 'asked', 'actions'])
  })
})
