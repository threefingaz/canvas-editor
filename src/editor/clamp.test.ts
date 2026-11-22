import { describe, expect, it } from 'vitest'
import { clamp } from './clamp.ts'

describe('clamp', () => {
  it('keeps a value in the range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })

  it('gives the least value when the range is empty', () => {
    expect(clamp(5, 10, 0)).toBe(10)
  })
})
