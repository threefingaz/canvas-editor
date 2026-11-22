import { describe, expect, test } from 'vitest'
import { arrowsFree, barKey, escapeAction, focusOnCanvas, historyKey, submitKey, typingIn, viewKey } from './focus.ts'

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

describe('viewKey', () => {
  const key = (code: string, keys: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {}) => ({
    code,
    ctrlKey: keys.ctrl ?? false,
    metaKey: keys.meta ?? false,
    shiftKey: keys.shift ?? false,
    altKey: keys.alt ?? false,
  })

  test('Shift with 1, 2 and 0 fit all, fit the frame and zoom to 100%', () => {
    expect(viewKey(key('Digit1', { shift: true }))).toBe('fit-all')
    expect(viewKey(key('Digit2', { shift: true }))).toBe('fit-frame')
    expect(viewKey(key('Digit0', { shift: true }))).toBe('actual')
  })

  test('C is no key of the view: it is a key of the bar', () => {
    expect(viewKey(key('KeyC'))).toBeNull()
    expect(viewKey(key('KeyC', { shift: true }))).toBeNull()
  })

  test('the digits with no Shift are no key of the view', () => {
    expect(viewKey(key('Digit1'))).toBeNull()
    expect(viewKey(key('Digit2'))).toBeNull()
    expect(viewKey(key('Digit0'))).toBeNull()
  })

  test('Ctrl, Cmd or Alt makes each key no key of the view', () => {
    for (const modifier of [{ ctrl: true }, { meta: true }, { alt: true }]) {
      expect(viewKey(key('Digit1', { shift: true, ...modifier }))).toBeNull()
      expect(viewKey(key('Digit2', { shift: true, ...modifier }))).toBeNull()
      expect(viewKey(key('Digit0', { shift: true, ...modifier }))).toBeNull()
    }
  })

  test('the code counts, not the key: a layout where Shift with 1 gives a different key', () => {
    // The key of Shift with 1 is `!` on one layout and `%` on a different
    // one; the code is Digit1 on each.
    expect(viewKey({ ...key('Digit1', { shift: true }), key: '%' } as Parameters<typeof viewKey>[0])).toBe('fit-all')
    expect(viewKey(key('Numpad1', { shift: true }))).toBeNull()
  })

  test('a different key, and a code of the prototype of an object, are no key of the view', () => {
    expect(viewKey(key('KeyX'))).toBeNull()
    expect(viewKey(key('toString', { shift: true }))).toBeNull()
  })
})

describe('escapeAction', () => {
  const none = { dragging: false, floating: false, operating: false, selected: false }

  test('nothing to do gives null', () => {
    expect(escapeAction(none)).toBeNull()
  })

  test('each state alone gives its action', () => {
    expect(escapeAction({ ...none, dragging: true })).toBe('cancel-drag')
    expect(escapeAction({ ...none, floating: true })).toBe('close-floating')
    expect(escapeAction({ ...none, operating: true })).toBe('operate-off')
    expect(escapeAction({ ...none, selected: true })).toBe('clear-selection')
  })

  test('a drag first, then the floating panel, then Preview, then the selection', () => {
    const all = { dragging: true, floating: true, operating: true, selected: true }
    expect(escapeAction(all)).toBe('cancel-drag')
    expect(escapeAction({ ...all, dragging: false })).toBe('close-floating')
    expect(escapeAction({ ...all, dragging: false, floating: false })).toBe('operate-off')
    expect(escapeAction({ ...all, dragging: false, floating: false, operating: false })).toBe('clear-selection')
  })
})

