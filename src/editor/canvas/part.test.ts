import { describe, expect, test, vi } from 'vitest'
import {
  createPartRectsStore,
  createWholeShownStore,
  cropClip,
  cropMargin,
  cropOf,
  croppedParts,
  inCrop,
  minCropHeight,
  minCropWidth,
  partLoc,
  partRectOf,
  partSwitch,
} from './part.ts'
import type { Rect } from './viewport.ts'

const node = (rect: Rect, isConnected = true) => ({ isConnected, getBoundingClientRect: () => rect })
const shown = () => false

describe('partLoc', () => {
  test('the location of the part is the file with the place', () => {
    expect(partLoc({ file: 'screens/a/one-option-1.tsx', part: '12:7' })).toBe('screens/a/one-option-1.tsx:12:7')
  })

  test('a screen with no part, or with an error of the file, has none', () => {
    expect(partLoc({ file: 'screens/a/one.tsx' })).toBeNull()
    expect(partLoc({ file: 'screens/a/one.tsx', part: '12:7', error: 'broken' })).toBeNull()
  })
})

describe('partRectOf', () => {
  test('one node gives its rectangle', () => {
    expect(partRectOf([node({ x: 10, y: 20, width: 300, height: 40 })], shown)).toEqual({ x: 10, y: 20, width: 300, height: 40 })
  })

  test('the copies of a place give their union', () => {
    const nodes = [node({ x: 10, y: 20, width: 100, height: 40 }), node({ x: 200, y: 50, width: 100, height: 40 })]
    expect(partRectOf(nodes, shown)).toEqual({ x: 10, y: 20, width: 290, height: 70 })
  })

  test('a node out of the document, a hidden node and a node with no size do not count', () => {
    const gone = node({ x: 0, y: 0, width: 900, height: 900 }, false)
    const hiddenNode = node({ x: 0, y: 0, width: 800, height: 800 })
    const empty = node({ x: 0, y: 0, width: 0, height: 0 })
    const real = node({ x: 10, y: 20, width: 100, height: 40 })
    expect(partRectOf([gone, hiddenNode, empty, real], (item) => item === hiddenNode)).toEqual({ x: 10, y: 20, width: 100, height: 40 })
  })

  test('no node that counts gives null', () => {
    expect(partRectOf([], shown)).toBeNull()
    expect(partRectOf([node({ x: 0, y: 0, width: 0, height: 0 })], shown)).toBeNull()
  })
})

describe('cropOf', () => {
  const frame = { width: 1440, height: 900 }

  test('the crop is the part with the margin around it', () => {
    expect(cropOf({ x: 400, y: 300, width: 600, height: 200 }, frame)).toEqual({
      x: 400 - cropMargin,
      y: 300 - cropMargin,
      width: 600 + cropMargin * 2,
      height: 200 + cropMargin * 2,
    })
  })

  test('a small part gets the least size, with the part in the middle', () => {
    const crop = cropOf({ x: 700, y: 400, width: 40, height: 20 }, frame)
    expect(crop).toEqual({ x: 720 - minCropWidth / 2, y: 410 - minCropHeight / 2, width: minCropWidth, height: minCropHeight })
  })

  test('the crop stays in the frame', () => {
    expect(cropOf({ x: 0, y: 0, width: 100, height: 20 }, frame)).toEqual({ x: 0, y: 0, width: minCropWidth, height: minCropHeight })
    expect(cropOf({ x: 1340, y: 880, width: 100, height: 20 }, frame)).toEqual({
      x: 1440 - minCropWidth,
      y: 900 - minCropHeight,
      width: minCropWidth,
      height: minCropHeight,
    })
  })

  test('a part that is as large as the frame gives the frame', () => {
    expect(cropOf({ x: 0, y: 0, width: 1440, height: 900 }, frame)).toEqual({ x: 0, y: 0, width: 1440, height: 900 })
    expect(cropOf({ x: -50, y: -50, width: 2000, height: 2000 }, frame)).toEqual({ x: 0, y: 0, width: 1440, height: 900 })
  })

  test('a frame that is narrower than the least width gives its width', () => {
    expect(cropOf({ x: 20, y: 300, width: 100, height: 200 }, { width: 320, height: 900 })).toMatchObject({ x: 0, width: 320 })
  })

  test('the crop is in whole px', () => {
    const crop = cropOf({ x: 400.4, y: 300.6, width: 600.3, height: 200.7 }, frame)
    for (const value of Object.values(crop)) expect(Number.isInteger(value)).toBe(true)
    // The part is in the crop.
    expect(crop.x).toBeLessThanOrEqual(400.4)
    expect(crop.x + crop.width).toBeGreaterThanOrEqual(400.4 + 600.3)
  })
})

