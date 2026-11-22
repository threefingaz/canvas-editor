import {
  AlignBottomIcon,
  AlignCenterHorizontalIcon,
  AlignCenterVerticalIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsHorizontalIcon,
  ArrowsOutLineHorizontalIcon,
  ArrowsOutLineVerticalIcon,
  ArrowsVerticalIcon,
  ArrowUpIcon,
  ColumnsIcon,
  DotsThreeIcon,
  DotsThreeVerticalIcon,
  RowsIcon,
  TextUnderlineIcon,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { ToggleGroup, ToggleGroupItem } from '../ui'
import { layoutKeywords, type LayoutProperty } from './edit.ts'

// The controls of the Layout section: a segmented control for the direction,
// the wrap, the alignment and the justification of a flex or grid container,
// with the keyword values of `layoutKeywords` (no free value). A move of the
// element among its siblings is made on the canvas (`SelectionBar.tsx`).

// The axis of the alignment and the justification, for the icons: in a flex
// row the items go from left to right, thus the justification is horizontal
// and the alignment vertical; in a flex column the other way. In a grid the
// justification is horizontal and the alignment vertical.
export type Axes = { grid: boolean; direction: string }

function horizontal(property: LayoutProperty, axes: Axes): boolean {
  const row = axes.direction.startsWith('row')
  if (property === 'justify-content') return axes.grid || row
  return !axes.grid && !row
}

type Option = { value: string; label: string; icon: ReactNode }

// The text of a keyword for its tooltip: `space-between` gives "Space between".
function keywordLabel(value: string): string {
  const text = value.replace(/^flex-/, '').replace(/-/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// The icon of a keyword; null gives a text label.
function iconOf(property: LayoutProperty, value: string, across: boolean): ReactNode {
  switch (property) {
    case 'flex-direction':
      return {
        row: <ArrowRightIcon />,
        column: <ArrowDownIcon />,
        'row-reverse': <ArrowLeftIcon />,
        'column-reverse': <ArrowUpIcon />,
      }[value]
    case 'flex-wrap':
      return null
    case 'align-items':
    case 'justify-content':
      return {
        'flex-start': across ? <AlignLeftIcon /> : <AlignTopIcon />,
        center: across ? <AlignCenterHorizontalIcon /> : <AlignCenterVerticalIcon />,
        'flex-end': across ? <AlignRightIcon /> : <AlignBottomIcon />,
        stretch: across ? <ArrowsOutLineHorizontalIcon /> : <ArrowsOutLineVerticalIcon />,
        baseline: <TextUnderlineIcon />,
        'space-between': across ? <ArrowsHorizontalIcon /> : <ArrowsVerticalIcon />,
        'space-around': across ? <ColumnsIcon /> : <RowsIcon />,
        'space-evenly': across ? <DotsThreeIcon /> : <DotsThreeVerticalIcon />,
      }[value]
  }
}

const wrapLabels: Record<string, string> = { nowrap: 'No wrap', wrap: 'Wrap', 'wrap-reverse': 'Reverse' }

function optionsOf(property: LayoutProperty, axes: Axes): Option[] {
  const across = horizontal(property, axes)
  return layoutKeywords[property].map((value) => ({
    value,
    label: property === 'flex-wrap' ? (wrapLabels[value] ?? value) : keywordLabel(value),
    icon: iconOf(property, value, across),
  }))
}

type ControlProps = {
  property: LayoutProperty
  // The computed value; a value that is not a keyword of the list (`normal`)
  // has no pressed item.
  value: string
  label: string
  axes: Axes
  onPick: (value: string) => void
}

// The keyword values of one layout property as a segmented control. A click
// on the pressed item changes nothing.
export function LayoutControl({ property, value, label, axes, onPick }: ControlProps) {
  const options = optionsOf(property, axes)
  return (
    <ToggleGroup
      aria-label={label}
      className="w-full"
      size="sm"
      variant="outline"
      value={options.some((option) => option.value === value) ? [value] : []}
      onValueChange={(next) => {
        const [picked] = next
        if (typeof picked === 'string' && picked !== value) onPick(picked)
      }}
      data-layout-control={property}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.label}
          title={option.label}
          className="min-w-0 flex-1"
          data-layout-value={option.value}
        >
          {option.icon ?? option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
