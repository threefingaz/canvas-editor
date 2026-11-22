import { CheckIcon } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { donePresets, type Preset } from './presets.ts'

// The quick requests of the bubble: comments with a fixed text, above the
// box of a new comment. A click on one adds its comment at once (`onAdd`,
// the same function as the button "Add" of the box), thus the user asks the
// agent for a change with no typing; the draft in the box is not read and
// not changed. `links` are the requests that link a control to a screen:
// they are a compact list, because a project can have many screens.
//
// A request whose text is already a comment of the place (`texts`) is shown
// as done, and a click on it adds nothing, thus a double click gives one
// comment. A done button is off with `aria-disabled`, not with `disabled`:
// a button that goes off under the focus gives the focus to the page, and
// Delete would then remove the selected element. The block takes the wheel
// while it can scroll (`data-canvas-scroll`).

type QuickRequestsProps = {
  presets: readonly Preset[]
  // The requests of the list "Link to a screen…"; with none, no list.
  links?: readonly Preset[]
  // The texts of the comments of the place.
  texts: readonly string[]
  // True when the comment went to the store.
  onAdd: (text: string) => boolean
}

const chip =
  'inline-flex h-[22px] max-w-full cursor-pointer items-center gap-1 rounded-md border border-[color:var(--editor-line)] bg-transparent px-2 text-xs text-inherit hover:bg-[color:var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--ring)] aria-disabled:cursor-default aria-disabled:text-[color:var(--muted-foreground)] aria-disabled:hover:bg-transparent'

export function QuickRequests({ presets, links = [], texts, onAdd }: QuickRequestsProps) {
  const done = donePresets(presets, texts)
  const linked = donePresets(links, texts)
  // The screen that the keyboard chose in the list of links, and whether the
  // last change of the list came from the pointer.
  const [choice, setChoice] = useState('')
  const byPointer = useRef(false)
  const addLink = (key: string) => {
    const preset = links.find((link) => link.key === key)
    if (preset && !linked.has(preset.key)) onAdd(preset.text)
    setChoice('')
  }
  if (presets.length === 0 && links.length === 0) return null
  return (
    <div
      className="flex max-h-40 shrink-0 flex-col gap-1.5 overflow-y-auto border-t border-[color:var(--editor-line)] px-3 pt-3"
      role="group"
      aria-label="Quick requests"
      data-canvas-scroll=""
      data-quick-requests=""
    >
      <span className="text-[11px] font-medium text-[color:var(--muted-foreground)]">Quick requests</span>
      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => {
          const off = done.has(preset.key)
          return (
            <button
              key={preset.key}
              type="button"
              className={chip}
              title={off ? `Added: ${preset.text}` : preset.text}
              aria-disabled={off || undefined}
              onClick={() => {
                if (!off) onAdd(preset.text)
              }}
              data-quick-request={preset.key}
              data-quick-done={off ? '' : undefined}
            >
              {off && <CheckIcon className="size-3 shrink-0" aria-hidden />}
              <span className="truncate">{preset.label}</span>
            </button>
          )
        })}
      </div>
      {links.length > 0 && (
        // A choice with the pointer adds the comment at once, and the list
        // shows its first line again. With the keyboard a closed list changes
        // its value at each arrow key, thus the choice only shows, and Enter
        // adds it.
        <select
          className="h-[22px] w-full shrink-0 cursor-pointer rounded-md border border-[color:var(--editor-line)] bg-transparent px-1.5 text-xs text-inherit focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--ring)]"
          aria-label="Link to a screen. With the keyboard, choose a screen and press Enter."
          value={choice}
          onPointerDown={() => (byPointer.current = true)}
          onKeyDown={(event) => {
            byPointer.current = false
            if (event.key !== 'Enter' || choice === '') return
            event.preventDefault()
            addLink(choice)
          }}
          onBlur={() => setChoice('')}
          onChange={(event) => {
            if (byPointer.current) addLink(event.target.value)
            else setChoice(event.target.value)
          }}
          data-quick-link=""
        >
          <option value="">Link to a screen…</option>
          {links.map((link) => (
            <option key={link.key} value={link.key} disabled={linked.has(link.key)} title={link.text}>
              {linked.has(link.key) ? `✓ ${link.label}` : link.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
