import { describe, expect, test } from 'vitest'
import { hashOfHeader, quotedHash } from './api.ts'

describe('quotedHash and hashOfHeader', () => {
  test('the quoted form gives the hash back', () => {
    expect(quotedHash('abc')).toBe('"abc"')
    expect(hashOfHeader(quotedHash('abc'))).toBe('abc')
    expect(hashOfHeader(' "abc" ')).toBe('abc')
  })

  test('no header, an empty hash and the forms that the API never sends give null', () => {
    expect(hashOfHeader(null)).toBeNull()
    expect(hashOfHeader(undefined)).toBeNull()
    expect(hashOfHeader('""')).toBeNull()
    expect(hashOfHeader('abc')).toBeNull()
    expect(hashOfHeader('W/"abc"')).toBeNull()
  })
})
