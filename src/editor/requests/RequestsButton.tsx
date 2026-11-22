import { CheckIcon, ClipboardTextIcon } from '@phosphor-icons/react'
import { sentenceCopyLabels, useCopy } from '../copy.ts'
import { useEditScreens } from '../edits/store.ts'
import { Badge, Button, Tooltip, TooltipContent, TooltipTrigger } from '../ui'
import { agentSentence } from './agent-sentence.ts'

// The button "Copy for the agent": it copies the one sentence that the user
// gives to an agent (`agent-sentence.ts`), and its badge is the count of the
// open edits of all screens. It is off with no change.

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
            aria-label={`Copy for the agent, ${changes}. ${copyLabels[copy]}`}
            className="gap-1.5"
            data-requests={count}
            disabled={count === 0}
            onClick={onClick}
            type="button"
            variant="ghost"
          />
        }
      >
        {copy === 'copied' ? <CheckIcon /> : <ClipboardTextIcon />}
        Copy for the agent
        <Badge className="min-w-[18px] px-1.5 tabular-nums" variant={count === 0 ? 'outline' : 'default'} data-requests-count="">
          {count}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-80" side="top">
        {count === 0 ? 'No changes to apply' : `${changes}. ${copyLabels[copy]}`}
      </TooltipContent>
    </Tooltip>
  )
}
