import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  flowArrows,
  flowFocus,
  flowFrames,
  flowLabels,
  flowLinks,
  focusLift,
  headLength,
  leastLift,
  leastStep,
  parseLinksShown,
  readLinksShown,
  rowLifts,
  writeLinksShown,
  type FlowFrame,
} from './flow.ts'

const frame = (id: string, x: number, y = 100, width = 400, height = 300): FlowFrame => ({
  id,
  flow: id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '',
  rect: { x, y, width, height },
})

// The numbers of a path: the start, the two control points and the end.
function points(d: string): number[] {
  return d.match(/-?\d+(\.\d+)?/g)!.map(Number)
}

const clearance = 28

describe('flowFrames', () => {
  test('gives each box in canvas coordinates', () => {
    const boxes = [{ screen: { id: 'a/one', flow: 'a' }, x: 100, y: 200, width: 400, height: 900 }]
    expect(flowFrames(boxes, { x: 10, y: 20, scale: 0.5 })).toEqual([
      { id: 'a/one', flow: 'a', rect: { x: 60, y: 120, width: 200, height: 450 } },
    ])
  })
})

describe('flowArrows', () => {
  const welcome = frame('a/welcome', 0)
  const mobile = frame('a/welcome-mobile', 500, 100, 200)
  const workspace = frame('a/workspace', 800)
  const frames = [welcome, mobile, workspace]

  test('a target at the right: an arc above the title rows, from the right end to the left end, with the head down', () => {
    const [arrow] = flowArrows(frames, [{ from: 'a/welcome', to: 'a/workspace' }], clearance)
    expect(arrow.from).toBe('a/welcome')
    expect(arrow.to).toBe('a/workspace')
    const [sx, sy, c1x, c1y, c2x, c2y, ex, ey] = points(arrow.d)
    expect(sx).toBe(388)
    expect(sy).toBe(100 - clearance)
    expect(ex).toBe(812)
    expect(ey).toBe(100 - clearance - headLength)
    expect(arrow.tip).toEqual({ x: 812, y: 100 - clearance })
    expect(arrow.angle).toBe(0)
    // The control points are above the ends: the line never comes below the
    // clearance, thus it crosses no frame and no title row between the two.
    expect(c1x).toBe(sx)
    expect(c2x).toBe(ex)
    expect(c1y).toBeLessThan(ey)
    expect(c2y).toBe(c1y)
  })

  test('a target at the left starts near the left end and ends near the right end', () => {
    const [arrow] = flowArrows(frames, [{ from: 'a/workspace', to: 'a/welcome' }], clearance)
    const [sx, , , , , , ex] = points(arrow.d)
    expect(sx).toBe(828)
    expect(ex).toBe(372)
    expect(arrow.angle).toBe(0)
  })

  test('two links in opposite directions: the arrow to the left is around the arrow to the right', () => {
    const [right, left] = flowArrows(
      frames,
      [
        { from: 'a/welcome', to: 'a/workspace' },
        { from: 'a/workspace', to: 'a/welcome' },
      ],
      clearance,
    )
    const r = points(right.d)
    const l = points(left.d)
    // Wider at each end, and higher.
    expect(l[6]).toBeLessThan(r[0])
    expect(l[0]).toBeGreaterThan(r[6])
    expect(l[3]).toBeLessThan(r[3])
  })

  test('the lift grows with the distance and has a bound', () => {
    const near = frame('a/near', 450)
    const far = frame('a/far', 5000)
    const further = frame('a/further', 9000)
    const lift = (to: string) => {
      const [arrow] = flowArrows([welcome, near, far, further], [{ from: 'a/welcome', to }], clearance)
      const [, sy, , c1y] = points(arrow.d)
      return sy - c1y
    }
    expect(lift('a/near')).toBeLessThan(lift('a/far'))
    expect(lift('a/far')).toBe(lift('a/further'))
  })

  test('a narrow frame keeps the ends in its own width', () => {
    const small = frame('a/small', 0, 100, 20)
    const [arrow] = flowArrows([small, workspace], [{ from: 'a/small', to: 'a/workspace' }], clearance)
    expect(points(arrow.d)[0]).toBe(17)
  })

  test('an unknown id and a pair of a frame with itself give no arrow', () => {
    expect(
      flowArrows(
        frames,
        [
          { from: 'a/welcome', to: 'a/none' },
          { from: 'a/none', to: 'a/welcome' },
          { from: 'a/welcome', to: 'a/welcome' },
        ],
        clearance,
      ),
    ).toEqual([])
  })

  test('a target in a lower row: from the bottom edge down to above its title row', () => {
    const lower = frame('b/start', 0, 700)
    const [arrow] = flowArrows([welcome, lower], [{ from: 'a/welcome', to: 'b/start' }], clearance)
    const [, sy, , , , , , ey] = points(arrow.d)
    expect(sy).toBe(400)
    expect(ey).toBe(700 - clearance - headLength)
    expect(arrow.tip.y).toBe(700 - clearance)
    expect(arrow.angle).toBe(0)
  })

  test('a target in an upper row: from above the title row up to the bottom edge, with the head up', () => {
    const lower = frame('b/start', 0, 700)
    const [down, up] = flowArrows(
      [welcome, lower],
      [
        { from: 'a/welcome', to: 'b/start' },
        { from: 'b/start', to: 'a/welcome' },
      ],
      clearance,
    )
    expect(points(up.d)[1]).toBe(700 - clearance)
    expect(up.tip.y).toBe(400)
    expect(up.angle).toBe(180)
    // The two do not share an end.
    expect(up.tip.x).not.toBe(points(down.d)[0])
  })

  test('an option below its frame gets the curve of two rows', () => {
    const option = frame('a/welcome-option-1', 0, 600)
    const [arrow] = flowArrows([welcome, option], [{ from: 'a/welcome', to: 'a/welcome-option-1' }], clearance)
    expect(arrow.angle).toBe(0)
    expect(arrow.tip.y).toBe(600 - clearance)
  })
})

