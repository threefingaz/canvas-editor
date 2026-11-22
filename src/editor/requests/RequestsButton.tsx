import { CheckIcon, ClipboardTextIcon, PaperPlaneTiltIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { failedDelay, sentenceCopyLabels, useCopy } from '../copy.ts'
import { useEditScreens } from '../edits/store.ts'
import { Badge, Button, Tooltip, TooltipContent, TooltipTrigger } from '../ui'
import { agentSentence } from './agent-sentence.ts'
import { idle, sendLabel, sendStatus, sendText, sendToAgent, sentDelay, stateAfter, type SendState } from './send.ts'

// The two buttons that give the changes to the agent. They are off with no
// change.
//
// "Send to the agent" asks the dev server to open the chat of the agent in
// the code editor with the one sentence that the agent needs
// (`agent-sentence.ts`), thus the user neither types nor pastes. Its badge is
// the count of the open edits of all screens. When the command does not
// start, it copies the sentence and says so.
//
// "Copy for the agent" is the small button after it: it copies the sentence,
// for an agent that the command cannot reach.

const copyLabels = sentenceCopyLabels(agentSentence)

export function RequestsButton() {
  const screens = useEditScreens()
  const count = Object.values(screens).reduce((sum, list) => sum + list.length, 0)
  const [copy, onCopy] = useCopy(agentSentence)
  const [send, setSend] = useState<SendState>(idle)

  // A result goes away after a short time.
  useEffect(() => {
    if (send.kind !== 'sent' && send.kind !== 'failed') return
    const timer = setTimeout(() => setSend(idle), send.kind === 'failed' ? failedDelay : sentDelay)
    return () => clearTimeout(timer)
  }, [send])

  const onSend = () => {
    if (send.kind === 'sending') return
    setSend({ kind: 'sending' })
    void sendToAgent((address, init) => fetch(address, init)).then((answer) => {
      // The fallback: the user pastes the sentence.
      if (!answer.started) onCopy()
      setSend(stateAfter(answer))
    })
  }

  const changes = `${count} ${count === 1 ? 'change' : 'changes'}`
  const label = sendLabel(send, copy, agentSentence)
  // The copy button shows the result of its own copy, not of the copy that a
  // failed send made: the send button says that.
  const ownCopy = send.kind === 'failed' ? 'idle' : copy
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={`Send to the agent, ${changes}. ${label}`}
              className="gap-1.5"
              data-send-agent={send.kind}
              disabled={count === 0}
              onClick={onSend}
              type="button"
              variant="ghost"
            />
          }
        >
          {send.kind === 'sent' ? (
            <CheckIcon />
          ) : send.kind === 'failed' ? (
            <WarningCircleIcon className="text-[color:var(--destructive)]" />
          ) : (
            <PaperPlaneTiltIcon />
          )}
          {sendText(send, copy)}
          <Badge className="min-w-[18px] px-1.5 tabular-nums" variant={count === 0 ? 'outline' : 'default'} data-requests-count="">
            {count}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-80" side="top">
          {count === 0 ? 'No changes to apply' : `${changes}. ${label}`}
        </TooltipContent>
      </Tooltip>
      <span className="sr-only" data-send-agent-status="" role="status">
        {sendStatus(send, copy, agentSentence)}
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={`Copy for the agent, ${changes}. ${copyLabels[ownCopy]}`}
              data-requests={count}
              disabled={count === 0}
              onClick={onCopy}
              size="icon"
              type="button"
              variant="ghost"
            />
          }
        >
          {ownCopy === 'copied' ? <CheckIcon /> : <ClipboardTextIcon />}
        </TooltipTrigger>
        <TooltipContent className="max-w-80" side="top">
          {count === 0 ? 'Copy for the agent: no changes to apply' : `Copy for the agent. ${copyLabels[ownCopy]}`}
        </TooltipContent>
      </Tooltip>
    </>
  )
}
