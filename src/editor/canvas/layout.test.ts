import { describe, expect, test } from 'vitest'
import { cropOf } from './part.ts'
import {
  defaultFrameHeight,
  errorFrameHeight,
  frameGap,
  frameHeight,
  groupGap,
  keepKeys,
  layoutFrames,
  maxFrameHeight,
  measureHeight,
  optionGap,
  rowGap,
  shownRect,
  type LayoutScreen,
  type MeasuredFrame,
} from './layout.ts'

function screen(id: string, width: number, error?: string): LayoutScreen {
  const slash = id.lastIndexOf('/')
  return { id, flow: slash === -1 ? '' : id.slice(0, slash), width, error }
}

function state(id: string, width: number, stateOf: string): LayoutScreen {
  return { ...screen(id, width), stateOf }
}

function option(id: string, width: number, optionOf: string): LayoutScreen {
  return { ...screen(id, width), optionOf }
}

// The id and the place of each frame, in the order of the layout.
function places(screens: readonly LayoutScreen[], heights: ReadonlyMap<string, number> = new Map()) {
  return layoutFrames(screens, heights).frames.map((frame) => [frame.screen.id, frame.x, frame.y])
}

const none = new Map<string, number>()

describe('layoutFrames', () => {
  test('puts the frames of one flow in one row, left to right with the gap of two groups', () => {
    const screens = [screen('onboarding/welcome', 1440), screen('onboarding/welcome-mobile', 390)]
    const heights = new Map([
      ['onboarding/welcome', 1000],
      ['onboarding/welcome-mobile', 800],
    ])
    expect(layoutFrames(screens, heights).frames).toEqual([
      { screen: screens[0], x: 0, y: 0, width: 1440, height: 1000 },
      { screen: screens[1], x: 1440 + groupGap, y: 0, width: 390, height: 800 },
    ])
  })

  test('puts each flow in its own row, in the order of the list', () => {
    const screens = [screen('a/one', 1440), screen('b/one', 390), screen('a/two', 390)]
    const frames = layoutFrames(screens, none).frames
    expect(frames.map((frame) => [frame.screen.id, frame.x, frame.y])).toEqual([
      ['a/one', 0, 0],
      ['a/two', 1440 + groupGap, 0],
      ['b/one', 0, defaultFrameHeight + rowGap],
    ])
  })

  test('makes a row as high as its highest frame', () => {
    const screens = [screen('a/short', 390), screen('a/tall', 390), screen('b/next', 390)]
    const heights = new Map([
      ['a/short', 400],
      ['a/tall', 2000],
      ['b/next', 500],
    ])
    const next = layoutFrames(screens, heights).frames.find((frame) => frame.screen.id === 'b/next')
    expect(next?.y).toBe(2000 + rowGap)
  })

  test('gives a frame with no known height the default height', () => {
    const [frame] = layoutFrames([screen('a/one', 1024)], none).frames
    expect(frame.height).toBe(defaultFrameHeight)
  })

  test('gives an entry with an error the height of an error frame', () => {
    const [frame] = layoutFrames([screen('a/broken', 1440, 'a/broken.tsx: no meta')], none).frames
    expect(frame.height).toBe(errorFrameHeight)
  })

  test('a known height wins over the default', () => {
    const [frame] = layoutFrames([screen('a/broken', 1440, 'no meta')], new Map([['a/broken', 120]])).frames
    expect(frame.height).toBe(120)
  })

  test('puts the screens with no flow in a row of their own', () => {
    const frames = layoutFrames([screen('home', 1440), screen('a/one', 390)], none).frames
    expect(frames.map((frame) => [frame.screen.id, frame.y])).toEqual([
      ['home', 0],
      ['a/one', defaultFrameHeight + rowGap],
    ])
  })

  test('gives the bounds of all frames', () => {
    const screens = [screen('a/one', 1440), screen('a/two', 390), screen('b/one', 1024)]
    const heights = new Map([
      ['a/one', 1000],
      ['a/two', 1200],
      ['b/one', 700],
    ])
    expect(layoutFrames(screens, heights).bounds).toEqual({
      x: 0,
      y: 0,
      width: 1440 + groupGap + 390,
      height: 1200 + rowGap + 700,
    })
  })

  test('puts a base and its states next to each other, and the next group after the gap of two groups', () => {
    const screens = [
      screen('a/one', 1440),
      state('a/one-error', 1440, 'a/one'),
      screen('a/two', 390),
      state('a/one-done', 1024, 'a/one'),
    ]
    expect(places(screens)).toEqual([
      ['a/one', 0, 0],
      ['a/one-error', 1440 + frameGap, 0],
      ['a/one-done', 2 * 1440 + 2 * frameGap, 0],
      ['a/two', 2 * 1440 + 2 * frameGap + 1024 + groupGap, 0],
    ])
  })

  test('puts the options of a frame in a column below it, in the order of the list', () => {
    const screens = [
      screen('a/one', 1440),
      option('a/one-option-1', 1440, 'a/one'),
      option('a/one-option-2', 1440, 'a/one'),
    ]
    const heights = new Map([
      ['a/one', 1000],
      ['a/one-option-1', 1200],
    ])
    expect(places(screens, heights)).toEqual([
      ['a/one', 0, 0],
      ['a/one-option-1', 0, 1000 + optionGap],
      ['a/one-option-2', 0, 1000 + optionGap + 1200 + optionGap],
    ])
  })

  test('puts the options of a state below the state', () => {
    const screens = [
      screen('a/one', 1440),
      state('a/one-error', 1440, 'a/one'),
      option('a/one-error-option-1', 1440, 'a/one-error'),
    ]
    expect(places(screens)).toEqual([
      ['a/one', 0, 0],
      ['a/one-error', 1440 + frameGap, 0],
      ['a/one-error-option-1', 1440 + frameGap, defaultFrameHeight + optionGap],
    ])
  })

  test('makes a column as wide as its widest frame: an option that is wider than its base', () => {
    const screens = [
      screen('a/one', 390),
      option('a/one-option-1', 1440, 'a/one'),
      state('a/one-error', 390, 'a/one'),
      screen('a/two', 390),
    ]
    expect(places(screens)).toEqual([
      ['a/one', 0, 0],
      ['a/one-option-1', 0, defaultFrameHeight + optionGap],
      ['a/one-error', 1440 + frameGap, 0],
      ['a/two', 1440 + frameGap + 390 + groupGap, 0],
    ])
  })

  test('makes a row as high as its highest column', () => {
    const screens = [
      screen('a/one', 1440),
      option('a/one-option-1', 1440, 'a/one'),
      screen('a/tall', 390),
      screen('b/next', 390),
    ]
    const heights = new Map([
      ['a/one', 1000],
      ['a/one-option-1', 1100],
      ['a/tall', 2000],
    ])
    const next = layoutFrames(screens, heights).frames.find((frame) => frame.screen.id === 'b/next')
    expect(next?.y).toBe(1000 + optionGap + 1100 + rowGap)
  })

  test('gives the bounds with the states and the options', () => {
    const screens = [
      screen('a/one', 390),
      option('a/one-option-1', 1440, 'a/one'),
      state('a/one-error', 390, 'a/one'),
      screen('b/one', 1024),
    ]
    const heights = new Map([
      ['a/one', 1000],
      ['a/one-option-1', 900],
      ['b/one', 700],
    ])
    expect(layoutFrames(screens, heights).bounds).toEqual({
      x: 0,
      y: 0,
      width: 1440 + frameGap + 390,
      height: 1000 + optionGap + 900 + rowGap + 700,
    })
  })

  test('the space between two groups is wider than the space in a group, and an option has the space of a row', () => {
    expect(groupGap).toBeGreaterThan(frameGap)
    expect(optionGap).toBe(rowGap)
  })

  test('gives empty bounds for no screens', () => {
    expect(layoutFrames([], none)).toEqual({ frames: [], bounds: { x: 0, y: 0, width: 0, height: 0 } })
  })
})

