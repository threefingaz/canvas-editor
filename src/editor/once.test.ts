import { expect, test } from 'vitest'
import { once } from './once.ts'

test('the value is made at the first read, one time', () => {
  let calls = 0
  const value = once(() => {
    calls += 1
    return { calls }
  })
  expect(calls).toBe(0)
  const first = value()
  expect(value()).toBe(first)
  expect(calls).toBe(1)
})

test('a value that is null or undefined is made one time too', () => {
  let calls = 0
  const value = once(() => {
    calls += 1
    return null
  })
  expect(value()).toBeNull()
  expect(value()).toBeNull()
  expect(calls).toBe(1)
})
