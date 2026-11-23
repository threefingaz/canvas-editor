import { CheckIcon, ClipboardTextIcon, PaperPlaneTiltIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { project } from 'virtual:canvas-screens'
import { failedDelay, sentenceCopyLabels, useCopy } from '../copy.ts'
import { useEditScreens } from '../edits/store.ts'
import { Badge, Button, Tooltip, TooltipContent, TooltipTrigger } from '../ui'
import { agentSentence } from './agent-sentence.ts'
import type { AgentWayAnswer } from '../../requests/api.ts'
import {
  agentWay,
  clipboardWay,
  copyLabel,
  copyStatus,
  copyText,
  idle,
  sendLabel,
  sendStatus,
  sendText,
  sendToAgent,
  sentDelay,
  stateAfter,
  type SendState,
} from './send.ts'

// The buttons that give the changes to the agent. They are off with no
// change. The dev server says the way (`GET /__canvas/agent`, the setting
// `agent` of the config): with the clipboard, the base, the toolbar has one
// button, "Copy for the agent", with the count; with a command, the two
// buttons below. Before the answer, and when it fails, the way is the
// clipboard.
//
// "Send to the agent" asks the dev server to open the chat of the agent with
// the one sentence that the agent needs
// (`agent-sentence.ts`), thus the user neither types nor pastes. Its badge is
// the count of the open edits of all screens. When the command does not
// start, it copies the sentence and says so.
//
// "Copy for the agent" is the small button after it: it copies the sentence,
// for an agent that the command cannot reach.
//
// The sentence names the guide of the project relative to the folder where
// the agent works (`project.guide` of the list of screens).

const sentence = agentSentence(project.guide)
const copyLabels = sentenceCopyLabels(sentence)

export function RequestsButton() {
  const screens = useEditScreens()
  const count = Object.values(screens).reduce((sum, list) => sum + list.length, 0)
  const [copy, onCopy] = useCopy(sentence)
  const [send, setSend] = useState<SendState>(idle)
  const [way, setWay] = useState<AgentWayAnswer>(clipboardWay)

  // The way is fixed while the dev server runs: one call.
  useEffect(() => {
    let live = true
    void agentWay((address, init) => fetch(address, init)).then((answer) => {
      if (live) setWay(answer)
    })
    return () => {
      live = false
    }
  }, [])

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
  const badge = (
    <Badge className="min-w-[18px] px-1.5 tabular-nums" variant={count === 0 ? 'outline' : 'default'} data-requests-count="">
      {count}
    </Badge>
  )

  if (way.way === 'clipboard') {
    const label = copyLabel(copy, sentence)
    return (
      <>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={`Copy for the agent, ${changes}. ${label}`}
                className="gap-1.5"
                data-agent-way="clipboard"
                data-requests={count}
                disabled={count === 0}
                onClick={onCopy}
                type="button"
                variant="ghost"
              />
            }
          >
            {copy === 'copied' ? (
              <CheckIcon />
            ) : copy === 'failed' ? (
              <WarningCircleIcon className="text-[color:var(--destructive)]" />
            ) : (
              <ClipboardTextIcon />
            )}
            {copyText(copy)}
            {badge}
          </TooltipTrigger>
          <TooltipContent className="max-w-80" side="top">
            {count === 0 ? 'Copy for the agent: no changes to apply' : `${changes}. ${label}`}
          </TooltipContent>
        </Tooltip>
        <span className="sr-only" data-send-agent-status="" role="status">
          {copyStatus(copy, sentence)}
        </span>
      </>
    )
  }

  const label = sendLabel(send, copy, sentence, way.preset)
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
              data-agent-way="command"
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
          {badge}
        </TooltipTrigger>
        <TooltipContent className="max-w-80" side="top">
          {count === 0 ? 'No changes to apply' : `${changes}. ${label}`}
        </TooltipContent>
      </Tooltip>
      <span className="sr-only" data-send-agent-status="" role="status">
        {sendStatus(send, copy, sentence)}
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