describe('layoutFrames with the part of an option', () => {
  const screens = [
    screen('a/one', 1440),
    option('a/one-option-1', 1440, 'a/one'),
    option('a/one-option-2', 1440, 'a/one'),
    screen('a/two', 390),
  ]
  const heights = new Map([['a/one', 1000]])
  const part = { x: 400, y: 300, width: 600, height: 200 }
  const crop = cropOf(part, { width: 1440, height: defaultFrameHeight })

  test('a frame with a part keeps the size of its iframe and gets the crop', () => {
    const { frames } = layoutFrames(screens, heights, new Map([['a/one-option-1', part]]))
    // The title row has the width of the column: the base is the widest.
    expect(frames[1]).toMatchObject({ width: 1440, height: defaultFrameHeight, crop, titleWidth: 1440 })
    expect('titleWidth' in frames[0]).toBe(false)
    expect('crop' in frames[0]).toBe(false)
    expect('crop' in frames[2]).toBe(false)
  })

  test('the crop is where the box of a whole frame would be', () => {
    const whole = layoutFrames(screens, heights).frames[1]
    const cropped = layoutFrames(screens, heights, new Map([['a/one-option-1', part]])).frames[1]
    expect(shownRect(cropped)).toEqual({ x: whole.x, y: whole.y, width: crop.width, height: crop.height })
    // The corner of the iframe is shifted by the corner of the crop.
    expect([cropped.x, cropped.y]).toEqual([whole.x - crop.x, whole.y - crop.y])
  })

  test('the next option comes after the height of the crop', () => {
    const { frames } = layoutFrames(screens, heights, new Map([['a/one-option-1', part]]))
    expect(frames[2].y).toBe(1000 + optionGap + crop.height + optionGap)
  })

  test('a column of cropped options is as wide as its base, and the row as high as its crops', () => {
    const parts = new Map([
      ['a/one-option-1', part],
      ['a/one-option-2', part],
    ])
    const { frames, bounds } = layoutFrames(screens, heights, parts)
    expect(frames[3].x).toBe(1440 + groupGap)
    expect(bounds).toEqual({ x: 0, y: 0, width: 1440 + groupGap + 390, height: 1000 + (optionGap + crop.height) * 2 })
  })

  test('a frame of a file with an error has no crop', () => {
    const broken = [screen('a/one', 1440), { ...option('a/one-option-1', 1440, 'a/one'), error: 'broken' }]
    expect('crop' in layoutFrames(broken, none, new Map([['a/one-option-1', part]])).frames[1]).toBe(false)
  })
})

