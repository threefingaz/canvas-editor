import { describe, expect, test } from 'vitest'
import { createDragStore } from './drag-store.ts'
import type { DragEvent } from './move-drag.ts'

const press: DragEvent = { type: 'press', point: { x: 0, y: 0 }, position: 1 }
// A move with the main button down at 100 %.
const move = (x: number, drop: number): DragEvent => ({ type: 'move', point: { x, y: 0 }, drop, down: true, scale: 1 })
const line = { x: 5, y: 0, width: 0, height: 40 }

describe('createDragStore', () => {
  test('starts idle with no line', () => {
    const store = createDragStore()
    expect(store.get()).toEqual({ drag: { kind: 'idle', guard: false }, line: null })
    expect(store.dragging()).toBe(false)
  })

  test('a press is not a drag yet; a move past the threshold is, with its line', () => {
    const store = createDragStore()
    store.send(press)
    expect(store.dragging()).toBe(false)
    store.send(move(10, 0), line)
    expect(store.dragging()).toBe(true)
    expect(store.get().line).toEqual(line)
  })

  test('a release gives the move, clears the line, and the click after it is stopped', () => {
    const store = createDragStore()
    store.send(press)
    store.send(move(10, 0), line)
    expect(store.send({ type: 'release' })).toEqual({ moveTo: 0, stopClick: false })
    expect(store.get().line).toBeNull()
    expect(store.dragging()).toBe(false)
    expect(store.send({ type: 'click' })).toEqual({ moveTo: null, stopClick: true })
  })

  test('a cancel ends the drag with no move', () => {
    const store = createDragStore()
    store.send(press)
    store.send(move(10, 0), line)
    expect(store.send({ type: 'cancel' })).toEqual({ moveTo: null, stopClick: false })
    expect(store.dragging()).toBe(false)
    expect(store.get().line).toBeNull()
    expect(store.send({ type: 'click' })).toEqual({ moveTo: null, stopClick: true })
  })

  test('an event that is not a move keeps the line of a drag', () => {
    const store = createDragStore()
    store.send(press)
    store.send(move(10, 0), line)
    store.send({ type: 'click' })
    store.send(press)
    expect(store.dragging()).toBe(true)
    expect(store.get().line).toEqual(line)
  })

  test('notifies only on a change, and the snapshot stays the same with none', () => {
    const store = createDragStore()
    let count = 0
    const unsubscribe = store.subscribe(() => count++)
    const before = store.get()
    store.send({ type: 'release' })
    expect(count).toBe(0)
    expect(store.get()).toBe(before)
    store.send(press)
    expect(count).toBe(1)
    store.send(move(10, 0), line)
    store.send(move(11, 0), { ...line })
    expect(count).toBe(2)
    store.send(move(30, 2), { ...line, x: 300 })
    expect(count).toBe(3)
    unsubscribe()
    store.send({ type: 'release' })
    expect(count).toBe(3)
  })
})
