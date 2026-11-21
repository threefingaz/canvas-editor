import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Issue, Target } from '../../requests/format.ts'
import { markerRects, parseMarkersShown, readMarkersShown, writeMarkersShown } from './markers.ts'
import type { Rect } from './viewport.ts'

function target(line: number, tag: string, origin: Target['origin'] = 'host'): Target {
  return { file: 'screens/a.tsx', line, column: 5, tag, origin, element: 'div', copies: 1, label: '' }
}

// A node of the frame document: its name and its rectangle.
type Node = { name: string; rect: Rect | null; hidden?: boolean }

function node(name: string, x: number, hidden = false): Node {
  return { name, rect: { x, y: 10, width: 40, height: 20 }, hidden }
}

// The preview hides no node.
const nothing = () => false

describe('markerRects', () => {
  const footer = node('footer', 0)
  const chips = [node('chip-1', 0), node('chip-2', 50), node('chip-3', 100)]
  const nodes: Record<string, Node[]> = {
    'screens/a.tsx:3:5': [footer],
    'screens/a.tsx:7:5': chips,
    'screens/a.tsx:9:5': [node('button', 0)],
  }
  const nodesOf = (loc: string) => nodes[loc] ?? []
  const rectOf = (n: Node) => n.rect

  test('gives one rect for each copy of each place that is not from the library', () => {
    const issues: Issue[] = [
      { kind: 'not-library', target: target(3, 'div') },
      { kind: 'not-library', target: target(7, 'Chip', 'local') },
    ]
    expect(markerRects(issues, nodesOf, rectOf, nothing)).toEqual([
      { key: 'screens/a.tsx:3:5#0', tag: 'div', rect: footer.rect },
      { key: 'screens/a.tsx:7:5#0', tag: 'Chip', rect: chips[0].rect },
      { key: 'screens/a.tsx:7:5#1', tag: 'Chip', rect: chips[1].rect },
      { key: 'screens/a.tsx:7:5#2', tag: 'Chip', rect: chips[2].rect },
    ])
  })

  test('the other kinds of issues give no marker', () => {
    const issues: Issue[] = [
      { kind: 'no-token', target: target(9, 'Button', 'library'), property: 'padding', value: '8px', state: 'none' },
      { kind: 'override', target: target(3, 'div'), property: 'color', value: 'red' },
      { kind: 'broken-link', target: target(9, 'Button', 'library'), href: '#/nothing' },
      { kind: 'render-error', text: 'Boom' },
    ]
    expect(markerRects(issues, nodesOf, rectOf, nothing)).toEqual([])
  })

  test('a node that the preview hides has no marker, and the keys keep the index of the copy', () => {
    const issues: Issue[] = [{ kind: 'not-library', target: target(7, 'Chip', 'local') }]
    const hidden = (n: Node) => n.name === 'chip-2'
    expect(markerRects(issues, nodesOf, rectOf, hidden).map((marker) => marker.key)).toEqual([
      'screens/a.tsx:7:5#0',
      'screens/a.tsx:7:5#2',
    ])
  })

  test('a node with no rect or with no size has no marker; a line with a size has one', () => {
    const flat = { x: 0, y: 0, width: 40, height: 0 }
    const local: Record<string, Node[]> = {
      'screens/a.tsx:3:5': [
        { name: 'gone', rect: null },
        { name: 'empty', rect: { x: 0, y: 0, width: 0, height: 0 } },
        { name: 'line', rect: flat },
      ],
    }
    const issues: Issue[] = [{ kind: 'not-library', target: target(3, 'div') }]
    expect(markerRects(issues, (loc) => local[loc] ?? [], rectOf, nothing)).toEqual([
      { key: 'screens/a.tsx:3:5#2', tag: 'div', rect: flat },
    ])
  })

  test('a place that draws nothing gives no marker', () => {
    const issues: Issue[] = [{ kind: 'not-library', target: target(20, 'div') }]
    expect(markerRects(issues, nodesOf, rectOf, nothing)).toEqual([])
  })
})

describe('parseMarkersShown', () => {
  test('the markers show with no stored choice and with an unknown value', () => {
    expect(parseMarkersShown(null)).toBe(true)
    expect(parseMarkersShown('')).toBe(true)
    expect(parseMarkersShown('on')).toBe(true)
  })

  test('a stored "off" hides them', () => {
    expect(parseMarkersShown('off')).toBe(false)
  })
})

describe('readMarkersShown and writeMarkersShown', () => {
  function memoryStorage() {
    const data: Record<string, string> = {}
    return {
      data,
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => {
        data[key] = value
      },
      removeItem: (key: string) => {
        delete data[key]
      },
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('a written choice reads back', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() })
    writeMarkersShown(false)
    expect(readMarkersShown()).toBe(false)
    writeMarkersShown(true)
    expect(readMarkersShown()).toBe(true)
  })

  test('the default, shown, is not stored', () => {
    const storage = memoryStorage()
    vi.stubGlobal('window', { localStorage: storage })
    writeMarkersShown(false)
    writeMarkersShown(true)
    expect(storage.data).toEqual({})
  })

  test('with no storage the markers show, and a write does not throw', () => {
    vi.stubGlobal('window', {})
    expect(readMarkersShown()).toBe(true)
    expect(() => writeMarkersShown(false)).not.toThrow()
  })
})
