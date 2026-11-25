// The request format and the issues format: the files in `.canvas/requests/`
// and `.canvas/issues/`, one of each for a screen. The editor writes them, the
// local file API checks them, and an agent reads and changes them. The module
// uses no DOM types, because the Node tools import it too.

import { isRecord, type Token } from '../tokens/format.ts'

// The version of the request format and the issues format.
export const formatVersion = 1 as const

export const origins = ['library', 'host', 'local'] as const

// Where the component of an element comes from: the library package, a plain
// element (`div`), or a different component.
export type Origin = (typeof origins)[number]

// One place in the code of a screen.
export type Target = {
  file: string
  line: number
  column: number
  // The JSX tag name in the screen file: 'Stack', 'Card.Header', 'div'.
  tag: string
  origin: Origin
  // The tag of the first DOM node: 'button'.
  element: string
  // How many copies the place draws.
  copies: number
  // The text of the element, 80 characters or less.
  label: string
}

export const labelLimit = 80

// The text of an element as the label of a target: one space for each run of
// white space, no space at the ends, and `labelLimit` characters or less. A
// character of two code units is not cut in two.
export function labelOf(text: string): string {
  let label = text.replace(/\s+/g, ' ').trim()
  if (label.length <= labelLimit) return label
  label = label.slice(0, labelLimit)
  const last = label.charCodeAt(label.length - 1)
  if (last >= 0xd800 && last <= 0xdbff) label = label.slice(0, -1)
  return label.trimEnd()
}

export type TokenRef = { id: string; name: string; code: string | number }

// A token as an edit or an issue names it.
export function tokenRef(token: Token): TokenRef {
  return { id: token.id, name: token.name, code: token.code }
}

// `observed`: the value was read from the page and has no token.
export type EditValue = { value: string; token?: TokenRef; observed?: true }

export type StyleChange = {
  kind: 'style'
  // CSS longhand names. A row for four equal sides gives four properties.
  properties: string[]
  before: EditValue
  after: EditValue
  // The condition of the media rule that has the winning declaration.
  media?: string
}

export type TextStyleChange = { kind: 'textStyle'; before: EditValue; after: EditValue }

export type TextChange = { kind: 'text'; before: string; after: string }

// `before` and `after` are positions among the sibling elements in the code;
// `of` is their count.
export type OrderChange = {
  kind: 'order'
  before: number
  after: number
  of: number
  previewed: boolean
}

export type RemoveChange = { kind: 'remove' }

// A task for the agent in the words of the user ("make this a table"). It has
// no preview. Its edit has the target `null` when it is about the whole
// screen.
export type CommentChange = { kind: 'comment'; text: string }

// The most characters of the text of a comment.
export const commentLimit = 2000

// A task for the agent: write `count` options of the screen, each as a screen
// file with `optionOf`. On an element, each option changes that element and
// the parts that it needs; on the whole screen, the edit has the target
// `null`. `note` is what the user wants from the options, `commentLimit`
// characters or less; it can be empty. It has no preview and never merges.
export type OptionsChange = { kind: 'options'; count: number; note: string }

// The range of the count of an `options` edit, the count of the main button
// of the options box (`initial`), and the other counts that its list offers
// (`more`).
export const optionCounts = { min: 1, max: 10, initial: 3, more: [1, 5, 10] } as const

// A task for the agent: write the option with the id `option` into its base.
// The edit is in the request file of the base, with the target `null`. A
// screen has at most one. It has no preview.
export type KeepChange = { kind: 'keep'; option: string }

export type Change =
  | StyleChange
  | TextStyleChange
  | TextChange
  | OrderChange
  | RemoveChange
  | CommentChange
  | OptionsChange
  | KeepChange

// The kinds of `Change`. A test checks that the list has each kind of the
// union.
export const changeKinds = [
  'style',
  'textStyle',
  'text',
  'order',
  'remove',
  'comment',
  'options',
  'keep',
] as const satisfies readonly Change['kind'][]

// The kinds that are a task for the agent in words, with no preview. Only a
// task can have the target null.
export const taskKinds = ['comment', 'options', 'keep'] as const satisfies readonly Change['kind'][]

export type TaskChange = Extract<Change, { kind: (typeof taskKinds)[number] }>

export function isTask(change: Change): change is TaskChange {
  return (taskKinds as readonly string[]).includes(change.kind)
}