describe('shownRect', () => {
  test('a whole frame shows its box', () => {
    expect(shownRect({ x: 10, y: 20, width: 1440, height: 900 })).toEqual({ x: 10, y: 20, width: 1440, height: 900 })
  })

  test('a frame with a crop shows the crop, from the corner of its box', () => {
    const box = { x: -376, y: 1084, width: 1440, height: 900, crop: { x: 376, y: 276, width: 648, height: 248 } }
    expect(shownRect(box)).toEqual({ x: 0, y: 1360, width: 648, height: 248 })
  })
})

describe('frameHeight', () => {
  test('rounds a measured height up to a whole pixel', () => {
    expect(frameHeight(defaultFrameHeight + 12.2)).toBe(defaultFrameHeight + 13)
  })

  test('gives a short or empty document the viewport height', () => {
    expect(frameHeight(88)).toBe(defaultFrameHeight)
    expect(frameHeight(0)).toBe(defaultFrameHeight)
  })

  test('limits a document that keeps growing', () => {
    expect(frameHeight(1e9)).toBe(maxFrameHeight)
  })
})

// An iframe whose document is as high as its content, or as high as its
// viewport when `fill` (a `minHeight: '100vh'` root), plus `margin`. It keeps
// each write of the height.
function fakeFrame(content: number, { fill = false, margin = 0, height = '' } = {}) {
  const writes: string[] = []
  let current = height
  const frame: MeasuredFrame = {
    style: {
      get height() {
        return current
      },
      set height(value: string) {
        writes.push(value)
        current = value
      },
    },
    contentDocument: {
      documentElement: {
        get scrollHeight() {
          const viewport = parseFloat(current) || 150
          return Math.max(viewport, (fill ? Math.max(content, viewport) : content) + margin)
        },
      },
    },
  }
  return { frame, writes }
}

describe('measureHeight', () => {
  test('measures at the least height and sets the result', () => {
    const { frame, writes } = fakeFrame(1500.4, { height: '1200px' })
    expect(measureHeight(frame)).toBe(1501)
    expect(writes).toEqual([`${defaultFrameHeight}px`, '1501px'])
    expect(frame.style.height).toBe('1501px')
  })

  test('gives a screen that fills its viewport the height of its content', () => {
    const { frame } = fakeFrame(1300, { fill: true, height: '2000px' })
    expect(measureHeight(frame)).toBe(1300)
  })

  test('lets a screen that fills its viewport get smaller', () => {
    const { frame } = fakeFrame(400, { fill: true, height: '1800px' })
    expect(measureHeight(frame)).toBe(defaultFrameHeight)
    expect(frame.style.height).toBe(`${defaultFrameHeight}px`)
  })

  test('does not let a viewport screen with a margin grow at each measure', () => {
    const { frame } = fakeFrame(0, { fill: true, margin: 16 })
    expect(measureHeight(frame)).toBe(defaultFrameHeight + 16)
    expect(measureHeight(frame)).toBe(defaultFrameHeight + 16)
  })

  test('gives a short document the least height', () => {
    const { frame } = fakeFrame(88)
    expect(measureHeight(frame)).toBe(defaultFrameHeight)
  })

  test('stops at the most height', () => {
    const { frame } = fakeFrame(1e9, { height: '900px' })
    expect(measureHeight(frame)).toBe(maxFrameHeight)
    expect(frame.style.height).toBe(`${maxFrameHeight}px`)
  })

  test('writes no second time when the result is the least height', () => {
    const { frame, writes } = fakeFrame(300, { height: '1400px' })
    measureHeight(frame)
    expect(writes).toEqual([`${defaultFrameHeight}px`])
  })

  test('writes nothing when the frame has the least height and the result is equal', () => {
    const { frame, writes } = fakeFrame(300, { height: `${defaultFrameHeight}px` })
    expect(measureHeight(frame)).toBe(defaultFrameHeight)
    expect(writes).toEqual([])
  })

  test('gives null and writes nothing for a frame with no document', () => {
    const writes: string[] = []
    const frame: MeasuredFrame = {
      style: {
        get height() {
          return ''
        },
        set height(value: string) {
          writes.push(value)
        },
      },
      contentDocument: null,
    }
    expect(measureHeight(frame)).toBeNull()
    expect(writes).toEqual([])
  })
})

describe('keepKeys', () => {
  test('gives the same map when each key is kept', () => {
    const map = new Map([['a/one', 1]])
    expect(keepKeys(map, new Set(['a/one', 'a/two']))).toBe(map)
  })

  test('leaves out the entries of the other keys', () => {
    const map = new Map([
      ['a/one', 1],
      ['a/gone', 2],
    ])
    expect([...keepKeys(map, new Set(['a/one']))]).toEqual([['a/one', 1]])
  })
})
