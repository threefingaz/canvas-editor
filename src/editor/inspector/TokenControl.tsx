import { useState } from 'react'
import type { Token } from '../../tokens/format.ts'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Slider } from '../ui/components/primitives'
import { activeToken, controlOf, selectLabel, stepName, valueSummary } from './edit.ts'
import type { InspectorRow } from './model.ts'
import { Swatch, ValueSummaryView } from './ValueSummary.tsx'

// The control of a style value: it accepts only tokens of the group of the
// row, never a free value.
// - spacing, radius, shadow: a step control over the tokens of the group, with
//   the name of a new step while the thumb is moved to it;
// - color: a select of the color tokens, each with a swatch;
// - text style: a select of the text styles, each with its size.
// The select stands in the place of the value (`value` of `ValueRow`,
// `inlineControl`).
// A row that `controlOf` leaves read-only shows no control.

type Props = { row: InspectorRow; onPick: (token: Token) => void }

export function TokenControl({ row, onPick }: Props) {
  const kind = controlOf(row)
  if (kind === 'color') return <TokenSelect row={row} onPick={onPick} kind="color" />
  if (kind === 'textStyle') return <TokenSelect row={row} onPick={onPick} kind="textStyle" />
  if (kind === 'step') return <StepControl row={row} onPick={onPick} />
  return null
}

// The steps go from the first to the last token of the row, one whole number
// for each token (the continuous slider with a step of 1: its keys move one
// token). A value with no token stands at its nearest step. A value with no
// nearest token has no step: the thumb stands at the first step, and a commit
// on any step gives an edit. Else only a commit on a different step gives an
// edit: a click on the thumb changes nothing. The line of the value above the
// control names the token of the value, thus the label next to the slider
// names only a different step, while the thumb is moved to it; its place
// stays, thus the slider keeps its width.
function StepControl({ row, onPick }: Props) {
  const active = activeToken(row)
  const found = row.tokens.findIndex((token) => token.id === active?.id)
  const start = found === -1 ? null : found
  const [index, setIndex] = useState<number | null>(start)
  // The row stays mounted after an edit (an undo, the agent's change of the
  // file), thus the thumb goes to the step of a new token of the value here,
  // during the render, and keeps its focus.
  const [shownStart, setShownStart] = useState(start)
  if (shownStart !== start) {
    setShownStart(start)
    setIndex(start)
  }
  const step = (value: number | readonly number[]) => (typeof value === 'number' ? value : (value[0] ?? 0))
  const name = stepName(row.tokens, index, start)
  return (
    <div className="flex min-w-0 items-center gap-2" data-token-control="step">
      <Slider
        className="min-w-0 flex-1"
        min={0}
        max={row.tokens.length - 1}
        step={1}
        value={index ?? 0}
        getAriaLabel={() => `${row.label} token`}
        onValueChange={(value) => setIndex(step(value))}
        onValueCommitted={(value) => {
          const next = step(value)
          const token = row.tokens[next]
          if (token && next !== start) onPick(token)
        }}
      />
      <span className="w-20 shrink-0 truncate text-right text-[11px] font-medium" title={name} data-active-step="">
        {name}
      </span>
    </div>
  )
}

// The tokens of the row in a select: a color with a swatch, a text style with
// its size. The closed select shows the value of the row as its value line
// would (`ValueSummaryView`: the token, or the raw value with its mark), thus
// the row says the value once. The list marks the token of a linked or equal
// value.
function TokenSelect({ row, onPick, kind }: Props & { kind: 'color' | 'textStyle' }) {
  const state = row.state
  const current = state && state.state !== 'none' ? state.token.id : null
  const byId = new Map(row.tokens.map((token) => [token.id, token]))
  return (
    <Select
      items={row.tokens.map((token) => ({ label: token.name, value: token.id }))}
      value={current}
      onValueChange={(id) => {
        const token = id === null ? undefined : byId.get(String(id))
        if (token && token.id !== current) onPick(token)
      }}
    >
      <SelectTrigger
        size="sm"
        placeholderTone="default"
        className="w-full min-w-0 flex-1 justify-between"
        aria-label={selectLabel(row)}
        title={valueSummary(row).title}
        data-token-control={kind}
      >
        <SelectValue>
          <ValueSummaryView row={row} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false}>
        <SelectGroup>
          {row.tokens.map((token) => (
            <SelectItem key={token.id} value={token.id} title={token.name}>
              <TokenLabel token={token} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function TokenLabel({ token }: { token: Token }) {
  const value = token.value
  if (typeof value !== 'string') {
    return (
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="min-w-0 truncate">{token.name}</span>
        <span className="ml-auto shrink-0 text-[10px] text-[color:var(--muted-foreground)]">
          {value.fontSize} / {value.lineHeight}
        </span>
      </span>
    )
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Swatch color={value} size="size-3" />
      <span className="min-w-0 truncate">{token.name}</span>
    </span>
  )
}
