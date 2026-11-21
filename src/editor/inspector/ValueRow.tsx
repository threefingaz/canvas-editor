import { EqualsIcon, LinkSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import type { Token } from '../../tokens/format.ts'
import type { InspectorRow } from './model.ts'

// One style value of the inspector: the property name, then by the state:
// - linked: the token name;
// - equal: the raw value, a mark, and the token with that value;
// - none: the raw value, a mark, and the nearest token;
// - a layout value (no state): the raw value.
// A value that is not linked has the attention color when the token file has
// tokens of its kind (`missing`), else a muted color.
//
// `control` is the control that edits the value, and `actions` are the
// buttons of the row ("Link", "Use nearest", the split of the sides); both
// show below the value, the actions on a line of their own, thus the control
// keeps its width.

type Props = { row: InspectorRow; control?: ReactNode; actions?: ReactNode }

export function ValueRow({ row, control, actions }: Props) {
  const line = <ValueLine row={row} />
  if (!control && !actions) return line
  return (
    <div className="flex min-w-0 flex-col gap-1 pb-1" data-value-group="">
      {line}
      {control && <div className="min-w-0 pl-26">{control}</div>}
      {actions && <div className="flex min-w-0 items-center justify-end gap-1 pl-26">{actions}</div>}
    </div>
  )
}

function ValueLine({ row }: { row: InspectorRow }) {
  const { state } = row
  // A negative spacing shows its token with a minus sign.
  const tokenName = (token: Token) => (state?.negative ? `−${token.name}` : token.name)
  return (
    <div className="flex min-h-6 min-w-0 items-center gap-2 text-xs" data-value-row="" data-state={state?.state ?? 'plain'}>
      <span className="w-24 shrink-0 truncate text-[color:var(--muted-foreground)]" title={row.label}>
        {row.label}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {row.swatch && <Swatch color={row.swatch} />}
        {state?.state === 'linked' ? (
          <>
            <span className="min-w-0 truncate font-medium" title={`${tokenName(state.token)}: ${row.value}`}>
              {tokenName(state.token)}
            </span>
            <LinkSimpleIcon
              aria-label="Linked to a token"
              className="ml-auto size-3.5 shrink-0 text-[color:var(--link)]"
            />
          </>
        ) : (
          <>
            <RawValue value={row.value} />
            {state?.state === 'equal' && (
              <Hint
                icon={<EqualsIcon aria-label="Equal to a token, not linked" className="size-3.5 shrink-0" />}
                text={tokenName(state.token)}
                title={`Equal to ${tokenName(state.token)}, but not linked to it`}
                attention={row.missing}
              />
            )}
            {state?.state === 'none' && (
              <Hint
                icon={<WarningCircleIcon aria-label="No token" className="size-3.5 shrink-0" />}
                text={state.nearest ? `≈ ${tokenName(state.nearest)}` : 'no token'}
                title={
                  state.nearest
                    ? `No token has this value. The nearest is ${tokenName(state.nearest)}`
                    : row.missing
                      ? 'No token is near this value'
                      : 'The token file has no tokens of this kind'
                }
                attention={row.missing}
              />
            )}
          </>
        )}
      </span>
    </div>
  )
}

function RawValue({ value }: { value: string }) {
  return (
    <span className="min-w-0 truncate font-mono text-[11px]" title={value}>
      {value}
    </span>
  )
}

// The mark and the token of a value that is not linked.
function Hint({ icon, text, title, attention }: { icon: ReactNode; text: string; title: string; attention: boolean }) {
  const color = attention ? 'text-[color:var(--attention)]' : 'text-[color:var(--muted-foreground)]'
  return (
    <span className={`ml-auto flex max-w-[55%] shrink-0 items-center gap-1 ${color}`} title={title}>
      {icon}
      <span className="min-w-0 truncate">{text}</span>
    </span>
  )
}

// `color` is the computed color of the value.
function Swatch({ color }: { color: string }) {
  return (
    <span
      className="size-3.5 shrink-0 rounded-sm border border-[color:color-mix(in_oklab,var(--border)_30%,transparent)]"
      style={{ backgroundColor: color }}
    />
  )
}
