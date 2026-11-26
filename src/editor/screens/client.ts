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
import { failure } from '../answer-text.ts'

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

const isText = (value: unknown): value is string => typeof value === 'string'
const isTexts = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isTextOrNull = (value: unknown) => value === null || isText(value)

function isPlan(value: unknown): value is AppliedAction {
  if (!isRecord(value)) return false
  const { action, screen, screens, linkedBy, moves, writes, removes } = value
  return (
    isText(action) &&
    isText(screen) &&
    Array.isArray(screens) &&
    screens.every((change) => isRecord(change) && isTextOrNull(change.from) && isTextOrNull(change.to)) &&
    isTexts(linkedBy) &&
    Array.isArray(moves) &&
    moves.every((step) => isRecord(step) && isText(step.from) && isText(step.to)) &&
    isTexts(writes) &&
    isTexts(removes)
  )
}

// The result of the answer of an action, or null for a content that is not
// an `ActionAnswer`.
export function actionResultOf(data: unknown): ActionResult | null {
  if (!isRecord(data)) return null
  const answer = data as Partial<ActionAnswer>
  if (answer.applied === true) return isPlan(answer.plan) ? { status: 'applied', plan: answer.plan } : null
  if (answer.applied === false) return isTexts(answer.refusals) ? { status: 'refused', refusals: answer.refusals } : null
  return null
}

// The items of the answer of the trash, or null for a content that is not a
// `TrashAnswer`.
export function trashItemsOf(data: unknown): TrashItem[] | null {
  if (!isRecord(data) || !Array.isArray((data as Partial<TrashAnswer>).items)) return null
  const items = (data as TrashAnswer).items
  return items.every((item) => isRecord(item) && isText(item.folder) && isText(item.screen) && isTexts(item.files) && isText(item.time))
    ? items
    : null
}

const notAnAnswer = 'The dev server gave an answer that the editor cannot read'

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
      return actionResultOf(JSON.parse(await response.text())) ?? { status: 'error', error: notAnAnswer }
    } catch (error) {
      return { status: 'error', error: messageOf(error) }
    }
  },
  trash: async () => {
    try {
      const response = await fetch(trashAddress, { cache: 'no-store' })
      if (!response.ok) return { status: 'error', error: await failure(response) }
      const items = trashItemsOf(JSON.parse(await response.text()))
      return items === null ? { status: 'error', error: notAnAnswer } : { status: 'loaded', items }
    } catch (error) {
      return { status: 'error', error: messageOf(error) }
    }
  },
}