describe('barKey', () => {
  const key = (
    name: string,
    code: string,
    keys: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {},
  ) => ({
    key: name,
    code,
    ctrlKey: keys.ctrl ?? false,
    metaKey: keys.meta ?? false,
    shiftKey: keys.shift ?? false,
    altKey: keys.alt ?? false,
  })

  test('Delete and Backspace remove, also with Shift', () => {
    expect(barKey(key('Delete', 'Delete'))).toBe('remove')
    expect(barKey(key('Backspace', 'Backspace'))).toBe('remove')
    expect(barKey(key('Backspace', 'Backspace', { shift: true }))).toBe('remove')
  })

  test('C with no Shift opens the comment, by its code', () => {
    expect(barKey(key('c', 'KeyC'))).toBe('comment')
    expect(barKey(key('с', 'KeyC'))).toBe('comment')
    expect(barKey(key('C', 'KeyC', { shift: true }))).toBeNull()
  })

  test('Ctrl, Cmd or Alt makes each key no key of the bar', () => {
    for (const modifier of [{ ctrl: true }, { meta: true }, { alt: true }]) {
      expect(barKey(key('Delete', 'Delete', modifier))).toBeNull()
      expect(barKey(key('Backspace', 'Backspace', modifier))).toBeNull()
      expect(barKey(key('c', 'KeyC', modifier))).toBeNull()
    }
  })

  test('a different key is no key of the bar', () => {
    expect(barKey(key('x', 'KeyX'))).toBeNull()
    expect(barKey(key('!', 'Digit1', { shift: true }))).toBeNull()
  })

  test('each arrow key moves the element in its direction on the screen', () => {
    expect(barKey(key('ArrowLeft', 'ArrowLeft'))).toEqual({ move: 'left' })
    expect(barKey(key('ArrowRight', 'ArrowRight'))).toEqual({ move: 'right' })
    expect(barKey(key('ArrowUp', 'ArrowUp'))).toEqual({ move: 'up' })
    expect(barKey(key('ArrowDown', 'ArrowDown'))).toEqual({ move: 'down' })
  })

  test('an arrow key with Shift, Ctrl, Cmd or Alt is no key of the bar', () => {
    for (const modifier of [{ shift: true }, { ctrl: true }, { meta: true }, { alt: true }]) {
      for (const arrow of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
        expect(barKey(key(arrow, arrow, modifier))).toBeNull()
      }
    }
  })
})

describe('arrowsFree', () => {
  const free = (state: { typing?: boolean; floating?: boolean; onCanvas?: boolean }) =>
    arrowsFree({ typing: state.typing ?? false, floating: state.floating ?? false, onCanvas: state.onCanvas ?? false })

  test('true with the focus on the body or on the canvas', () => {
    // The body counts as the canvas: the caller gives `onCanvas: true` for it.
    expect(free({ onCanvas: true })).toBe(true)
  })

  test('false in a field that takes text, also on the canvas', () => {
    expect(free({ onCanvas: true, typing: true })).toBe(false)
  })

  test('false in a floating part of the canvas', () => {
    expect(free({ onCanvas: true, floating: true })).toBe(false)
  })

  test('false off the canvas, also with no field and no floating part', () => {
    // The caller gives `onCanvas: false` for the panel and for a list that a
    // control of the panel opens outside it (`focusOnCanvas`).
    expect(free({ onCanvas: false })).toBe(false)
  })
})

describe('focusOnCanvas', () => {
  // A plain element inside the parts that `within` names (the selectors of
  // its parents). `closest` answers for each selector of a list.
  const element = (tagName: string, within: string[] = []) => ({
    tagName,
    closest: (selector: string) => (selector.split(',').some((part) => within.includes(part.trim())) ? {} : null),
  })

  test('true for no element, the body, and an element in the canvas', () => {
    expect(focusOnCanvas(null)).toBe(true)
    expect(focusOnCanvas(element('BODY'))).toBe(true)
    expect(focusOnCanvas(element('BUTTON', ['[data-canvas]']))).toBe(true)
    expect(focusOnCanvas(element('DIV', ['[data-canvas]']))).toBe(true)
  })

  test('false for a control of the panel', () => {
    expect(focusOnCanvas(element('BUTTON', ['[data-inspector]']))).toBe(false)
  })

  test('false for a list that a control of the panel opens outside the panel', () => {
    // The list is a child of the body, in no part of the editor.
    expect(focusOnCanvas(element('DIV'))).toBe(false)
  })

  test('false for a control of the toolbar, which is inside the canvas', () => {
    expect(focusOnCanvas(element('BUTTON', ['[data-canvas]', '[data-toolbar]']))).toBe(false)
  })
})
