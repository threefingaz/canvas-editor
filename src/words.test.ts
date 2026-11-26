import { describe, expect, test } from 'vitest'
import { capitalized, counted } from './words.ts'

describe('counted', () => {
  test('one, many, and a plural of its own', () => {
    expect(counted(1, 'screen')).toBe('1 screen')
    expect(counted(0, 'screen')).toBe('0 screens')
    expect(counted(3, 'screen')).toBe('3 screens')
    expect(counted(2, 'box', 'boxes')).toBe('2 boxes')
  })
})

describe('capitalized', () => {
  test('the first letter in upper case, and an empty text as it is', () => {
    expect(capitalized('a screen exists')).toBe('A screen exists')
    expect(capitalized('')).toBe('')
  })
})
