import { describe, expect, test } from 'vitest'
import { writesTokens } from './token-writes.ts'

describe('writesTokens', () => {
  const folder = '/project/library'

  test('a change of a code file in the library folder starts the token writer', () => {
    expect(writesTokens('/project/library/theme.ts', folder)).toBe(true)
    expect(writesTokens('/project/library/tokens.ts', '/project/library/')).toBe(true)
    expect(writesTokens('/project/library/provider.tsx', folder)).toBe(true)
    expect(writesTokens('/project/library/parts/colors.ts', folder)).toBe(true)
  })

  test('a test file does not start it', () => {
    expect(writesTokens('/project/library/theme.test.ts', folder)).toBe(false)
    expect(writesTokens('/project/library/parts/view.test.tsx', folder)).toBe(false)
  })

  test('a change outside the folder, or of a file that is not code, does not start it', () => {
    expect(writesTokens('/project/tokens.json', folder)).toBe(false)
    expect(writesTokens('/project/library-old/theme.ts', folder)).toBe(false)
    expect(writesTokens('/project/screens/onboarding/welcome.tsx', folder)).toBe(false)
    expect(writesTokens('/project/library', folder)).toBe(false)
    expect(writesTokens('/project/library/notes.md', folder)).toBe(false)
  })
})
