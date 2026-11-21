import { ClipboardTextIcon } from '@phosphor-icons/react'
import { sentenceCopyLabels, useCopy } from '../copy.ts'
import { useEditScreens } from '../edits/store.ts'
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../ui'
import { agentSentence } from './agent-sentence.ts'

// The count of the open edits of all screens, and a button that copies the one
// sentence that the user gives to an agent (`agent-sentence.ts`).

const copyLabels = sentenceCopyLabels(agentSentence)

export function RequestsButton() {
  const screens = useEditScreens()
  const count = Object.values(screens).reduce((sum, list) => sum + list.length, 0)
  const [copy, onClick] = useCopy(agentSentence)

  const changes = `${count} ${count === 1 ? 'change' : 'changes'}`
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={`${changes}. ${copyLabels[copy]}`}
            className="gap-1.5 tabular-nums"
            data-requests={count}
            disabled={count === 0}
            onClick={onClick}
            type="button"
            variant="ghost"
          />
        }
      >
        <ClipboardTextIcon />
        {changes}
      </TooltipTrigger>
      <TooltipContent className="max-w-80" side="top">
        {count === 0 ? 'No changes to apply' : copyLabels[copy]}
      </TooltipContent>
    </Tooltip>
  )
}
