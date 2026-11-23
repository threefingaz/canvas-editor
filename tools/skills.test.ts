import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { agentSentence, guidePath, olderAgentSentence } from '../src/editor/requests/agent-sentence.ts'

// The skills of the tool, `guide/skills/<name>/SKILL.md`. An agent loads a
// skill by its name and its description: the name must be the name of the
// folder, and the description has a limit.

const folder = fileURLToPath(new URL('../guide/skills/', import.meta.url))
const names = readdirSync(folder).filter((name) => existsSync(`${folder}${name}/SKILL.md`))

function head(name: string): Map<string, string> {
  const text = readFileSync(`${folder}${name}/SKILL.md`, 'utf8').replaceAll('\r\n', '\n')
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match) throw new Error(`${name} has no head`)
  const fields = new Map<string, string>()
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':')
    fields.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim())
  }
  return fields
}

describe('the skills of the tool', () => {
  test('has the entries of the three jobs and the design skills', () => {
    expect(names).toEqual(expect.arrayContaining(['canvas-apply', 'canvas-check', 'canvas-screen', 'canvas-screen-design', 'canvas-library-setup']))
  })

  test.each(names)('%s has the name of its folder and a description of 1024 characters or less', (name) => {
    const fields = head(name)
    expect(fields.get('name')).toBe(name)
    const description = fields.get('description') ?? ''
    expect(description.length).toBeGreaterThan(0)
    expect(description.length).toBeLessThanOrEqual(1024)
  })

  test('the skill of the requests is found by the fixed sentence, also with the guide in a sub folder', () => {
    const description = head('canvas-apply').get('description')
    expect(description).toContain(agentSentence(guidePath).replace(/\.$/, ''))
    expect(description).toContain(agentSentence('canvas/AGENTS.md').replace(/\.$/, ''))
  })

  test('the skill of the requests still takes the older sentence', () => {
    expect(head('canvas-apply').get('description')).toContain(olderAgentSentence.replace(/\.$/, ''))
  })
})
