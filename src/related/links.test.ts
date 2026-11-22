import { describe, expect, it } from 'vitest'
import { flowPairs, linkPairs, unknownLinks, unreached, type LinkedScreen } from './links.ts'

function screen(id: string, links: string[] = [], more: Partial<LinkedScreen> = {}): LinkedScreen {
  const slash = id.lastIndexOf('/')
  return { id, flow: slash === -1 ? '' : id.slice(0, slash), width: 1440, links, ...more }
}

describe('linkPairs', () => {
  it('gives each link to a known screen one time', () => {
    const screens = [screen('a/one', ['a/two', 'a/two', 'a/none']), screen('a/two', ['a/one'])]
    expect(linkPairs(screens)).toEqual([
      { from: 'a/one', to: 'a/two' },
      { from: 'a/two', to: 'a/one' },
    ])
  })

  it('leaves out a link of a screen to itself', () => {
    expect(linkPairs([screen('a/one', ['a/one'])])).toEqual([])
  })

  it('takes no option as a source or a target', () => {
    const screens = [
      screen('a/one', ['a/one-option-1', 'a/two']),
      screen('a/one-option-1', ['a/two'], { optionOf: 'a/one' }),
      screen('a/two'),
    ]
    expect(linkPairs(screens)).toEqual([{ from: 'a/one', to: 'a/two' }])
  })
})

describe('flowPairs', () => {
  it('leaves out a link of a state that its base has too', () => {
    const screens = [
      screen('a/list', ['a/invite']),
      screen('a/list-removed', ['a/invite', 'a/list'], { stateOf: 'a/list' }),
      screen('a/invite', ['a/list']),
    ]
    expect(flowPairs(screens)).toEqual([
      { from: 'a/list', to: 'a/invite' },
      { from: 'a/list-removed', to: 'a/list' },
      { from: 'a/invite', to: 'a/list' },
    ])
  })
})

describe('unknownLinks', () => {
  it('gives the ids that no screen has, each one time', () => {
    expect(unknownLinks(screen('a/one', ['a/two', 'a/x', 'a/x']), new Set(['a/one', 'a/two']))).toEqual(['a/x'])
  })
})

describe('unreached', () => {
  it('gives nothing for a flow with one start', () => {
    expect(unreached([screen('a/one', ['a/two']), screen('a/two')])).toEqual([])
  })

  it('gives each screen with no link to it when a flow has more than one', () => {
    const screens = [screen('a/one', ['a/two']), screen('a/phone'), screen('a/two'), screen('b/start')]
    expect(unreached(screens)).toEqual(['a/one', 'a/phone'])
  })

  it('counts no state and no option', () => {
    const screens = [
      screen('a/one', ['a/two']),
      screen('a/phone'),
      screen('a/two'),
      screen('a/two-error', [], { stateOf: 'a/two' }),
      screen('a/two-option-1', [], { optionOf: 'a/two' }),
    ]
    expect(unreached(screens)).toEqual(['a/one', 'a/phone'])
  })

  it('takes the screens of a different width as a flow of their own', () => {
    const screens = [screen('a/one', ['a/two']), screen('a/one-mobile', [], { width: 390 }), screen('a/two')]
    expect(unreached(screens)).toEqual([])
  })

  it('does not count a broken file or a broken relation as a start', () => {
    const screens = [
      screen('a/one', ['a/two']),
      screen('a/bad', [], { error: 'no meta' }),
      screen('a/lost', [], { relationError: 'no base' }),
      screen('a/two'),
    ]
    expect(unreached(screens)).toEqual([])
  })

  it('does not count a link of an option as a way to a screen', () => {
    const screens = [
      screen('a/one'),
      screen('a/one-option-1', ['a/two'], { optionOf: 'a/one' }),
      screen('a/two'),
    ]
    expect(unreached(screens)).toEqual(['a/one', 'a/two'])
  })
})
