import { describe, expect, test } from 'vitest'
import { own } from './own.ts'

describe('own', () => {
  test('gives an own value and no value of the prototype', () => {
    const record: Record<string, number[]> = { welcome: [1] }
    expect(own(record, 'welcome')).toEqual([1])
    for (const key of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'missing']) expect(own(record, key)).toBeUndefined()
    expect(own({ constructor: [2] }, 'constructor')).toEqual([2])
  })
})
