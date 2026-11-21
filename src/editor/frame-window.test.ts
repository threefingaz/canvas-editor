import { describe, expect, test } from 'vitest'
import { frameWindowOf, inLiveFrame, type FrameWindow } from './frame-window.ts'

describe('inLiveFrame', () => {
  const view = {} as FrameWindow

  test('is true for a connected node in a document with a window', () => {
    expect(inLiveFrame({ isConnected: true, ownerDocument: { defaultView: view } })).toBe(true)
  })

  test('is false for a node of a frame that reloaded: connected, but its document has no window', () => {
    expect(inLiveFrame({ isConnected: true, ownerDocument: { defaultView: null } })).toBe(false)
  })

  test('is false for a node that is no longer connected', () => {
    expect(inLiveFrame({ isConnected: false, ownerDocument: { defaultView: view } })).toBe(false)
    expect(inLiveFrame({ isConnected: false, ownerDocument: null })).toBe(false)
  })
})

describe('frameWindowOf', () => {
  test('gives the window of the document', () => {
    const view = {} as FrameWindow
    expect(frameWindowOf({ defaultView: view })).toBe(view)
  })

  test('gives null for no document or a document with no window', () => {
    expect(frameWindowOf(null)).toBeNull()
    expect(frameWindowOf(undefined)).toBeNull()
    expect(frameWindowOf({ defaultView: null })).toBeNull()
  })
})