export const replyStatuses = ['conflict', 'needs-library-change', 'unclear'] as const

// The answer of an agent to an edit that it did not apply.
export type Reply = { status: (typeof replyStatuses)[number]; text: string }

// `target` is null for a comment or an `options` edit on the whole screen,
// and always for a `keep` edit.
export type Edit = { id: string; target: Target | null; width: number; change: Change; reply?: Reply }

export type RequestFile = { version: typeof formatVersion; screen: string; file: string; edits: Edit[] }

export type Issue =
  | {
      kind: 'no-token'
      target: Target
      property: string
      value: string
      state: 'equal' | 'none'
      token?: TokenRef
      // Where the value is set: `screen` when the element sets a value in
      // the screen file (a raw value, a `style` attribute, a size of the font
      // as a number, a computed text), `library` when it does not: then the
      // value is a default of a component of the library, and it is not a
      // deviation. A file with no `set` is older: each value counts.
      set?: 'screen' | 'library'
      // True when the screen file writes this value as it is (`'16px'`,
      // `fontSize: 14`, `'#667085'`): the mark of the element names it. The
      // other values of such an element can be defaults of its component.
      written?: true
    }
  | { kind: 'override'; target: Target; property: string; value: string }
  | { kind: 'not-library'; target: Target }
  // A link to a screen address (`#/<id>`) whose id no screen has. The target
  // is the screen element that the link belongs to; `href` is the address as
  // the page has it.
  | { kind: 'broken-link'; target: Target; href: string }
  | { kind: 'render-error'; text: string }
  // The relation of the screen (`stateOf`, `optionOf` in its `meta`) breaks
  // a rule of the list: `text` is the cause. The screen shows as a base
  // screen. It has no target, as a render error.
  | { kind: 'relation'; text: string }
  // What only the page shows, and the code does not say: the content is
  // wider than the screen. `text` says it, with the element that goes over
  // the edge. It has no target.
  | { kind: 'layout'; text: string }

// The kinds of `Issue`. A test checks that the list has each kind of the
// union.
export const issueKinds = [
  'no-token',
  'override',
  'not-library',
  'broken-link',
  'render-error',
  'relation',
  'layout',
] as const satisfies readonly Issue['kind'][]

export const issueSets = ['screen', 'library'] as const

// True for an issue that is a deviation of the screen: each issue but a value
// with no token that a component of the library sets by itself.
export function isDeviation(issue: Issue): boolean {
  return !(issue.kind === 'no-token' && issue.set === 'library')
}

// The count of the deviations of a list of issues.
export function deviationCount(issues: readonly Issue[]): number {
  return issues.filter(isDeviation).length
}

export type IssuesFile = { version: typeof formatVersion; screen: string; file: string; issues: Issue[] }

// Gives an error with the place of the problem, for example
// `edit 3 "e3" target: has no line`.
type Fail = (problem: string) => never

function within(fail: Fail, field: string): Fail {
  return (problem) => fail(`${field}: ${problem}`)
}

function text(value: unknown, field: string, fail: Fail, empty = false): string {
  if (typeof value !== 'string' || (!empty && value === '')) fail(`has no text "${field}"`)
  return value as string
}

function integer(value: unknown, field: string, fail: Fail, least: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < least) {
    fail(`has no whole number "${field}" of ${least} or more`)
  }
  return value as number
}

function oneOf<T extends string>(value: unknown, list: readonly T[], field: string, fail: Fail): T {
  if (!list.includes(value as T)) fail(`has an unknown ${field} "${String(value)}"`)
  return value as T
}

function record(value: unknown, field: string, fail: Fail): Record<string, unknown> {
  if (!isRecord(value)) fail(`has no object "${field}"`)
  return value as Record<string, unknown>
}

function parseTarget(raw: unknown, outer: Fail): Target {
  const value = record(raw, 'target', outer)
  const fail = within(outer, 'target')
  const label = text(value.label, 'label', fail, true)
  if (label.length > labelLimit) fail(`has a label of more than ${labelLimit} characters`)
  return {
    file: text(value.file, 'file', fail),
    line: integer(value.line, 'line', fail, 1),
    column: integer(value.column, 'column', fail, 1),
    tag: text(value.tag, 'tag', fail),
    origin: oneOf(value.origin, origins, 'origin', fail),
    element: text(value.element, 'element', fail),
    copies: integer(value.copies, 'copies', fail, 1),
    label,
  }
}

