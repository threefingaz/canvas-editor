import { useState } from 'react'
import type { Token } from '../../tokens/format.ts'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Slider } from '../ui/components/primitives'
import { activeToken, controlOf, stepName } from './edit.ts'
import type { InspectorRow } from './model.ts'

// The control of a style value: it accepts only tokens of the group of the
// row, never a free value.
// - spacing, radius, shadow: a step control over the tokens of the group, with
//   the name of a new step while the thumb is moved to it;
// - color: a select of the color tokens, each with a swatch;
// - text style: a select of the text styles, each with its size.
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
// its size. The select shows the token of a linked or equal value; a value
// with no token shows a prompt.
function TokenSelect({ row, onPick, kind }: Props & { kind: 'color' | 'textStyle' }) {
  const state = row.state
  const current = state && state.state !== 'none' ? state.token.id : null
  const byId = new Map(row.tokens.map((token) => [token.id, token]))
  const prompt = kind === 'color' ? 'Choose a color token' : 'Choose a text style'
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
        className="w-full min-w-0 justify-between"
        aria-label={`${row.label} token`}
        data-token-control={kind}
      >
        <SelectValue>
          {(id: unknown) => {
            const token = typeof id === 'string' ? byId.get(id) : undefined
            return token ? (
              <TokenLabel token={token} />
            ) : (
              <span className="text-[color:var(--muted-foreground)]">{prompt}</span>
            )
          }}
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
      <span
        className="size-3 shrink-0 rounded-sm border border-[color:color-mix(in_oklab,var(--border)_30%,transparent)]"
        style={{ backgroundColor: value }}
      />
      <span className="min-w-0 truncate">{token.name}</span>
    </span>
  )
}
