import { describe, expect, test } from 'vitest'
import { clearsSelection, isTab, tabAfter, type TabEvent } from './tabs.ts'

describe('tabAfter', () => {
  test('a click on an element in a frame opens Design', () => {
    expect(tabAfter('pick')).toBe('design')
  })

  test('a click on a title, on the count of issues or on a pin of the title row opens Changes', () => {
    const events: TabEvent[] = ['title', 'issues', 'pin-of-screen']
    for (const event of events) expect(tabAfter(event)).toBe('changes')
  })
})

describe('clearsSelection', () => {
  const id = 'onboarding/welcome'

  test('the title and the count of issues clear each selection, also one in the same screen', () => {
    for (const event of ['title', 'issues'] as const) {
      expect(clearsSelection(event, id, id)).toBe(true)
      expect(clearsSelection(event, 'onboarding/workspace', id)).toBe(true)
      expect(clearsSelection(event, null, id)).toBe(true)
    }
  })

  test('a pin of the title row keeps a selection in its screen and clears one in a different screen', () => {
    expect(clearsSelection('pin-of-screen', id, id)).toBe(false)
    expect(clearsSelection('pin-of-screen', 'onboarding/workspace', id)).toBe(true)
  })
})

describe('isTab', () => {
  test('true for the two tabs and false for a different value', () => {
    expect(isTab('design')).toBe(true)
    expect(isTab('changes')).toBe(true)
    expect(isTab('issues')).toBe(false)
    expect(isTab(null)).toBe(false)
  })
})
