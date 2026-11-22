import { XIcon } from '@phosphor-icons/react'
import { Button } from '../ui'
import { bubble } from './bubble-store.ts'

// The header of a floating panel (the comment bubble, the options panel): its
// name, with the full title on hover, and the button that closes it. Escape
// closes it too (the one Escape of `App.tsx`).
export function FloatingHeader({ name, title, closeLabel }: { name: string; title: string; closeLabel: string }) {
  return (
    <header className="flex shrink-0 items-center gap-2 py-1 pr-1 pl-3">
      <h3 className="m-0 min-w-0 flex-1 truncate text-xs font-semibold" title={title}>
        {name}
      </h3>
      <span title="Close (Escape)">
        <Button size="icon-xs" variant="ghost" aria-label={closeLabel} onClick={() => bubble.send({ type: 'close' })}>
          <XIcon />
        </Button>
      </span>
    </header>
  )
}