describe('cropClip', () => {
  test('the inset of each side of the iframe box', () => {
    expect(cropClip({ x: 376, y: 276, width: 648, height: 248 }, { width: 1440, height: 900 })).toBe('inset(276px 416px 376px 376px)')
  })
})

describe('inCrop', () => {
  const crop = { x: 100, y: 100, width: 400, height: 200 }

  test('a frame with no crop keeps the rectangle', () => {
    const rect = { x: 0, y: 0, width: 1440, height: 900 }
    expect(inCrop(rect, null)).toBe(rect)
  })

  test('a rectangle in the crop stays', () => {
    expect(inCrop({ x: 150, y: 150, width: 50, height: 20 }, crop)).toEqual({ x: 150, y: 150, width: 50, height: 20 })
  })

  test('a rectangle that is larger than the crop ends at the crop', () => {
    expect(inCrop({ x: 0, y: 0, width: 1440, height: 900 }, crop)).toEqual(crop)
    expect(inCrop({ x: 450, y: 50, width: 200, height: 100 }, crop)).toEqual({ x: 450, y: 100, width: 50, height: 50 })
  })

  test('a rectangle out of the crop gives null', () => {
    expect(inCrop({ x: 600, y: 150, width: 50, height: 20 }, crop)).toBeNull()
    expect(inCrop({ x: 150, y: 400, width: 50, height: 20 }, crop)).toBeNull()
  })
})

describe('croppedParts', () => {
  const parts = new Map([
    ['a/one-option-1', { x: 0, y: 0, width: 10, height: 10 }],
    ['a/one-option-2', { x: 0, y: 0, width: 20, height: 20 }],
  ])

  test('each measured part is cropped', () => {
    expect(croppedParts(parts, new Set())).toBe(parts)
  })

  test('a screen that shows whole is left out', () => {
    expect([...croppedParts(parts, new Set(['a/one-option-1'])).keys()]).toEqual(['a/one-option-2'])
  })
})

describe('partSwitch', () => {
  test('the label names what a click does', () => {
    expect(partSwitch(false)).toEqual({ label: 'Show the whole screen', next: 'whole' })
    expect(partSwitch(true)).toEqual({ label: 'Show the block only', next: 'part' })
  })
})

describe('the store of the part rectangles', () => {
  test('a new rectangle gives a new map and a call of the listener', () => {
    const store = createPartRectsStore()
    const listener = vi.fn()
    store.subscribe(listener)
    const before = store.get()
    store.set('a/one', { x: 1, y: 2, width: 3, height: 4 })
    expect(store.get()).not.toBe(before)
    expect(store.get().get('a/one')).toEqual({ x: 1, y: 2, width: 3, height: 4 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('an equal rectangle changes nothing', () => {
    const store = createPartRectsStore()
    store.set('a/one', { x: 1, y: 2, width: 3, height: 4 })
    const listener = vi.fn()
    store.subscribe(listener)
    const before = store.get()
    store.set('a/one', { x: 1, y: 2, width: 3, height: 4 })
    expect(store.get()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })

  test('a delete takes the entry out, and does nothing with no entry', () => {
    const store = createPartRectsStore()
    store.set('a/one', { x: 1, y: 2, width: 3, height: 4 })
    const listener = vi.fn()
    const stop = store.subscribe(listener)
    store.delete('a/two')
    expect(listener).not.toHaveBeenCalled()
    store.delete('a/one')
    expect(store.get().size).toBe(0)
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    store.set('a/one', { x: 1, y: 2, width: 3, height: 4 })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('the store of the screens that show whole', () => {
  test('a toggle adds the screen, and a second one takes it out', () => {
    const store = createWholeShownStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.toggle('a/one')
    expect([...store.get()]).toEqual(['a/one'])
    store.toggle('a/one')
    expect(store.get().size).toBe(0)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  test('a delete of a screen that is not in the set changes nothing', () => {
    const store = createWholeShownStore()
    store.toggle('a/one')
    const before = store.get()
    const listener = vi.fn()
    store.subscribe(listener)
    store.delete('a/two')
    expect(store.get()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
    store.delete('a/one')
    expect(store.get().size).toBe(0)
  })
})
