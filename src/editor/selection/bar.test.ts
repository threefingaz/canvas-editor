import { describe, expect, test } from 'vitest'
import { barActions, barPlace, moveSides, noSite } from './bar.ts'

const bar = { width: 120, height: 30 }
const canvas = { width: 1000, height: 800 }
const gap = 6
const strips = { top: 48, bottom: 64 }

describe('barPlace', () => {
  test('with room above, the bar is above the selection at its left edge', () => {
    expect(barPlace({ x: 200, y: 300, width: 100, height: 50 }, bar, canvas, gap, strips)).toEqual({ x: 200, y: 264 })
  })

  test('with no room above, the bar is below the selection', () => {
    expect(barPlace({ x: 200, y: 60, width: 100, height: 50 }, bar, canvas, gap, strips)).toEqual({ x: 200, y: 116 })
  })

  test('the bar that just fits above stays above', () => {
    expect(barPlace({ x: 200, y: 84, width: 100, height: 50 }, bar, canvas, gap, strips)).toEqual({ x: 200, y: 48 })
  })

  test('the left edge keeps the gap', () => {
    expect(barPlace({ x: -40, y: 300, width: 100, height: 50 }, bar, canvas, gap, strips).x).toBe(6)
  })

  test('the right edge keeps the gap and the whole bar', () => {
    expect(barPlace({ x: 950, y: 300, width: 100, height: 50 }, bar, canvas, gap, strips).x).toBe(874)
  })

  test('a selection that is larger than the canvas gives a bar at the top of the free part', () => {
    expect(barPlace({ x: -500, y: -400, width: 3000, height: 2000 }, bar, canvas, gap, strips)).toEqual({ x: 6, y: 48 })
  })

  test('with room on neither side, the bar is inside the selection at its top', () => {
    expect(barPlace({ x: 200, y: 60, width: 100, height: 650 }, bar, canvas, gap, strips).y).toBe(60)
  })

  test('the strip of the toolbar counts as no room below', () => {
    expect(barPlace({ x: 200, y: 60, width: 100, height: 620 }, bar, canvas, gap, strips).y).toBe(686)
    expect(barPlace({ x: 200, y: 60, width: 100, height: 650 }, bar, canvas, gap, { top: 48, bottom: 0 }).y).toBe(716)
  })

  test('a selection below the view gives a bar at the bottom of the free part', () => {
    expect(barPlace({ x: 200, y: 1200, width: 100, height: 50 }, bar, canvas, gap, strips).y).toBe(706)
  })

  test('a selection above the view gives a bar at the top of the free part', () => {
    expect(barPlace({ x: 200, y: -300, width: 100, height: 50 }, bar, canvas, gap, strips).y).toBe(48)
  })

  test('the strip of the notice counts as no room above', () => {
    expect(barPlace({ x: 200, y: 80, width: 100, height: 50 }, bar, canvas, gap, { top: 0, bottom: 0 }).y).toBe(44)
    expect(barPlace({ x: 200, y: 80, width: 100, height: 50 }, bar, canvas, gap, strips).y).toBe(136)
  })

  test('a canvas that is smaller than the bar gives the top left corner of the free part', () => {
    expect(barPlace({ x: 20, y: 20, width: 10, height: 10 }, bar, { width: 80, height: 100 }, gap, strips)).toEqual({ x: 6, y: 48 })
  })
})

describe('barActions', () => {
  test('an element of a base screen has the three actions, each on', () => {
    expect(barActions({ option: false, block: null, site: true })).toEqual({ actions: ['comment', 'options', 'remove'], off: null })
  })

  test('an option has no "Ask for options"', () => {
    expect(barActions({ option: true, block: null, site: true })).toEqual({ actions: ['comment', 'remove'], off: null })
  })

  test('an open keep turns each action off with its reason', () => {
    const block = 'The screen has an open request to keep an option. Apply or discard it first.'
    expect(barActions({ option: false, block, site: true })).toEqual({ actions: ['comment', 'options', 'remove'], off: block })
  })

  test('an option with an open keep has no "Ask for options", and its other actions are off with the reason', () => {
    expect(barActions({ option: true, block: 'blocked', site: true })).toEqual({ actions: ['comment', 'remove'], off: 'blocked' })
  })

  test('an element with no site takes no edit', () => {
    expect(barActions({ option: false, block: null, site: false }).off).toBe(noSite)
  })

  test('no site wins over a block, and an option with no site still has no options', () => {
    expect(barActions({ option: true, block: 'blocked', site: false })).toEqual({ actions: ['comment', 'remove'], off: noSite })
  })
})

describe('moveSides', () => {
  test('a row moves left and right', () => {
    expect(moveSides({ axis: 'row', reversed: false })).toEqual([
      { arrow: 'left', label: 'Move left (←)' },
      { arrow: 'right', label: 'Move right (→)' },
    ])
  })

  test('a column moves up and down', () => {
    expect(moveSides({ axis: 'column', reversed: false })).toEqual([
      { arrow: 'up', label: 'Move up (↑)' },
      { arrow: 'down', label: 'Move down (↓)' },
    ])
  })

  test('a reversed row names the same directions on the screen', () => {
    expect(moveSides({ axis: 'row', reversed: true })).toEqual(moveSides({ axis: 'row', reversed: false }))
  })
})
