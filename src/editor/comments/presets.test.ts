import { describe, expect, test } from 'vitest'
import { commentLimit } from '../../requests/format.ts'
import { commentText } from '../inspector/edit.ts'
import { donePresets, elementPresets, linkPresets, screenPresets, type Preset } from './presets.ts'

const keys = (presets: readonly Preset[]) => presets.map((preset) => preset.key)

const screens = [
  { id: 'onboarding/welcome', title: 'Welcome' },
  { id: 'onboarding/welcome-option-1', title: 'Welcome, option 1: two columns', optionOf: 'onboarding/welcome' },
  { id: 'onboarding/workspace', title: 'Workspace' },
  { id: 'onboarding/workspace-email-error', title: 'Workspace, email error', stateOf: 'onboarding/workspace' },
  { id: 'settings/workspace', title: 'Workspace' },
]

const base = { id: 'onboarding/workspace', title: 'Workspace', width: 1440 }
const widths = [1440, 1024, 390]

// Each list that the bubble can show.
const lists: Preset[][] = [
  elementPresets('library', false),
  elementPresets('library', true),
  elementPresets('host', false),
  elementPresets('local', true),
  linkPresets(screens, 'onboarding/welcome'),
  screenPresets(base, widths, true),
  screenPresets({ ...base, stateOf: 'onboarding/welcome' }, widths, false),
  screenPresets({ ...base, optionOf: 'onboarding/welcome' }, widths, false),
]

describe('elementPresets', () => {
  test('an element of the library', () => {
    expect(keys(elementPresets('library', false))).toEqual([
      'duplicate',
      'stand-out-more',
      'stand-out-less',
      'shorten-text',
      'better-part',
      'choices',
      'use-tokens',
      'next-state',
      'error-state',
      'simplify',
    ])
  })

  test('an element that is not from the library has the rebuild first', () => {
    for (const origin of ['host', 'local'] as const) {
      const presets = elementPresets(origin, false)
      expect(presets[0].key).toBe('rebuild')
      expect(presets[0].text).toBe('Rebuild this element with parts of the library; keep its content.')
      expect(keys(presets)).not.toContain('better-part')
    }
    expect(keys(elementPresets('library', false))).not.toContain('rebuild')
  })

  test('an option has no next state', () => {
    expect(keys(elementPresets('library', true))).not.toContain('next-state')
    expect(keys(elementPresets('host', true))).not.toContain('next-state')
    expect(keys(elementPresets('host', false))).toContain('next-state')
  })

  test('the next state names the form of a state', () => {
    const next = elementPresets('library', false).find((preset) => preset.key === 'next-state')
    expect(next?.text).toContain('`stateOf`')
  })
})

describe('linkPresets', () => {
  test('each other screen that is not an option', () => {
    expect(keys(linkPresets(screens, 'onboarding/welcome'))).toEqual([
      'link:onboarding/workspace',
      'link:onboarding/workspace-email-error',
      'link:settings/workspace',
    ])
  })

  test('the text has the address of the screen', () => {
    const [first] = linkPresets(screens, 'onboarding/welcome')
    expect(first.text).toBe('Link this control to the screen `onboarding/workspace`: `href="#/onboarding/workspace"`.')
  })

  test('two equal titles get their ids', () => {
    const labels = linkPresets(screens, 'onboarding/welcome').map((preset) => preset.label)
    expect(labels).toEqual([
      'Workspace (onboarding/workspace)',
      'Workspace, email error',
      'Workspace (settings/workspace)',
    ])
  })

  test('a title that only the screen itself or an option repeats stays plain', () => {
    const labels = linkPresets(screens, 'settings/workspace').map((preset) => preset.label)
    expect(labels).toEqual(['Welcome', 'Workspace', 'Workspace, email error'])
  })

  test('no screen to link to', () => {
    expect(linkPresets([screens[0], screens[1]], 'onboarding/welcome')).toEqual([])
  })
})

describe('screenPresets', () => {
  test('a phone width is named as the mobile width', () => {
    const labels = screenPresets(base, widths, false).filter((preset) => preset.key.startsWith('width-')).map((preset) => preset.label)
    expect(labels).toEqual(['Draw at 1024 px', 'Mobile width (390 px)'])
  })

  test('a base screen with states', () => {
    expect(keys(screenPresets(base, widths, true))).toEqual([
      'missing-states',
      'state-empty',
      'state-loading',
      'state-error',
      'next-screen',
      'width-1024',
      'width-390',
      'update-states',
      'fix-deviations',
      'design-check',
      'simplify-screen',
      'link-flow',
    ])
  })

  test('a base screen with no states', () => {
    expect(keys(screenPresets(base, widths, false))).not.toContain('update-states')
  })

  test('the widths leave out the width of the screen', () => {
    const presets = screenPresets({ ...base, width: 390 }, widths, false)
    expect(keys(presets).filter((key) => key.startsWith('width-'))).toEqual(['width-1440', 'width-1024'])
    expect(presets.find((preset) => preset.key === 'width-1024')).toEqual({
      key: 'width-1024',
      label: 'Draw at 1024 px',
      text: 'Draw this screen for the width 1024 px as a new screen file in the same flow.',
    })
  })

  test('a state and an option have no states and no second width', () => {
    const rest = ['fix-deviations', 'design-check', 'simplify-screen', 'link-flow']
    expect(keys(screenPresets({ ...base, stateOf: 'onboarding/welcome' }, widths, true))).toEqual(rest)
    expect(keys(screenPresets({ ...base, optionOf: 'onboarding/welcome' }, widths, false))).toEqual(rest)
  })

  test('the check names the screen', () => {
    const fix = screenPresets(base, widths, false).find((preset) => preset.key === 'fix-deviations')
    expect(fix?.text).toContain('`npm run check -- onboarding/workspace`')
  })
})

describe('each list', () => {
  test('has unique keys and labels', () => {
    for (const list of lists) {
      expect(new Set(keys(list)).size).toBe(list.length)
      expect(new Set(list.map((preset) => preset.label)).size).toBe(list.length)
    }
  })

  test('has texts that a comment takes as they are', () => {
    for (const preset of lists.flat()) {
      expect(preset.text.length).toBeLessThanOrEqual(commentLimit)
      expect(commentText(preset.text)).toBe(preset.text)
      expect(preset.label).not.toBe('')
    }
  })
})

describe('donePresets', () => {
  test('the presets whose text is a comment of the place', () => {
    const presets = elementPresets('library', false)
    const done = donePresets(presets, ['Make this a table', presets[0].text])
    expect([...done]).toEqual(['duplicate'])
  })

  test('none with no comments', () => {
    expect(donePresets(elementPresets('host', false), []).size).toBe(0)
  })
})
