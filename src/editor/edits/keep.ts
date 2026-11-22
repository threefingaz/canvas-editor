import type { Edit } from '../../requests/format.ts'
import { isPlaced, type Item } from './model.ts'

// The rules of a `keep` item: when a base screen can take one, what an open
// one stops, and the state of the button "Keep this option" of an option.
// Also the rules of the options panel: when it takes a request for options.

// The open `keep` item of a screen, or null. A stale or replied item is open
// too: it is in the file until the user discards it or the agent applies it.
export function openKeep(list: readonly Item[]): Item | null {
  return list.find((item) => item.edit.change.kind === 'keep') ?? null
}

// The reason why a base screen with the list can take no `keep` item, or null
// when it can. The option replaces the markup of the base, thus an open item
// with a target and an open `options` item would be lost. A comment on the
// whole screen does not stop it.
export function keepBlock(list: readonly Item[]): string | null {
  if (list.some((item) => item.edit.change.kind === 'options')) {
    return 'The screen has an open request for options. Apply or discard it first.'
  }
  if (list.some((item) => isPlaced(item.edit))) {
    return 'The screen has open edits on its elements. Apply or discard them first.'
  }
  return null
}

// The reason why a screen with the list takes no edit with a target and no
// `options` edit, or null when it can take them: an open `keep` replaces the
// markup of the screen with an option, thus the place of a new edit, and new
// options, would be of the old markup. A comment on the whole screen is still
// possible.
export function editBlock(list: readonly Item[]): string | null {
  return openKeep(list)
    ? 'The screen has an open request to keep an option. Apply or discard it first.'
    : null
}

// The state of the button "Keep this option" of an option frame: the option
// can be kept (`free`; an open `keep` of a different option is then
// replaced), the open `keep` of the base is for this option (`kept`), or the
// option cannot be kept, with the reason (`blocked`).
export type KeepState = { kind: 'free' } | { kind: 'kept' } | { kind: 'blocked'; reason: string }

// The state of the option with the id, from the edits of its base. A base
// with an open item with a target or an open `options` item cannot take a
// `keep` (`keepBlock`); an open `keep` of this option wins over that.
export function keepState(option: string, base: readonly Item[]): KeepState {
  const open = openKeep(base)?.edit.change
  if (open?.kind === 'keep' && open.option === option) return { kind: 'kept' }
  const reason = keepBlock(base)
  return reason === null ? { kind: 'free' } : { kind: 'blocked', reason }
}

// The title of the frame of an option: the state of its button "Keep this
// option" (null: no button) and whether the frame has the mark of the option
// of the open `keep` of its base. `base` is null for a screen that is not an
// option. With the Preview switch on (`operating`) no frame has the button;
// the mark stays.
export type KeepView = { state: KeepState | null; kept: boolean }

export function keepView(option: string, base: readonly Item[] | null, operating: boolean): KeepView {
  if (base === null) return { state: null, kept: false }
  const state = keepState(option, base)
  return { state: operating ? null : state, kept: state.kind === 'kept' }
}

// True for a `keep` edit whose option is not an option of the base in the
// list of screens (the file is gone): it can only be discarded.
export function staleKeep(edit: Edit, options: readonly string[]): boolean {
  return edit.change.kind === 'keep' && !options.includes(edit.change.option)
}

// The reasons why the options panel takes no request, in this order.
export const optionHasNoOptions = 'An option has no options.'
export const noElementForOptions = 'The element is not found in the frame, thus it takes no request for options.'

// The reason why the options panel takes no request, or null when it takes
// one: the screen is an option, then the element of the panel is not found
// (`element` false; true for the whole screen), then the reason why the
// screen takes no edit (`block`, an open `keep`).
export function optionsBlock(state: { option: boolean; element: boolean; block: string | null }): string | null {
  if (state.option) return optionHasNoOptions
  if (!state.element) return noElementForOptions
  return state.block
}
