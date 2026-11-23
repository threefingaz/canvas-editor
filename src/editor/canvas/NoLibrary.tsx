import { ClipboardTextIcon } from '@phosphor-icons/react'
import { connectSentence, tokensSentence } from '../../frame/library-setup.ts'
import { sentenceCopyLabels, useCopy } from '../copy.ts'
import { Button, PanelSurface, Tooltip, TooltipContent, TooltipTrigger } from '../ui'

// The messages at the top of the canvas for the setup of the library, each
// with a button that copies the sentence for the agent, as the button of the
// requests does:
//
// - `NoLibrary`: no library pack is connected (`library` of
//   `virtual:canvas-screens` is null).
// - `NoTokens`: the library is connected and its tokens are not set up (the
//   level `connected`, `levelOf` in `tools/pack.ts`). The screens render, and
//   the work goes on meanwhile. It is in the column of the messages at the
//   top of the canvas, with the error of the token file and the notice.

type NoticeProps = { title: string; detail?: string; sentence: string; mark: 'no-library' | 'no-tokens'; place: string }

function SetupNotice({ title, detail, sentence, mark, place }: NoticeProps) {
  const [copy, onClick] = useCopy(sentence)
  const copyLabels = sentenceCopyLabels(sentence)
  return (
    <PanelSurface
      className={`${place} flex items-center gap-3 rounded-xl py-2 pr-2 pl-4 shadow-lg`}
      {...{ [`data-${mark}`]: '' }}
    >
      <div className="min-w-0 text-sm" role="status">
        <p className="m-0 font-medium">{title}</p>
        {detail && <p className="m-0 text-[color:var(--muted-foreground)]">{detail}</p>}
        <p className="m-0 text-[color:var(--muted-foreground)]">
          Give the agent: <span data-library-sentence="">{sentence}</span>
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

export function NoLibrary() {
  return (
    <SetupNotice
      title="No library is connected."
      sentence={connectSentence}
      mark="no-library"
      place="absolute top-4 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2"
    />
  )
}

export function NoTokens() {
  return (
    <SetupNotice
      title="The tokens are not set up."
      detail="The screens use the library. The panel has no token controls, and no value counts as a deviation, until the agent sets up the tokens."
      sentence={tokensSentence}
      mark="no-tokens"
      place="pointer-events-auto max-w-xl"
    />
  )
}
