import { useEffect, useState } from 'react'

// A copy of a text to the clipboard, for a button that shows the result for a
// short time.

export type CopyState = 'idle' | 'copied' | 'failed'

// The labels of a button that copies a sentence for the agent, for each state
// of the copy. A failure gives the sentence: the user can still give it by
// hand.
export function sentenceCopyLabels(sentence: string): Record<CopyState, string> {
  return {
    idle: 'Copy the sentence for the agent',
    copied: 'Copied',
    failed: `Cannot copy to the clipboard. Give the agent: ${sentence}`,
  }
}

// How long a button shows the result of a copy, in ms. A failure shows
// longer: its text can tell the user what to copy by hand.
export const copiedDelay = 1500
export const failedDelay = 6000

// The result of the last copy, and the function that copies `text`. The
// clipboard API is missing in a page that is not a secure context: that is a
// failure too.
export function useCopy(text: string): [CopyState, () => void] {
  const [state, setState] = useState<CopyState>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), state === 'failed' ? failedDelay : copiedDelay)
    return () => clearTimeout(timer)
  }, [state])

  const copy = () => {
    const clipboard = navigator.clipboard as Clipboard | undefined
    if (!clipboard) {
      setState('failed')
      return
    }
    clipboard.writeText(text).then(
      () => setState('copied'),
      () => setState('failed'),
    )
  }

  return [state, copy]
}
