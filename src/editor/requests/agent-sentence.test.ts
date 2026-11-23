import { describe, expect, test } from 'vitest'
import { config } from '../../../canvas.config.ts'
import { agentSentence, guidePath, olderAgentSentence } from './agent-sentence.ts'

describe('agentSentence', () => {
  test('names the guide of the project', () => {
    expect(agentSentence('AGENTS.md')).toBe('Apply the canvas requests as AGENTS.md says.')
    expect(agentSentence('canvas/AGENTS.md')).toBe('Apply the canvas requests as canvas/AGENTS.md says.')
  })

  test('names no folder of the requests: the guide does', () => {
    expect(agentSentence(guidePath)).not.toContain(`${config.work}/`)
  })

  test('the guide is the AGENTS.md of the tool', () => {
    expect(guidePath).toBe('AGENTS.md')
  })

  test('the older sentence names the requests folder in the work folder of the config', () => {
    expect(olderAgentSentence).toContain(` ${config.work}/requests/ `)
  })
})
