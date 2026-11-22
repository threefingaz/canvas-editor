import { describe, expect, test } from 'vitest'
import { canvasColor, edgeColor, frameMark, frameShadow, markColor } from './edge.ts'

const none = { kept: false, marked: false, listed: false }

describe('frameMark', () => {
  test('no mark', () => {
    expect(frameMark(none)).toBeNull()
  })

  test('the priority: kept, then marked, then listed', () => {
    expect(frameMark({ kept: true, marked: true, listed: true })).toBe('kept')
    expect(frameMark({ kept: false, marked: true, listed: true })).toBe('marked')
    expect(frameMark({ ...none, listed: true })).toBe('listed')
  })
})

describe('frameShadow', () => {
  test('the edge alone, with a width that is fixed on the screen', () => {
    expect(frameShadow(none, 1)).toBe(`0 0 0 1px ${edgeColor}`)
    expect(frameShadow(none, 0.25)).toBe(`0 0 0 4px ${edgeColor}`)
    expect(frameShadow(none, 2)).toBe(`0 0 0 0.5px ${edgeColor}`)
  })

  test('a mark is a ring at a distance, above the color of the canvas; the edge stays on top', () => {
    expect(frameShadow({ ...none, marked: true }, 1)).toBe(
      `0 0 0 1px ${edgeColor}, 0 0 0 4px ${canvasColor}, 0 0 0 7px ${markColor.marked}`,
    )
    expect(frameShadow({ ...none, kept: true, marked: true }, 0.5)).toBe(
      `0 0 0 2px ${edgeColor}, 0 0 0 8px ${canvasColor}, 0 0 0 14px ${markColor.kept}`,
    )
    expect(frameShadow({ ...none, listed: true }, 1)).toContain(markColor.listed)
  })
})
