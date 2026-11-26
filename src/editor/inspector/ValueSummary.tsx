import { EqualsIcon, LinkSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { valueSummary } from './edit.ts'
import type { InspectorRow } from './model.ts'

// The view of what the value of a row says (`valueSummary`). The value line of
// `ValueRow` and the closed select of `TokenControl` render it, thus the two
// show the value in one way.

// The value of a row as one line: the swatch, the main text, and the mark at
// the end. The swatch and the marks keep their size. The mark part has a flex
// basis of 0 and grows into the room that the main text leaves, thus a lack of
// room cuts the token name first; the part keeps at least the mark, its gap
// (1.125rem) and about four characters (`≈ bo…`), and only then is the main
// text cut (`14px / 21p…`). The full text is in the title. A token name of
// fewer than four characters gets the rest of that least width as padding,
// at most a character or two.
export function ValueSummaryView({ row }: { row: InspectorRow }) {
  const summary = valueSummary(row)
  const { hint } = summary
  const tone = hint?.tone === 'attention' ? 'text-[color:var(--attention)]' : 'text-[color:var(--muted-foreground)]'
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5" title={summary.title}>
      {row.swatch && <Swatch color={row.swatch} size="size-3.5" />}
      <span className={`min-w-0 truncate text-[color:var(--foreground)] ${summary.linked ? 'font-medium' : 'font-mono text-[11px] font-normal'}`}>
        {summary.main}
      </span>
      {summary.linked && (
        <LinkSimpleIcon aria-label="Linked to a token" className="ml-auto size-3.5 shrink-0 text-[color:var(--link)]" />
      )}
      {hint && (
        <span className={`flex min-w-[calc(1.125rem+4ch)] flex-[1_1_0%] items-center justify-end gap-1 font-normal ${tone}`}>
          {hint.mark === 'equal' ? (
            <EqualsIcon aria-label="Equal to a token, not linked" className="size-3.5 shrink-0" />
          ) : (
            <WarningCircleIcon aria-label="No token" className="size-3.5 shrink-0" />
          )}
          <span className="min-w-0 truncate">{hint.text}</span>
        </span>
      )}
    </span>
  )
}

// A color as a small square: the computed color of a value, or the value of a
// color token in the list of a select. `size` is the size class of the square.
export function Swatch({ color, size }: { color: string; size: 'size-3' | 'size-3.5' }) {
  return (
    <span
      className={`${size} shrink-0 rounded-sm border border-[color:color-mix(in_oklab,var(--border)_30%,transparent)]`}
      style={{ backgroundColor: color }}
    />
  )
}
