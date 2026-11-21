import { describe, expect, test } from 'vitest'
import { config } from '../../../canvas.config.ts'
import { agentSentence } from './agent-sentence.ts'

describe('agentSentence', () => {
  test('names the requests folder in the work folder of the config', () => {
    expect(agentSentence).toContain(` ${config.work}/requests/ `)
  })
})
