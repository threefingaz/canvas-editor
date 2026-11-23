import {
  screensAddress,
  trashAddress,
  type ActionAnswer,
  type AppliedAction,
  type ScreenAction,
  type TrashAnswer,
  type TrashItem,
} from '../../requests/api.ts'
import { messageOf } from '../../tokens/format.ts'

// The calls of the editor for the screen actions of the local file API
// (`tools/requests-plugin.ts`). A call never throws: an error of the network,
// of the server or of the content gives a result with the error text.

// `refused`: the plan of the action had refusals, and nothing changed.
export type ActionResult =
  | { status: 'applied'; plan: AppliedAction }
  | { status: 'refused'; refusals: string[] }
  | { status: 'error'; error: string }

export type TrashResult = { status: 'loaded'; items: TrashItem[] } | { status: 'error'; error: string }

export type ScreensClient = {
  run: (action: ScreenAction) => Promise<ActionResult>
  trash: () => Promise<TrashResult>
}

// The text of an answer that is not a success.
async function failure(response: Response): Promise<string> {
  const text = (await response.text().catch(() => '')).trim()
  return `${response.status}${text === '' ? '' : ` ${text}`}`
}

export const screensClient: ScreensClient = {
  run: async (action) => {
    try {
      const response = await fetch(screensAddress, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
        cache: 'no-store',
      })
      if (response.status !== 200 && response.status !== 409) return { status: 'error', error: await failure(response) }
      const answer = JSON.parse(await response.text()) as ActionAnswer
      return answer.applied ? { status: 'applied', plan: answer.plan } : { status: 'refused', refusals: answer.refusals }
    } catch (error) {
      return { status: 'error', error: messageOf(error) }
    }
  },
  trash: async () => {
    try {
      const response = await fetch(trashAddress, { cache: 'no-store' })
      if (!response.ok) return { status: 'error', error: await failure(response) }
      const answer = JSON.parse(await response.text()) as TrashAnswer
      return { status: 'loaded', items: answer.items }
    } catch (error) {
      return { status: 'error', error: messageOf(error) }
    }
  },
}
