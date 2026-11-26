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
  hidingParts,
  measureHeight,
  partsSelector,
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

  test('gives each option its number among the options of its frame, in the order of the list', () => {
    const screens = [
      screen('a/one', 1440),
      option('a/one-b', 1440, 'a/one'),
      state('a/one-error', 1440, 'a/one'),
      option('a/one-error-a', 1440, 'a/one-error'),
      option('a/one-a', 1440, 'a/one'),
      option('a/one-c', 1440, 'a/one'),
      screen('a/two', 1440),
      // An option of a screen that is not in the list is a group of its own.
      option('a/lost', 1440, 'a/none'),
    ]
    const numbers = layoutFrames(screens, new Map()).frames.map((frame) => [frame.screen.id, frame.optionNumber])
    expect(numbers).toEqual([
      ['a/one', undefined],
      ['a/one-b', 1],
      ['a/one-a', 2],
      ['a/one-c', 3],
      ['a/one-error', undefined],
      ['a/one-error-a', 1],
      ['a/two', undefined],
      ['a/lost', undefined],
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
  // A part of the frame. A part with a `share` gets that share of each px of
  // the frame above 100 px; with no share it has a height of its own. With
  // `grows`, its content is always that much taller than the part.
  const partOf = (frame: { style: { height: string } }, content: number, { share = 1, own = 0, grows = 0, fits = false } = {}) => ({
    get clientHeight() {
      const room = own > 0 ? own : (parseFloat(frame.style.height) - 100) * share
      // With `fits`, the part is not taller than its content.
      return fits ? Math.min(room, content) : room
    },
    get scrollHeight() {
      return grows > 0 ? this.clientHeight + grows : content
    },
  })

  test('grows for a part that follows the viewport and hides content', () => {
    const { frame } = fakeFrame(defaultFrameHeight, { fill: true })
    const part = partOf(frame, 2000)
    // 2000 of content in a part of 800 at the least height: 1200 more.
    expect(measureHeight(frame, () => [part])).toBe(defaultFrameHeight + 1200)
    expect(frame.style.height).toBe(`${defaultFrameHeight + 1200}px`)
    expect(part.scrollHeight - part.clientHeight).toBe(0)
    expect(measureHeight(frame, () => [part])).toBe(defaultFrameHeight + 1200)
  })

  test('takes the part that hides the most, and leaves a part with a height of its own', () => {
    const { frame } = fakeFrame(defaultFrameHeight, { fill: true })
    const parts = [partOf(frame, 1000), partOf(frame, 1500), partOf(frame, 9000, { own: 200 })]
    expect(measureHeight(frame, () => parts)).toBe(defaultFrameHeight + 700)
    expect(measureHeight(frame, () => [parts[2]])).toBe(defaultFrameHeight)
    expect(frame.style.height).toBe(`${defaultFrameHeight}px`)
  })

  test('grows by the share of the height that the part gets', () => {
    const { frame } = fakeFrame(defaultFrameHeight, { fill: true })
    // A half of the frame: 400 at the least height, 1200 of content.
    const part = partOf(frame, 1200, { share: 0.5 })
    expect(measureHeight(frame, () => [part])).toBe(defaultFrameHeight + 1600)
    expect(part.scrollHeight - part.clientHeight).toBe(0)
  })

  test('looks again when the content of a part gets taller with the frame', () => {
    const { frame } = fakeFrame(defaultFrameHeight, { fill: true })
    // The content has a child of 40 % of the frame height, up to 600 px.
    const part = {
      get clientHeight() {
        return parseFloat(frame.style.height) - 100
      },
      get scrollHeight() {
        return 1000 + Math.min(600, parseFloat(frame.style.height) * 0.4)
      },
    }
    const height = measureHeight(frame, () => [part])!
    expect(height).toBe(1700)
    expect(part.scrollHeight - part.clientHeight).toBe(0)
    expect(measureHeight(frame, () => [part])).toBe(1700)
  })

  test('does not grow for a part with a small share of the viewport', () => {
    const { frame } = fakeFrame(defaultFrameHeight, { fill: true })
    expect(measureHeight(frame, () => [partOf(frame, 1800, { share: 0.4 })])).toBe(defaultFrameHeight)
  })

  test('grows only by what a part hides when the part stops at its content', () => {
    const { frame } = fakeFrame(defaultFrameHeight, { fill: true })
    // 805 of content in 800: 5 more, not the probe.
    expect(measureHeight(frame, () => [partOf(frame, 805, { fits: true })])).toBe(defaultFrameHeight + 5)
    // A half share: 80 hidden needs 160. The same at a second measure.
    const half = partOf(frame, 480, { share: 0.5, fits: true })
    expect(measureHeight(frame, () => [half])).toBe(defaultFrameHeight + 160)
    expect(measureHeight(frame, () => [half])).toBe(defaultFrameHeight + 160)
    // A share of 0.4 (a list with a greatest height): no growth.
    expect(measureHeight(frame, () => [partOf(frame, 350, { share: 0.4, fits: true })])).toBe(defaultFrameHeight)
  })

  test('takes a share of more than one as a full share', () => {
    const { frame } = fakeFrame(defaultFrameHeight, { fill: true })
    // 1600 at the least height, 2000 of content: 400 hidden, and a full share at most.
    expect(measureHeight(frame, () => [partOf(frame, 2000, { share: 2 })])).toBe(defaultFrameHeight + 400)
  })

  test('stops at the most height for a part with very long content', () => {
    const { frame } = fakeFrame(defaultFrameHeight, { fill: true })
    expect(measureHeight(frame, () => [partOf(frame, 1e9)])).toBe(maxFrameHeight)
    expect(frame.style.height).toBe(`${maxFrameHeight}px`)
  })

  test('ends after a few rounds for content that gets taller with the frame and never fits', () => {
    const { frame, writes } = fakeFrame(defaultFrameHeight, { fill: true })
    // The content is 1.5 times the part and 100 more: it hides less at the
    // probe (it has a least height of 1300), and more at each taller frame.
    const part = {
      get clientHeight() {
        return parseFloat(frame.style.height) - 100
      },
      get scrollHeight() {
        return Math.max(1300, this.clientHeight * 1.5 - 200)
      },
    }
    const height = measureHeight(frame, () => [part])!
    expect(height).toBeGreaterThan(defaultFrameHeight)
    expect(height).toBeLessThanOrEqual(maxFrameHeight)
    // The least height, the probe, four rounds at most, and the result.
    expect(writes.length).toBeLessThanOrEqual(8)
    expect(measureHeight(frame, () => [part])).toBe(height)
  })

  test('a part that stops at its content and a part that follows: the taller need wins', () => {
    const { frame } = fakeFrame(defaultFrameHeight, { fill: true })
    const follower = partOf(frame, 2000)
    // A half share that stops at its content: 80 hidden needs 160, less than the follower.
    const stopped = partOf(frame, 480, { share: 0.5, fits: true })
    expect(measureHeight(frame, () => [stopped, follower])).toBe(defaultFrameHeight + 1200)
    expect(stopped.scrollHeight - stopped.clientHeight).toBe(0)
    // A half share with more hidden than the follower: 300 hidden needs 600.
    const short = partOf(frame, 1000)
    const half = partOf(frame, 700, { share: 0.5 })
    expect(measureHeight(frame, () => [half, short])).toBe(defaultFrameHeight + 600)
  })

  test('a share between a half and one gets the exact height', () => {
    const { frame } = fakeFrame(defaultFrameHeight, { fill: true })
    // 600 at the least height, 690 of content: 90 hidden at a share of 0.75 needs 120.
    const part = partOf(frame, 690, { share: 0.75, fits: true })
    expect(measureHeight(frame, () => [part])).toBe(defaultFrameHeight + 120)
    expect(measureHeight(frame, () => [part])).toBe(defaultFrameHeight + 120)
  })

  test('reads the parts of a document up to the least height and the probe, and not above', () => {
    const at = (content: number) => {
      const { frame } = fakeFrame(content)
      let read = 0
      measureHeight(frame, () => ((read += 1), []))
      return read
    }
    expect(at(defaultFrameHeight + 200)).toBe(1)
    expect(at(defaultFrameHeight + 201)).toBe(0)
  })

  test('keeps the margin around a root as tall as the viewport', () => {
    const { frame } = fakeFrame(0, { fill: true, margin: 16 })
    expect(measureHeight(frame, () => [partOf(frame, 2000)])).toBe(defaultFrameHeight + 16 + 1200)
  })

  test('leaves a part whose content is always taller than the part', () => {
    const { frame } = fakeFrame(defaultFrameHeight, { fill: true })
    expect(measureHeight(frame, () => [partOf(frame, 0, { grows: 60 })])).toBe(defaultFrameHeight)
  })

  test('does not read the parts of a document that is taller than the least height', () => {
    const { frame } = fakeFrame(1500)
    let read = 0
    expect(measureHeight(frame, () => (read += 1, [partOf(frame, 5000)]))).toBe(1500)
    expect(read).toBe(0)
  })

  test('does not probe when no part hides content', () => {
    const { frame, writes } = fakeFrame(300, { height: `${defaultFrameHeight}px` })
    expect(measureHeight(frame, () => [partOf(frame, 100)])).toBe(defaultFrameHeight)
    expect(writes).toEqual([])
  })

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

describe('hidingParts', () => {
  const element = (clientHeight: number, scrollHeight: number, overflowY: string) => ({ clientHeight, scrollHeight, overflowY })
  const parts = (list: ReturnType<typeof element>[]) => hidingParts(list, (item) => item)

  test('gives an element that is shorter than its content and that a person can scroll', () => {
    const list = [element(100, 300, 'auto'), element(100, 300, 'scroll'), element(100, 300, 'overlay')]
    expect(parts(list)).toEqual(list)
  })

  test('leaves an element that shows or clips the rest', () => {
    expect(parts([element(100, 300, 'visible'), element(100, 300, 'hidden'), element(100, 300, 'clip')])).toEqual([])
  })

  test('leaves an element that hides nothing, less than one px, or has no height', () => {
    expect(parts([element(100, 100, 'auto'), element(100, 100.5, 'auto'), element(0, 50, 'scroll')])).toEqual([])
    expect(parts([element(100, 101, 'auto')])).toHaveLength(1)
  })
})

describe('partsSelector', () => {
  test('leaves the body out when its overflow goes to the viewport', () => {
    expect(partsSelector('visible')).toBe('body *')
    expect(partsSelector('hidden')).toBe('body, body *')
    expect(partsSelector('auto')).toBe('body, body *')
  })
})
