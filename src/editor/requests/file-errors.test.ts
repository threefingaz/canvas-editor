import { describe, expect, test } from 'vitest'
import { createErrorList, createFileErrorsStore } from './file-errors.ts'

describe('createErrorList', () => {
  test('publishes the list after each change, and only then', () => {
    const lists: ReadonlyMap<string, string>[] = []
    const report = createErrorList((next) => lists.push(next))
    report('requests:a', 'Cannot save')
    report('requests:a', 'Cannot save')
    report('issues:a', 'Cannot write')
    report('requests:a', null)
    report('requests:a', null)
    expect(lists.map((list) => [...list])).toEqual([
      [['requests:a', 'Cannot save']],
      [
        ['requests:a', 'Cannot save'],
        ['issues:a', 'Cannot write'],
      ],
      [['issues:a', 'Cannot write']],
    ])
  })
})

describe('createFileErrorsStore', () => {
  test('keeps the errors by key and calls the subscribers on a change', () => {
    const store = createFileErrorsStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => calls++)
    const empty = store.errors()
    expect(empty.size).toBe(0)

    store.report('collect:a', 'Cannot read')
    expect([...store.errors()]).toEqual([['collect:a', 'Cannot read']])
    expect(calls).toBe(1)

    // The same error is no change: the same map, no call.
    const current = store.errors()
    store.report('collect:a', 'Cannot read')
    expect(store.errors()).toBe(current)
    expect(calls).toBe(1)

    unsubscribe()
    store.report('collect:a', null)
    expect(store.errors().size).toBe(0)
    expect(calls).toBe(1)
  })
})