describe('flowLabels', () => {
  test('one label for each flow, at the left of its first frame, at the height of the title row', () => {
    const frames = [frame('onboarding/welcome', 100, 50), frame('onboarding/workspace', 700, 50), frame('settings/account/plan', 100, 900)]
    expect(flowLabels(frames, 24, 12)).toEqual([
      { flow: 'onboarding', x: 88, y: 26 },
      { flow: 'settings/account', x: 88, y: 876 },
    ])
  })

  test('the screens directly in the folder have no label', () => {
    expect(flowLabels([frame('home', 0)], 24, 12)).toEqual([])
    // A flow.json of the screens folder that is not valid: a label for the mark.
    expect(flowLabels([frame('home', 0)], 24, 12, new Set(['']))).toEqual([{ flow: '', x: -12, y: 76 }])
  })
})

describe('parseLinksShown', () => {
  test('the arrows show unless the choice is off', () => {
    expect(parseLinksShown(null)).toBe(true)
    expect(parseLinksShown('off')).toBe(false)
  })
})

describe('flowArrows with little room above the row', () => {
  test('keeps an arc in the free space above its row', () => {
    const frames = [
      { id: 'a/one', flow: 'a', rect: { x: 0, y: 100, width: 100, height: 60 } },
      { id: 'a/two', flow: 'a', rect: { x: 400, y: 100, width: 100, height: 60 } },
    ]
    const top = (d: string) => Math.min(...[...d.matchAll(/-?\d+(\.\d+)?/g)].map((match) => Number(match[0])).filter((_, index) => index % 2 === 1))
    const high = flowArrows(frames, [{ from: 'a/one', to: 'a/two' }], 20)[0]
    const low = flowArrows(frames, [{ from: 'a/one', to: 'a/two' }], 20, 4)[0]
    expect(top(low.d)).toBeGreaterThan(top(high.d))
    expect(top(low.d)).toBeGreaterThanOrEqual(100 - 20 - 12 - 8 / 0.75)
  })
})

describe('flowFocus', () => {
  test('no listed screen: each arrow is normal', () => {
    expect(flowFocus({ from: 'a', to: 'b' }, null)).toBe(null)
  })

  test('the arrows that leave the listed screen, that reach it, and the others', () => {
    expect(flowFocus({ from: 'a', to: 'b' }, 'a')).toBe('out')
    expect(flowFocus({ from: 'a', to: 'b' }, 'b')).toBe('in')
    expect(flowFocus({ from: 'a', to: 'b' }, 'c')).toBe('off')
  })

  test('each arrow has the focus of its pair', () => {
    const frames = [frame('a/one', 0), frame('a/two', 500), frame('a/three', 1000), frame('b/low', 0, 700)]
    const pairs = [
      { from: 'a/one', to: 'a/two' },
      { from: 'a/two', to: 'a/three' },
      { from: 'a/three', to: 'a/one' },
      { from: 'b/low', to: 'a/two' },
    ]
    expect(flowArrows(frames, pairs, clearance).map((arrow) => arrow.focus)).toEqual([null, null, null, null])
    expect(flowArrows(frames, pairs, clearance, Infinity, new Map(), 'a/two').map((arrow) => arrow.focus)).toEqual(['in', 'out', 'off', 'in'])
  })
})

