import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { connectSentence, librarySetupSkill } from './library-setup.ts'

describe('connectSentence', () => {
  test('names a skill that exists', () => {
    const file = new URL(`../../.github/skills/${librarySetupSkill}/SKILL.md`, import.meta.url)
    expect(existsSync(file)).toBe(true)
  })

  // AGENTS.md and README.md write the sentence out; they change with it.
  test.each(['AGENTS.md', 'README.md'])('is the sentence that %s writes', (name) => {
    const text = readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8')
    expect(text).toContain(connectSentence)
  })
})
