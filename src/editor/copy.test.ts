import { describe, expect, test } from 'vitest'
import { sentenceCopyLabels } from './copy.ts'

describe('sentenceCopyLabels', () => {
  test('gives a label for each state, and the sentence on a failure', () => {
    expect(sentenceCopyLabels('Do the work.')).toEqual({
      idle: 'Copy the sentence for the agent',
      copied: 'Copied',
      failed: 'Cannot copy to the clipboard. Give the agent: Do the work.',
    })
  })
})