describe('flowLinks', () => {
  test('gives the link rectangles of each frame in canvas coordinates', () => {
    const boxes = [
      { screen: { id: 'a/one', flow: 'a' }, x: 100, y: 200, width: 400, height: 900 },
      { screen: { id: 'a/two', flow: 'a' }, x: 600, y: 200, width: 400, height: 900 },
    ]
    const rects = new Map([
      ['a/one', new Map([['a/two', { x: 40, y: 60, width: 100, height: 20 }]])],
      ['a/gone', new Map([['a/one', { x: 0, y: 0, width: 10, height: 10 }]])],
    ])
    const links = flowLinks(boxes, { x: 10, y: 20, scale: 0.5 }, rects)
    expect([...links.keys()]).toEqual(['a/one'])
    expect(links.get('a/one')?.get('a/two')).toEqual({ x: 80, y: 150, width: 50, height: 10 })
  })
})

describe('flowArrows from a link element', () => {
  const one = frame('a/one', 0)
  const two = frame('a/two', 800)
  const low = frame('b/low', 0, 700)
  const link = (from: string, to: string, rect: { x: number; y: number; width: number; height: number }) => new Map([[from, new Map([[to, rect]])]])

  test('an arc starts above the link element, with a dot at its middle and a stem up to the arc', () => {
    const links = link('a/one', 'a/two', { x: 100, y: 300, width: 80, height: 40 })
    const [arrow] = flowArrows([one, two], [{ from: 'a/one', to: 'a/two' }], clearance, Infinity, links)
    expect(arrow.dot).toEqual({ x: 140, y: 320 })
    expect(arrow.stem).toBe(`M 140 320 L 140 ${100 - clearance}`)
    const [sx, sy, c1x, , , , ex] = points(arrow.d)
    expect([sx, sy, c1x]).toEqual([140, 100 - clearance, 140])
    // The end is at the target as before.
    expect(ex).toBe(812)
  })

  test('a target in a lower row: the stem goes down to the bottom edge', () => {
    const links = link('a/one', 'b/low', { x: 300, y: 200, width: 40, height: 20 })
    const [arrow] = flowArrows([one, low], [{ from: 'a/one', to: 'b/low' }], clearance, Infinity, links)
    expect(arrow.dot).toEqual({ x: 320, y: 210 })
    expect(arrow.stem).toBe('M 320 210 L 320 400')
    expect(points(arrow.d).slice(0, 2)).toEqual([320, 400])
  })

  test('with no link rectangle the arrow starts at the frame, with no dot and no stem', () => {
    const other = link('a/two', 'a/one', { x: 900, y: 300, width: 80, height: 40 })
    const [arrow] = flowArrows([one, two], [{ from: 'a/one', to: 'a/two' }], clearance, Infinity, other)
    expect(arrow.dot).toBe(null)
    expect(arrow.stem).toBe(null)
    expect(points(arrow.d)[0]).toBe(388)
  })

  test('a link element out of its frame counts as not known', () => {
    const links = link('a/one', 'a/two', { x: 600, y: 300, width: 80, height: 40 })
    const [arrow] = flowArrows([one, two], [{ from: 'a/one', to: 'a/two' }], clearance, Infinity, links)
    expect(arrow.dot).toBe(null)
    expect(points(arrow.d)[0]).toBe(388)
  })
})

