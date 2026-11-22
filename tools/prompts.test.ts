import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { agentSentence } from '../src/editor/requests/agent-sentence.ts'

// The prompt files of the agent in the code editor: the user runs one with
// `/<name>` in the chat, with no typing of the task.

const folder = fileURLToPath(new URL('../.github/prompts/', import.meta.url))
const names = readdirSync(folder).sort()

// The front matter (the lines between the two `---`) and the body of a file.
function partsOf(name: string): { fields: Map<string, string>; body: string } {
  // A checkout on Windows can have `\r\n` at the end of each line.
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(readFileSync(`${folder}${name}`, 'utf8').replaceAll('\r\n', '\n'))
  if (!match) throw new Error(`${name} has no front matter`)
  const fields = new Map<string, string>()
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':')
    fields.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim())
  }
  return { fields, body: match[2] }
}

describe('the prompt files', () => {
  test('the three prompts of the tool, each with the name canvas-<x>.prompt.md', () => {
    expect(names).toEqual(['canvas-apply.prompt.md', 'canvas-check.prompt.md', 'canvas-screen.prompt.md'])
    for (const name of names) expect(name).toMatch(/^canvas-[a-z]+\.prompt\.md$/)
  })

  test('each has a description in one line and runs in the agent mode', () => {
    for (const name of names) {
      const { fields } = partsOf(name)
      expect(fields.get('description'), name).toBeTruthy()
      expect(fields.get('agent'), name).toBe('agent')
    }
  })

  test('each body is short', () => {
    for (const name of names) {
      expect(partsOf(name).body.trim().split('\n').length, name).toBeLessThan(15)
    }
  })

  test('the first line of the apply prompt is the fixed sentence for the agent', () => {
    expect(partsOf('canvas-apply.prompt.md').body.trim().split('\n')[0]).toBe(agentSentence)
  })
})
