import { describe, expect, test } from 'vitest'
import { config } from '../../../canvas.config.ts'
import { readTokenFile } from './token-file.ts'

const token = { id: 'spacing.2', group: 'spacing', name: 'spacing.2', value: '16px', code: 2 }

describe('readTokenFile', () => {
  test('a correct file gives the tokens', () => {
    expect(readTokenFile(JSON.stringify({ tokens: [token] }))).toEqual({ tokens: [token], error: null })
  })

  test('no file tells the user to write it', () => {
    const file = readTokenFile(undefined)
    expect(file.tokens).toBeNull()
    expect(file.error).toContain('There is no tokens.json')
    expect(file.error).toContain('npm run tokens')
    expect(file.error).toContain('library pack')
  })

  test('a file that is not JSON gives a message', () => {
    const file = readTokenFile('{ "tokens": [')
    expect(file.tokens).toBeNull()
    expect(file.error).toMatch(/^tokens\.json is not correct JSON/)
    expect(file.error).toContain('npm run tokens')
  })

  test('a token that is not correct gives the message of the check', () => {
    const file = readTokenFile(JSON.stringify({ tokens: [{ ...token, group: 'size' }] }))
    expect(file.tokens).toBeNull()
    expect(file.error).toContain('token 1 "spacing.2" has an unknown group "size"')
    expect(file.error).toContain('npm run tokens')
  })
})

describe('the token file name', () => {
  // `editor-tokens.ts` loads the file with a literal glob (`/tokens.json`).
  // Change it with the config.
  test('is the file of the config', () => {
    expect(config.tokens).toBe('tokens.json')
  })
})
