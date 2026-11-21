import { ClipboardTextIcon } from '@phosphor-icons/react'
import { connectSentence } from '../../frame/library-setup.ts'
import { sentenceCopyLabels, useCopy } from '../copy.ts'
import { Button, PanelSurface, Tooltip, TooltipContent, TooltipTrigger } from '../ui'

// The message at the top of the canvas when no library pack is connected
// (`library` of `virtual:canvas-screens` is null), with a button that copies
// the sentence for the agent, as the button of the requests does.

const copyLabels = sentenceCopyLabels(connectSentence)

export function NoLibrary() {
  const [copy, onClick] = useCopy(connectSentence)
  return (
    <PanelSurface
      className="absolute top-4 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl py-2 pr-2 pl-4 shadow-lg"
      data-no-library=""
    >
      <div className="min-w-0 text-sm" role="status">
        <p className="m-0 font-medium">No library is connected.</p>
        <p className="m-0 text-[color:var(--muted-foreground)]">
          Give the agent: <span data-library-sentence="">{connectSentence}</span>
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={copyLabels[copy]}
              className="shrink-0 gap-1.5"
              data-copy-library-sentence=""
              onClick={onClick}
              type="button"
              variant="ghost"
            />
          }
        >
          <ClipboardTextIcon />
          {copy === 'copied' ? 'Copied' : 'Copy'}
        </TooltipTrigger>
        <TooltipContent className="max-w-80" side="bottom">
          {copyLabels[copy]}
        </TooltipContent>
      </Tooltip>
    </PanelSurface>
  )
}
