import { describe, expect, test } from 'vitest'
import { historyKey, submitKey, typingIn } from './focus.ts'

describe('typingIn', () => {
  test('true for an input, a text area, a select, and an element that can be edited', () => {
    expect(typingIn({ tagName: 'INPUT', isContentEditable: false })).toBe(true)
    expect(typingIn({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(true)
    expect(typingIn({ tagName: 'SELECT', isContentEditable: false })).toBe(true)
    expect(typingIn({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })

  test('false for a button, the body, and no element', () => {
    expect(typingIn({ tagName: 'BUTTON', isContentEditable: false })).toBe(false)
    expect(typingIn({ tagName: 'BODY', isContentEditable: false })).toBe(false)
    expect(typingIn(null)).toBe(false)
  })
})

describe('historyKey', () => {
  const key = (key: string, keys: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {}) => ({
    key,
    ctrlKey: keys.ctrl ?? false,
    metaKey: keys.meta ?? false,
    shiftKey: keys.shift ?? false,
    altKey: keys.alt ?? false,
  })

  test('Ctrl or Cmd with Z is undo', () => {
    expect(historyKey(key('z', { ctrl: true }))).toBe('undo')
    expect(historyKey(key('z', { meta: true }))).toBe('undo')
  })

  test('Shift with them is redo; the key can be upper case', () => {
    expect(historyKey(key('Z', { meta: true, shift: true }))).toBe('redo')
    expect(historyKey(key('z', { ctrl: true, shift: true }))).toBe('redo')
  })

  test('null for Z alone, a different key, and with Alt', () => {
    expect(historyKey(key('z'))).toBe(null)
    expect(historyKey(key('z', { shift: true }))).toBe(null)
    expect(historyKey(key('y', { ctrl: true }))).toBe(null)
    expect(historyKey(key('z', { meta: true, alt: true }))).toBe(null)
  })
})

describe('submitKey', () => {
  const key = (key: string, keys: { ctrl?: boolean; meta?: boolean; alt?: boolean } = {}) => ({
    key,
    ctrlKey: keys.ctrl ?? false,
    metaKey: keys.meta ?? false,
    altKey: keys.alt ?? false,
  })

  test('Enter with Ctrl or Cmd sends', () => {
    expect(submitKey(key('Enter', { ctrl: true }))).toBe(true)
    expect(submitKey(key('Enter', { meta: true }))).toBe(true)
  })

  test('Enter alone, Enter with Alt, and a different key do not send', () => {
    expect(submitKey(key('Enter'))).toBe(false)
    expect(submitKey(key('Enter', { meta: true, alt: true }))).toBe(false)
    expect(submitKey(key('a', { meta: true }))).toBe(false)
  })
})