describe('the heights of the arcs of one row', () => {
  // The top of an arc: 3/4 of the height of its control points above its end.
  const lift = (d: string) => {
    const [, , , c1y, , , , ey] = points(d)
    return (ey - c1y) * 0.75
  }
  const frames = [frame('a/one', 0), frame('a/two', 500), frame('a/three', 1000), frame('a/four', 1500)]
  const pairs = [
    { from: 'a/one', to: 'a/four' },
    { from: 'a/one', to: 'a/two' },
    { from: 'a/one', to: 'a/three' },
  ]

  test('three arcs have three heights: a short arc is low, a long one is high', () => {
    const [long, short, middle] = flowArrows(frames, pairs, clearance).map((arrow) => lift(arrow.d))
    expect(short).toBeLessThan(middle)
    expect(middle).toBeLessThan(long)
    // The path has one decimal, thus the heights are near to the numbers.
    expect(middle - short).toBeGreaterThan(9.8)
    expect(long - middle).toBeGreaterThan(9.8)
  })

  test('arcs of the same length do not lie on each other', () => {
    const same = [
      { from: 'a/one', to: 'a/two' },
      { from: 'a/two', to: 'a/three' },
      { from: 'a/three', to: 'a/four' },
    ]
    const lifts = flowArrows(frames, same, clearance).map((arrow) => lift(arrow.d))
    expect(new Set(lifts).size).toBe(3)
  })

  test('the arcs of a different row do not count', () => {
    const lower = [frame('b/one', 0, 700), frame('b/two', 500, 700)]
    const [upper, other] = flowArrows([...frames, ...lower], [pairs[1], { from: 'b/one', to: 'b/two' }], clearance)
    expect(lift(other.d)).toBeCloseTo(lift(upper.d), 1)
  })

  test('with room, the arcs stay in it', () => {
    const lifts = flowArrows(frames, pairs, clearance, 30).map((arrow) => lift(arrow.d))
    expect(Math.max(...lifts)).toBeCloseTo(30, 0)
    expect(new Set(lifts).size).toBe(3)
  })

  test('at a low zoom, with no room above the row, the arcs keep a least height and a least distance', () => {
    // 6 %: a frame of 1440 px is 86 px wide, and the gap of two rows is less
    // than the title row.
    const small = [0, 100, 200, 300].map((x, index) => frame(`a/${index}`, x, 100, 86, 54))
    const low = [
      { from: 'a/0', to: 'a/3' },
      { from: 'a/0', to: 'a/1' },
      { from: 'a/0', to: 'a/2' },
    ]
    const [long, short, middle] = flowArrows(small, low, clearance, -16).map((arrow) => lift(arrow.d))
    expect(short).toBeCloseTo(leastLift, 0)
    expect(middle - short).toBeCloseTo(leastStep, 0)
    expect(long - middle).toBeCloseTo(leastStep, 0)
    expect(rowLifts([{ span: 100, right: true }], -16)).toEqual([leastLift])
  })

  test('with no room, many arcs share a band of three heights, and an arrow of the listed screen rises out of it', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ span: 100 + index * 50, right: true }))
    expect(Math.max(...rowLifts(many, -16))).toBeCloseTo(leastLift + leastStep * 2, 5)
    const small = [0, 100, 200, 300].map((x, index) => frame(`a/${index}`, x, 100, 86, 54))
    const low = [
      { from: 'a/0', to: 'a/3' },
      { from: 'a/1', to: 'a/2' },
    ]
    const [plain] = flowArrows(small, low, clearance, -16).map((arrow) => lift(arrow.d))
    const [strong, other] = flowArrows(small, low, clearance, -16, undefined, 'a/0').map((arrow) => lift(arrow.d))
    expect(strong).toBeGreaterThan(plain)
    expect(strong).toBeGreaterThanOrEqual(26)
    expect(other).toBeLessThanOrEqual(leastLift + leastStep * 2)
  })
})

describe('focusLift', () => {
  test('grows with the span between its least and its most height, and a left arrow is higher', () => {
    const short = focusLift(10, true)
    const long = focusLift(10_000, true)
    expect(short).toBeGreaterThan(0)
    expect(focusLift(300, true)).toBeGreaterThanOrEqual(short)
    expect(long).toBe(focusLift(20_000, true))
    expect(long).toBeGreaterThan(short)
    expect(focusLift(300, false)).toBeGreaterThan(focusLift(300, true))
  })
})

describe('readLinksShown and writeLinksShown', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('a choice reads back; with no storage the arrows show', () => {
    expect(readLinksShown()).toBe(true)
    expect(() => writeLinksShown(false)).not.toThrow()
    const data = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) },
    })
    writeLinksShown(false)
    expect(readLinksShown()).toBe(false)
    writeLinksShown(true)
    expect(data.size).toBe(0)
    expect(readLinksShown()).toBe(true)
  })
})
