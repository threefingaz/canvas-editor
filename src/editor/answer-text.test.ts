import { describe, expect, test } from 'vitest'
import { failure } from './answer-text.ts'

describe('failure', () => {
  test('the status with the text of the body, or the status alone', async () => {
    expect(await failure(new Response(' no screen "a"\n', { status: 404 }))).toBe('404 no screen "a"')
    expect(await failure(new Response('', { status: 500 }))).toBe('500')
  })
})
