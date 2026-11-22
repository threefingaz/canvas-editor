import { describe, expect, test } from 'vitest'
import { flowArrows, flowFrames, flowLabels, headLength, parseLinksShown, type FlowFrame } from './flow.ts'

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