function parseTokenRef(raw: unknown, outer: Fail): TokenRef {
  const value = record(raw, 'token', outer)
  const fail = within(outer, 'token')
  const { code } = value
  if (typeof code !== 'string' && typeof code !== 'number') fail('has no code (text or number)')
  return { id: text(value.id, 'id', fail), name: text(value.name, 'name', fail), code: code as string | number }
}

function parseEditValue(raw: unknown, field: string, outer: Fail): EditValue {
  const value = record(raw, field, outer)
  const fail = within(outer, field)
  const result: EditValue = { value: text(value.value, 'value', fail) }
  if (value.token !== undefined) result.token = parseTokenRef(value.token, fail)
  if (value.observed !== undefined) {
    if (value.observed !== true) fail('has an "observed" that is not true')
    if (result.token) fail('has a token and "observed" together')
    result.observed = true
  }
  return result
}

function parseProperties(raw: unknown, fail: Fail): string[] {
  if (!Array.isArray(raw) || raw.length === 0) fail('has no list "properties"')
  const list = (raw as unknown[]).map((item) => text(item, 'properties', fail))
  if (new Set(list).size !== list.length) fail('has a property two times in "properties"')
  return list
}

function parseChange(raw: unknown, outer: Fail): Change {
  const value = record(raw, 'change', outer)
  const fail = within(outer, 'change')
  const kind = oneOf(value.kind, changeKinds, 'kind', fail)
  switch (kind) {
    case 'style': {
      const change: StyleChange = {
        kind,
        properties: parseProperties(value.properties, fail),
        before: parseEditValue(value.before, 'before', fail),
        after: parseEditValue(value.after, 'after', fail),
      }
      if (value.media !== undefined) change.media = text(value.media, 'media', fail)
      return change
    }
    case 'textStyle':
      return {
        kind,
        before: parseEditValue(value.before, 'before', fail),
        after: parseEditValue(value.after, 'after', fail),
      }
    case 'text':
      return {
        kind,
        before: text(value.before, 'before', fail, true),
        after: text(value.after, 'after', fail, true),
      }
    case 'order': {
      const of = integer(value.of, 'of', fail, 2)
      const before = integer(value.before, 'before', fail, 0)
      const after = integer(value.after, 'after', fail, 0)
      if (before >= of) fail('has a "before" that is not less than "of"')
      if (after >= of) fail('has an "after" that is not less than "of"')
      if (typeof value.previewed !== 'boolean') fail('has no true or false "previewed"')
      return { kind, before, after, of, previewed: value.previewed as boolean }
    }
    case 'remove':
      return { kind }
    case 'comment': {
      const comment = text(value.text, 'text', fail, true)
      if (comment.trim() === '') fail('has an empty text')
      if (comment.length > commentLimit) fail(`has a text of more than ${commentLimit} characters`)
      return { kind, text: comment }
    }
    case 'options': {
      const { count } = value
      if (
        typeof count !== 'number' ||
        !Number.isInteger(count) ||
        count < optionCounts.min ||
        count > optionCounts.max
      ) {
        fail(`has no whole number "count" from ${optionCounts.min} to ${optionCounts.max}`)
      }
      const note = text(value.note, 'note', fail, true)
      if (note.length > commentLimit) fail(`has a note of more than ${commentLimit} characters`)
      return { kind, count: count as number, note }
    }
    case 'keep':
      return { kind, option: text(value.option, 'option', fail) }
  }
}

function parseReply(raw: unknown, outer: Fail): Reply {
  const value = record(raw, 'reply', outer)
  const fail = within(outer, 'reply')
  return {
    status: oneOf(value.status, replyStatuses, 'status', fail),
    text: text(value.text, 'text', fail),
  }
}

// An edit id: letters, digits, `-` and `_`. The preview joins the ids of a
// node with spaces and selects them with `~=`, thus an id has no space.
export const editIdPattern = /^[A-Za-z0-9_-]+$/

