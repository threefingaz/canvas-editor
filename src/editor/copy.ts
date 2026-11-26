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

// The result of the last copy, and the function that copies `text`; it gives
// the result when the copy is done. The clipboard API is missing in a page
// that is not a secure context: that is a failure too. Each result shows for
// its own time: a second copy with the same result starts the time again.
export function useCopy(text: string): [CopyState, () => Promise<CopyState>] {
  const [result, setResult] = useState<{ state: CopyState }>({ state: 'idle' })
  const state = result.state

  useEffect(() => {
    if (result.state === 'idle') return
    const timer = setTimeout(() => setResult({ state: 'idle' }), result.state === 'failed' ? failedDelay : copiedDelay)
    return () => clearTimeout(timer)
  }, [result])

  const copy = async (): Promise<CopyState> => {
    const clipboard = navigator.clipboard as Clipboard | undefined
    let next: CopyState = 'failed'
    if (clipboard) {
      next = await clipboard.writeText(text).then(
        () => 'copied' as const,
        () => 'failed' as const,
      )
    }
    setResult({ state: next })
    return next
  }

  return [state, copy]
}
