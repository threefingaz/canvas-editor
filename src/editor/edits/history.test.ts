import { describe, expect, test } from 'vitest'
import { canRedo, canUndo, dropRepeats, historyLimit, mapHistory, record, redo, startHistory, undo } from './history.ts'

describe('history', () => {
  test('a new history has nothing to undo or redo', () => {
    const history = startHistory('a')
    expect(history.present).toBe('a')
    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(false)
  })

  test('record makes the value present and keeps the earlier value', () => {
    const history = record(record(startHistory('a'), 'b'), 'c')
    expect(history.present).toBe('c')
    expect(canUndo(history)).toBe(true)
    expect(canRedo(history)).toBe(false)
  })

  test('undo goes back one record and redo goes forward again', () => {
    const history = record(record(startHistory('a'), 'b'), 'c')
    const back = undo(undo(history))
    expect(back.present).toBe('a')
    expect(canUndo(back)).toBe(false)
    expect(canRedo(back)).toBe(true)
    const forward = redo(back)
    expect(forward.present).toBe('b')
    expect(redo(forward).present).toBe('c')
  })

  test('undo and redo with nothing to do give the same history', () => {
    const history = startHistory('a')
    expect(undo(history)).toBe(history)
    expect(redo(history)).toBe(history)
  })

  test('a new record after an undo clears the redo side', () => {
    const history = record(undo(record(record(startHistory('a'), 'b'), 'c')), 'd')
    expect(history.present).toBe('d')
    expect(canRedo(history)).toBe(false)
    expect(undo(history).present).toBe('b')
  })

  test(`keeps at most ${historyLimit} earlier records`, () => {
    let history = startHistory(0)
    for (let value = 1; value <= historyLimit + 20; value++) history = record(history, value)
    let steps = 0
    while (canUndo(history)) {
      history = undo(history)
      steps++
    }
    expect(steps).toBe(historyLimit)
    expect(history.present).toBe(20)
  })

  test('mapHistory changes each value and keeps the position', () => {
    const history = undo(record(record(startHistory('a'), 'b'), 'c'))
    const upper = mapHistory(history, (value) => value.toUpperCase())
    expect(upper.present).toBe('B')
    expect(undo(upper).present).toBe('A')
    expect(redo(upper).present).toBe('C')
  })
})

describe('dropRepeats', () => {
  const same = (a: number, b: number) => a === b

  test('takes out each version equal to the one before it', () => {
    expect(dropRepeats({ past: [1, 1, 2], present: 2, future: [3, 3, 4] }, same)).toEqual({
      past: [1],
      present: 2,
      future: [3, 4],
    })
  })

  test('keeps a history with no repeats', () => {
    expect(dropRepeats({ past: [1, 2], present: 3, future: [4] }, same)).toEqual({ past: [1, 2], present: 3, future: [4] })
  })

  test('all versions equal: nothing to undo or redo', () => {
    expect(dropRepeats({ past: [5, 5], present: 5, future: [5] }, same)).toEqual({ past: [], present: 5, future: [] })
  })
})
