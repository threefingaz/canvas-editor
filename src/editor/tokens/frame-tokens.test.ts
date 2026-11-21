import { describe, expect, test } from 'vitest'
import type { Token } from '../../tokens/format.ts'
import { frameTokens } from './frame-tokens.ts'

const gap: Token = {
  id: 'gap.xs',
  group: 'spacing',
  name: 'gap-xs',
  value: '9.44px',
  cssVar: '--gap-xs',
  code: 'xs',
  media: [{ query: '(width < 767px)', value: '5.6px' }],
}

// A plain object in place of a frame document: its window answers the media
// conditions for a frame width.
function frameOf(width: number) {
  const matchMedia = (query: string) => ({ matches: query === '(width < 767px)' && width < 767 })
  return { defaultView: { matchMedia } } as unknown as Document
}

describe('frameTokens', () => {
  test('gives the values of the width of the frame', () => {
    expect(frameTokens([gap], frameOf(390))[0].value).toBe('5.6px')
    expect(frameTokens([gap], frameOf(1440))[0].value).toBe('9.44px')
  })

  test('with no window, the tokens as they are', () => {
    expect(frameTokens([gap], { defaultView: null } as unknown as Document)).toEqual([gap])
  })
})
