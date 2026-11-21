import { describe, expect, test } from 'vitest'
import { fileEvent } from './watch.ts'

describe('fileEvent', () => {
  test('the events of a file are add, change and unlink', () => {
    expect(fileEvent('add')).toBe(true)
    expect(fileEvent('change')).toBe(true)
    expect(fileEvent('unlink')).toBe(true)
    expect(fileEvent('addDir')).toBe(false)
    expect(fileEvent('unlinkDir')).toBe(false)
  })
})
