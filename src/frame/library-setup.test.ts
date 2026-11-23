import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { connectSentence, librarySetupSkill, tokensSentence } from './library-setup.ts'

function textOf(name: string): string {
  return readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8')
}

describe('connectSentence', () => {
  test('names a skill that exists', () => {
    const file = new URL(`../../guide/skills/${librarySetupSkill}/SKILL.md`, import.meta.url)
    expect(existsSync(file)).toBe(true)
  })

  // AGENTS.md and README.md write the sentence out; they change with it.
  test.each(['AGENTS.md', 'README.md'])('is the sentence that %s writes', (name) => {
    expect(textOf(name)).toContain(connectSentence)
  })
})

describe('tokensSentence', () => {
  test('names the same skill, and differs from the first sentence', () => {
    expect(tokensSentence).toContain(librarySetupSkill)
    expect(tokensSentence).not.toBe(connectSentence)
  })

  // AGENTS.md has a row for the level `connected` with the sentence.
  test('is the sentence that AGENTS.md writes', () => {
    expect(textOf('AGENTS.md')).toContain(tokensSentence)
  })
})