function parseEdit(raw: unknown, index: number, seen: Set<string>): Edit {
  const label = isRecord(raw) && typeof raw.id === 'string' && raw.id !== '' ? ` "${raw.id}"` : ''
  const fail: Fail = (problem) => {
    throw new Error(`request file: edit ${index + 1}${label} ${problem}`)
  }
  const value = record(raw, 'edit', fail)
  const id = text(value.id, 'id', fail)
  if (!editIdPattern.test(id)) fail('has an id with a character other than a letter, a digit, "-" and "_"')
  if (seen.has(id)) fail('is a duplicate id')
  const { width } = value
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
    fail('has no width of more than 0')
  }
  const edit: Edit = {
    id,
    target: value.target === null ? null : parseTarget(value.target, fail),
    width: width as number,
    change: parseChange(value.change, fail),
  }
  if (edit.target === null && !isTask(edit.change)) {
    fail('has the target null; only a comment, an options edit or a keep edit has no target')
  }
  if (edit.target !== null && edit.change.kind === 'keep') fail('has a target; a keep edit has the target null')
  if (value.reply !== undefined) edit.reply = parseReply(value.reply, fail)
  seen.add(id)
  return edit
}

// The fields that a request file and an issues file share.
function parseHead(json: unknown, list: 'edits' | 'issues', name: string) {
  const fail: Fail = (problem) => {
    throw new Error(`${name}: ${problem}`)
  }
  if (!isRecord(json) || !Array.isArray(json[list])) {
    fail(`the file must be an object with an ${list === 'edits' ? 'edit' : 'issue'} list in "${list}"`)
  }
  const value = json as Record<string, unknown>
  if (value.version !== formatVersion) {
    fail(`has an unknown version "${String(value.version)}"; only ${formatVersion} is known`)
  }
  return {
    version: formatVersion,
    screen: text(value.screen, 'screen', fail),
    file: text(value.file, 'file', fail),
    items: value[list] as unknown[],
  }
}

// Checks the content of a request file (the value after `JSON.parse`) and
// gives the request. An error names the edit and the problem. A field that the
// format does not have is dropped.
export function parseRequest(json: unknown): RequestFile {
  const { items, ...head } = parseHead(json, 'edits', 'request file')
  const seen = new Set<string>()
  return { ...head, edits: items.map((raw, index) => parseEdit(raw, index, seen)) }
}

// The text of a checked file: an indent of two spaces, and a line break at
// the end.
export function fileText(file: RequestFile | IssuesFile): string {
  return `${JSON.stringify(file, null, 2)}\n`
}

// The text of a request file: the fields in a fixed sequence, two spaces of
// indent, and a final line break. A request that is not correct gives an error.
export function formatRequest(file: RequestFile): string {
  return fileText(parseRequest(file))
}

function parseIssue(raw: unknown, index: number): Issue {
  const fail: Fail = (problem) => {
    throw new Error(`issues file: issue ${index + 1} ${problem}`)
  }
  const value = record(raw, 'issue', fail)
  const kind = oneOf(value.kind, issueKinds, 'kind', fail)
  switch (kind) {
    case 'no-token': {
      const issue: Issue = {
        kind,
        target: parseTarget(value.target, fail),
        property: text(value.property, 'property', fail),
        value: text(value.value, 'value', fail),
        state: oneOf(value.state, ['equal', 'none'] as const, 'state', fail),
      }
      if (value.token !== undefined) issue.token = parseTokenRef(value.token, fail)
      if (value.set !== undefined) issue.set = oneOf(value.set, issueSets, 'set', fail)
      if (value.written !== undefined) {
        if (value.written !== true) fail('has a "written" that is not true')
        issue.written = true
      }
      return issue
    }
    case 'override':
      return {
        kind,
        target: parseTarget(value.target, fail),
        property: text(value.property, 'property', fail),
        value: text(value.value, 'value', fail),
      }
    case 'not-library':
      return { kind, target: parseTarget(value.target, fail) }
    case 'broken-link':
      return { kind, target: parseTarget(value.target, fail), href: text(value.href, 'href', fail) }
    case 'render-error':
    case 'relation':
    case 'layout':
      return { kind, text: text(value.text, 'text', fail) }
  }
}

// Checks the content of an issues file and gives the issues. An error names
// the issue by its place and the problem.
export function parseIssues(json: unknown): IssuesFile {
  const { items, ...head } = parseHead(json, 'issues', 'issues file')
  return { ...head, issues: items.map(parseIssue) }
}

// The text of an issues file, in the same form as a request file.
export function formatIssues(file: IssuesFile): string {
  return fileText(parseIssues(file))
}
