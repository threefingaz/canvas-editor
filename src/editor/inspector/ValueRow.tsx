import type { ReactNode } from 'react'
import type { InspectorRow } from './model.ts'
import { ValueSummaryView } from './ValueSummary.tsx'

// One style value of the inspector: the property name, then what the value
// says (`valueSummary`):
// - linked: the token name and a link mark;
// - equal: the raw value, a mark, and the token with that value;
// - none: the raw value, a mark, and the nearest token;
// - a layout value (no state): the raw value.
// A value that is not linked has the attention color when the token file has
// tokens of its kind (`missing`), else a muted color.
//
// `value` stands in the place of the value line, and shows the value itself
// (the select of a color or a text style), thus the row says the value once;
// with none, the row shows the value (`ValueSummaryView`). `control` is a
// control that shows below the value (the step control, the layout
// controls). `actions` are the buttons of the row ("Link", "Use nearest", the
// split of the sides), on a line of their own, thus the control keeps its
// width.

type Props = { row: InspectorRow; value?: ReactNode; control?: ReactNode; actions?: ReactNode }

export function ValueRow({ row, value, control, actions }: Props) {
  // The outer element stays the same with and without a second line: a row
  // whose actions come or go (a pick of a token) keeps its value line and its
  // select mounted, thus an open select closes in its own way and keeps the
  // focus.
  const group = Boolean(control || actions)
  return (
    <div className={group ? 'flex min-w-0 flex-col gap-1 pb-1' : 'min-w-0'} data-value-group={group ? '' : undefined}>
      <ValueLine row={row}>{value ?? <ValueSummaryView row={row} />}</ValueLine>
      {control && <div className="min-w-0 pl-26">{control}</div>}
      {actions && <div className="flex min-w-0 items-center justify-end gap-1 pl-26">{actions}</div>}
    </div>
  )
}

function ValueLine({ row, children }: { row: InspectorRow; children: ReactNode }) {
  return (
    <div className="flex min-h-6 min-w-0 items-center gap-2 text-xs" data-value-row="" data-state={row.state?.state ?? 'plain'}>
      <span className="w-24 shrink-0 truncate text-[color:var(--muted-foreground)]" title={row.label}>
        {row.label}
      </span>
      {children}
    </div>
  )
}
