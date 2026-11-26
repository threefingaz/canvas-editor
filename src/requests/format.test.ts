import { describe, expect, expectTypeOf, test } from 'vitest'
import {
  changeKinds,
  formatIssues,
  formatRequest,
  formatVersion,
  isTask,
  issueKinds,
  labelOf,
  deviationCount,
  isDeviation,
  parseIssues,
  parseRequest,
  tokenRef,
  type Change,
  type Edit,
  type Issue,
  type IssuesFile,
  type RequestFile,
  type Target,
  commentLimit,
  optionCounts,
} from './format.ts'

const target: Target = {
  file: 'screens/onboarding/welcome.tsx',
  line: 12,
  column: 7,
  tag: 'Button',
  origin: 'library',
  element: 'button',
  copies: 1,
  label: 'Get started',
}

const edits: Edit[] = [
  {
    id: 'e1',
    target,
    width: 390,
    change: {
      kind: 'style',
      properties: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
      before: { value: '13px', observed: true },
      after: { value: '16px', token: { id: 'spacing.2', name: 'spacing.2', code: 2 } },
      media: '(min-width: 600px)',
    },
  },
  {
    id: 'e2',
    target,
    width: 390,
    change: {
      kind: 'textStyle',
      before: { value: 'body1', token: { id: 'typography.body1', name: 'body1', code: 'body1' } },
      after: { value: 'button', token: { id: 'typography.button', name: 'button', code: 'button' } },
    },
  },
  { id: 'e3', target, width: 390, change: { kind: 'text', before: 'Get started', after: 'Start' } },
  {
    id: 'e4',
    target: { ...target, tag: 'Stack', element: 'div', label: '' },
    width: 1280,
    change: { kind: 'order', before: 0, after: 2, of: 3, previewed: true },
  },
  {
    id: 'e5',
    target: { ...target, tag: 'div', origin: 'host', element: 'div', copies: 3 },
    width: 1280,
    change: { kind: 'remove' },
    reply: { status: 'needs-library-change', text: 'The library sets this value.' },
  },
  { id: 'e6', target, width: 390, change: { kind: 'comment', text: 'Make this a link.' } },
  { id: 'e7', target: null, width: 1280, change: { kind: 'comment', text: 'Add a state for an empty list.\nKeep the title.' } },
]

const request: RequestFile = {
  version: 1,
  screen: 'onboarding/welcome',
  file: 'screens/onboarding/welcome.tsx',
  edits,
}

// A copy of the file content, with one edit changed by `change`. The copy goes
// through JSON, thus the edits do not share the target object.
function requestWith(index: number, change: (edit: Record<string, unknown>) => void) {
  const copy = JSON.parse(JSON.stringify(request)) as { edits: Record<string, unknown>[] }
  change(copy.edits[index])
  return copy
}

describe('the lists of kinds', () => {
  // The type check of the build checks these: a kind that is in the union and
  // not in the list, or the reverse, is a type error.
  test('have each kind of their union and no other kind', () => {
    expectTypeOf<(typeof changeKinds)[number]>().toEqualTypeOf<Change['kind']>()
    expectTypeOf<(typeof issueKinds)[number]>().toEqualTypeOf<Issue['kind']>()
    expect(new Set(changeKinds).size).toBe(changeKinds.length)
    expect(new Set(issueKinds).size).toBe(issueKinds.length)
  })

  test('a task is a comment, an options edit or a keep edit', () => {
    expect(changeKinds.filter((kind) => isTask({ kind } as Change))).toEqual(['comment', 'options', 'keep'])
  })

  test('the version of the format is 1', () => {
    expect(formatVersion).toBe(1)
  })
})

describe('labelOf', () => {
  test('makes one space of each run of white space and trims the ends', () => {
    expect(labelOf('  Welcome\n\n  back\t to  the app ')).toBe('Welcome back to the app')
    expect(labelOf('')).toBe('')
  })

  test('cuts at 80 characters', () => {
    const label = labelOf('word '.repeat(40))
    expect(label.length).toBeLessThanOrEqual(80)
    expect(label).toBe('word '.repeat(16).trimEnd())
    expect(labelOf('a'.repeat(100))).toBe('a'.repeat(80))
  })

  test('does not cut a character in two', () => {
    const label = labelOf(`${'a'.repeat(79)}😀`)
    expect(label).toBe('a'.repeat(79))
  })
})

describe('tokenRef', () => {
  test('keeps the id, the name and the code of the token', () => {
    const token = { id: 'spacing.4', name: '4', group: 'spacing' as const, value: '32px', code: 4 }
    expect(tokenRef(token)).toEqual({ id: 'spacing.4', name: '4', code: 4 })
  })
})

describe('parseRequest', () => {
  test('gives the request of a correct file', () => {
    expect(parseRequest(structuredClone(request))).toEqual(request)
  })

  test('accepts each change kind', () => {
    const kinds = parseRequest(request).edits.map((edit) => edit.change.kind)
    expect(kinds).toEqual(['style', 'textStyle', 'text', 'order', 'remove', 'comment', 'comment'])
  })

  test('accepts a comment on an element and a comment on the screen, with the other kinds', () => {
    const parsed = parseRequest(structuredClone(request)).edits
    expect(parsed[5]).toEqual({ id: 'e6', target, width: 390, change: { kind: 'comment', text: 'Make this a link.' } })
    expect(parsed[6].target).toBeNull()
    expect(parsed[6].change).toEqual({ kind: 'comment', text: 'Add a state for an empty list.\nKeep the title.' })
  })

  test('accepts a comment of the most characters, with spaces at the ends', () => {
    const long = requestWith(5, (edit) => ((edit.change as Record<string, unknown>).text = 'a'.repeat(commentLimit)))
    expect(parseRequest(long).edits[5].change).toEqual({ kind: 'comment', text: 'a'.repeat(commentLimit) })
    const spaces = requestWith(5, (edit) => ((edit.change as Record<string, unknown>).text = '  Make it bold. '))
    expect(parseRequest(spaces).edits[5].change).toEqual({ kind: 'comment', text: '  Make it bold. ' })
  })

  test('rejects a comment with an empty text or with no text', () => {
    for (const value of ['', '  \n\t ', undefined, 3]) {
      const file = requestWith(5, (edit) => ((edit.change as Record<string, unknown>).text = value))
      expect(() => parseRequest(file)).toThrow(/edit 6 "e6".*change.*text/)
    }
  })

  test('rejects a comment of more than the most characters', () => {
    const file = requestWith(6, (edit) => {
      ;(edit.change as Record<string, unknown>).text = 'a'.repeat(commentLimit + 1)
    })
    expect(() => parseRequest(file)).toThrow(new RegExp(`edit 7 "e7".*more than ${commentLimit}`))
  })

  test('rejects the target null for a kind that is not a comment', () => {
    const file = requestWith(4, (edit) => (edit.target = null))
    expect(() => parseRequest(file)).toThrow(/edit 5 "e5".*target null/)
    const missing = requestWith(6, (edit) => delete edit.target)
    expect(() => parseRequest(missing)).toThrow(/edit 7 "e7".*target/)
  })

  test('accepts a file with no edits', () => {
    const empty = { ...request, edits: [] }
    expect(parseRequest(empty)).toEqual(empty)
  })

  test('drops fields that the format does not have', () => {
    const file = requestWith(2, (edit) => (edit.stale = true))
    expect(parseRequest(file).edits[2]).toEqual(edits[2])
  })

  test('rejects a file that is not an object with an edit list', () => {
    expect(() => parseRequest(null)).toThrow(/edit list/)
    expect(() => parseRequest({ ...request, edits: {} })).toThrow(/edit list/)
  })

  test('rejects a wrong version', () => {
    expect(() => parseRequest({ ...request, version: 2 })).toThrow(/version/)
  })

  test('rejects a missing screen or file', () => {
    expect(() => parseRequest({ ...request, screen: '' })).toThrow(/screen/)
    expect(() => parseRequest({ ...request, file: undefined })).toThrow(/file/)
  })

  test('rejects an unknown kind and names the edit', () => {
    const file = requestWith(2, (edit) => ((edit.change as Record<string, unknown>).kind = 'move'))
    expect(() => parseRequest(file)).toThrow(/edit 3 "e3".*kind "move"/)
  })

  test('rejects a missing target field and names the edit and the field', () => {
    for (const field of ['file', 'line', 'column', 'tag', 'origin', 'element', 'copies', 'label']) {
      const file = requestWith(0, (edit) => delete (edit.target as Record<string, unknown>)[field])
      expect(() => parseRequest(file)).toThrow(new RegExp(`edit 1 "e1".*target.*${field}`))
    }
  })

  test('rejects a target with an unknown origin or a label of more than 80 characters', () => {
    const origin = requestWith(1, (edit) => ((edit.target as Record<string, unknown>).origin = 'x'))
    expect(() => parseRequest(origin)).toThrow(/edit 2 "e2".*origin/)
    const label = requestWith(1, (edit) => {
      ;(edit.target as Record<string, unknown>).label = 'a'.repeat(81)
    })
    expect(() => parseRequest(label)).toThrow(/edit 2 "e2".*label/)
  })

  test('rejects a duplicate edit id and names the edit', () => {
    const file = requestWith(3, (edit) => (edit.id = 'e1'))
    expect(() => parseRequest(file)).toThrow(/edit 4 "e1".*duplicate/)
  })

  test('rejects an id with a space or another character that the preview cannot select', () => {
    expect(() => parseRequest(requestWith(1, (edit) => (edit.id = 'a b')))).toThrow(/edit 2 "a b".*id with a character/)
    expect(() => parseRequest(requestWith(1, (edit) => (edit.id = 'a"b')))).toThrow(/edit 2 .*id with a character/)
    expect(parseRequest(requestWith(1, (edit) => (edit.id = 'A-1_b'))).edits[1].id).toBe('A-1_b')
  })

  test('rejects a missing id and names the edit by its place', () => {
    const file = requestWith(1, (edit) => delete edit.id)
    expect(() => parseRequest(file)).toThrow(/edit 2 .*id/)
  })

  test('rejects a reply with an unknown status and names the edit', () => {
    const file = requestWith(4, (edit) => ((edit.reply as Record<string, unknown>).status = 'done'))
    expect(() => parseRequest(file)).toThrow(/edit 5 "e5".*reply.*status "done"/)
  })

  test('rejects a reply with no text', () => {
    const file = requestWith(4, (edit) => ((edit.reply as Record<string, unknown>).text = ''))
    expect(() => parseRequest(file)).toThrow(/edit 5 "e5".*reply.*text/)
  })

  test('rejects a wrong width', () => {
    expect(() => parseRequest(requestWith(0, (edit) => (edit.width = 0)))).toThrow(/"e1".*width/)
    // JSON has no NaN or Infinity: they come from the editor as values.
    for (const width of [-390, Number.NaN, Number.POSITIVE_INFINITY, '390']) {
      const file = requestWith(0, () => {})
      file.edits[0].width = width
      expect(() => parseRequest(file), String(width)).toThrow(/"e1".*width/)
    }
  })

  test('rejects a property two times, an observed value that is not true, and a media that is not a text', () => {
    const twice = requestWith(0, (edit) => ((edit.change as Record<string, unknown>).properties = ['gap', 'gap']))
    expect(() => parseRequest(twice)).toThrow(/"e1".*two times/)
    const observed = requestWith(0, (edit) => ((edit.change as Record<string, Record<string, unknown>>).before.observed = false))
    expect(() => parseRequest(observed)).toThrow(/"e1".*observed/)
    const media = requestWith(0, (edit) => ((edit.change as Record<string, unknown>).media = 600))
    expect(() => parseRequest(media)).toThrow(/"e1".*media/)
  })

  test('rejects an order of fewer than two places, and a position that is not less than the count', () => {
    const one = requestWith(3, (edit) => Object.assign(edit.change as object, { before: 0, after: 0, of: 1 }))
    expect(() => parseRequest(one)).toThrow(/"e4"/)
    const before = requestWith(3, (edit) => Object.assign(edit.change as object, { before: 3, after: 0, of: 3 }))
    expect(() => parseRequest(before)).toThrow(/"e4".*"before" that is not less than "of"/)
  })

  test('rejects a style change with no properties or a wrong value', () => {
    const none = requestWith(0, (edit) => ((edit.change as Record<string, unknown>).properties = []))
    expect(() => parseRequest(none)).toThrow(/"e1".*properties/)
    const value = requestWith(0, (edit) => {
      ;(edit.change as Record<string, unknown>).after = { value: 16 }
    })
    expect(() => parseRequest(value)).toThrow(/"e1".*after.*value/)
    const both = requestWith(0, (edit) => {
      const change = edit.change as Record<string, Record<string, unknown>>
      change.after.observed = true
    })
    expect(() => parseRequest(both)).toThrow(/"e1".*after.*observed/)
  })

  test('rejects a token reference with no id', () => {
    const file = requestWith(1, (edit) => {
      const change = edit.change as Record<string, Record<string, Record<string, unknown>>>
      delete change.after.token.id
    })
    expect(() => parseRequest(file)).toThrow(/"e2".*after.*token.*id/)
  })

  test('rejects an order change with a position out of the count', () => {
    const file = requestWith(3, (edit) => ((edit.change as Record<string, unknown>).after = 3))
    expect(() => parseRequest(file)).toThrow(/"e4".*after/)
    const previewed = requestWith(3, (edit) => {
      delete (edit.change as Record<string, unknown>).previewed
    })
    expect(() => parseRequest(previewed)).toThrow(/"e4".*previewed/)
  })

  test('rejects a text change with no text', () => {
    const file = requestWith(2, (edit) => delete (edit.change as Record<string, unknown>).after)
    expect(() => parseRequest(file)).toThrow(/"e3".*after/)
  })
})

describe('parseRequest of options and keep', () => {
  const tasks: RequestFile = {
    ...request,
    edits: [
      { id: 'o1', target, width: 390, change: { kind: 'options', count: 3, note: 'Fields in two columns' } },
      { id: 'o2', target: null, width: 1440, change: { kind: 'options', count: 2, note: '' } },
      { id: 'k1', target: null, width: 1440, change: { kind: 'keep', option: 'onboarding/welcome-option-2' } },
    ],
  }

  function tasksWith(index: number, change: (edit: Record<string, unknown>) => void) {
    const copy = JSON.parse(JSON.stringify(tasks)) as { edits: Record<string, unknown>[] }
    change(copy.edits[index])
    return copy
  }

  const changeOf = (edit: Record<string, unknown>) => edit.change as Record<string, unknown>

  test('accepts options on an element and on the screen, and a keep', () => {
    expect(parseRequest(structuredClone(tasks))).toEqual(tasks)
  })

  test('the range of the count holds the count at first and the other counts of the list', () => {
    expect(optionCounts.min).toBeLessThanOrEqual(optionCounts.initial)
    expect(optionCounts.initial).toBeLessThanOrEqual(optionCounts.max)
    for (const count of optionCounts.more) {
      expect(count).toBeGreaterThanOrEqual(optionCounts.min)
      expect(count).toBeLessThanOrEqual(optionCounts.max)
      expect(count).not.toBe(optionCounts.initial)
    }
  })

  test('accepts the least and the most count, and a note of the most characters', () => {
    for (const count of [optionCounts.min, optionCounts.max]) {
      const file = tasksWith(0, (edit) => (changeOf(edit).count = count))
      expect(parseRequest(file).edits[0].change).toMatchObject({ count })
    }
    const long = tasksWith(0, (edit) => (changeOf(edit).note = 'a'.repeat(commentLimit)))
    expect(parseRequest(long).edits[0].change).toMatchObject({ note: 'a'.repeat(commentLimit) })
  })

  test('rejects a count out of the range, not whole, or not a number', () => {
    for (const count of [optionCounts.min - 1, optionCounts.max + 1, 2.5, '3', undefined]) {
      const file = tasksWith(0, (edit) => (changeOf(edit).count = count))
      expect(() => parseRequest(file)).toThrow(/edit 1 "o1".*change.*count/)
    }
  })

  test('rejects an options item with no note or a note of more than the most characters', () => {
    const missing = tasksWith(0, (edit) => delete changeOf(edit).note)
    expect(() => parseRequest(missing)).toThrow(/edit 1 "o1".*note/)
    const number = tasksWith(0, (edit) => (changeOf(edit).note = 3))
    expect(() => parseRequest(number)).toThrow(/edit 1 "o1".*note/)
    const long = tasksWith(0, (edit) => (changeOf(edit).note = 'a'.repeat(commentLimit + 1)))
    expect(() => parseRequest(long)).toThrow(new RegExp(`edit 1 "o1".*more than ${commentLimit}`))
  })

  test('rejects a keep with no option or an empty option', () => {
    for (const option of ['', undefined, 2]) {
      const file = tasksWith(2, (edit) => (changeOf(edit).option = option))
      expect(() => parseRequest(file)).toThrow(/edit 3 "k1".*option/)
    }
  })

  test('rejects a keep with a target', () => {
    const file = tasksWith(2, (edit) => (edit.target = JSON.parse(JSON.stringify(target))))
    expect(() => parseRequest(file)).toThrow(/edit 3 "k1".*has a target/)
  })

  test('rejects a second keep: a screen has at most one', () => {
    const file = { ...tasks, edits: [...tasks.edits, { id: 'k2', target: null, width: 1440, change: { kind: 'keep', option: 'onboarding/welcome-option-1' } }] }
    expect(() => parseRequest(file)).toThrow(/edit 4 "k2" is a second keep edit/)
  })

  test('rejects a token code that is not a finite number', () => {
    for (const code of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const file = {
        ...request,
        edits: [{ id: 'e1', target, width: 390, change: { kind: 'style', properties: ['gap'], before: { value: '8px', observed: true }, after: { value: '16px', token: { id: 's', name: 's', code } } } }],
      }
      expect(() => parseRequest(file), String(code)).toThrow(/has no code/)
    }
  })

  test('drops fields that the format does not have', () => {
    const file = tasksWith(2, (edit) => (changeOf(edit).before = 'x'))
    expect(parseRequest(file).edits[2].change).toEqual({ kind: 'keep', option: 'onboarding/welcome-option-2' })
  })

  test('gives the same request after formatRequest and JSON.parse', () => {
    expect(parseRequest(JSON.parse(formatRequest(tasks)))).toEqual(tasks)
  })
})

describe('formatRequest', () => {
  test('writes one stable text with a final line break', () => {
    const text = formatRequest(request)
    expect(text).toBe(formatRequest(structuredClone(request)))
    expect(text.endsWith('}\n')).toBe(true)
  })

  test('writes the fields in a fixed sequence, whatever the sequence of the object', () => {
    const [first] = request.edits
    const reordered = { ...request, edits: [{ change: first.change, width: 390, target, id: 'e1' }] }
    expect(formatRequest(reordered)).toBe(formatRequest({ ...request, edits: [first] }))
  })

  test('gives the same request after parseRequest and JSON.parse', () => {
    expect(parseRequest(JSON.parse(formatRequest(request)))).toEqual(request)
  })

  test('does not write a request that is not correct', () => {
    expect(() => formatRequest({ ...request, edits: [edits[0], edits[0]] })).toThrow(/duplicate/)
  })
})

const issues: IssuesFile = {
  version: 1,
  screen: 'onboarding/welcome',
  file: 'screens/onboarding/welcome.tsx',
  issues: [
    {
      kind: 'no-token',
      target,
      property: 'padding-top',
      value: '24px',
      state: 'equal',
      token: { id: 'spacing.3', name: 'spacing.3', code: 3 },
      set: 'library',
    },
    { kind: 'no-token', target, property: 'gap', value: '13px', state: 'none' },
    { kind: 'override', target, property: 'color', value: 'rgb(255, 0, 0)' },
    { kind: 'not-library', target: { ...target, tag: 'div', origin: 'host', element: 'div' } },
    { kind: 'broken-link', target: { ...target, tag: 'Button', element: 'a' }, href: '#/onboarding/nothing' },
    { kind: 'render-error', text: 'Cannot read properties of undefined' },
    { kind: 'relation', text: 'stateOf: no screen has the id onboarding/nothing' },
  ],
}

function issuesWith(index: number, change: (issue: Record<string, unknown>) => void) {
  const copy = JSON.parse(JSON.stringify(issues)) as { issues: Record<string, unknown>[] }
  change(copy.issues[index])
  return copy
}

describe('parseIssues', () => {
  test('gives the issues of a correct file', () => {
    expect(parseIssues(structuredClone(issues))).toEqual(issues)
  })

  test('rejects a file that is not an object with an issue list', () => {
    expect(() => parseIssues(null)).toThrow(/issue list/)
    expect(() => parseIssues({ ...issues, issues: 'none' })).toThrow(/issue list/)
  })

  test('rejects a wrong version', () => {
    expect(() => parseIssues({ ...issues, version: '1' })).toThrow(/version/)
  })

  test('takes a layout issue with its text, and rejects one with no text', () => {
    const layout = { ...issues, issues: [{ kind: 'layout', text: 'The content is wider than the screen' }] }
    expect(parseIssues(structuredClone(layout)).issues).toEqual(layout.issues)
    expect(() => parseIssues({ ...issues, issues: [{ kind: 'layout' }] })).toThrow(/issue 1 .*text/)
  })

  test('rejects an unknown kind and names the issue by its place', () => {
    const file = issuesWith(2, (issue) => (issue.kind = 'warning'))
    expect(() => parseIssues(file)).toThrow(/issue 3 .*kind "warning"/)
  })

  test('rejects a missing target field and names the issue', () => {
    const file = issuesWith(3, (issue) => delete (issue.target as Record<string, unknown>).tag)
    expect(() => parseIssues(file)).toThrow(/issue 4 .*target.*tag/)
  })

  test('rejects a no-token issue with a wrong state', () => {
    const file = issuesWith(0, (issue) => (issue.state = 'linked'))
    expect(() => parseIssues(file)).toThrow(/issue 1 .*state "linked"/)
  })

  test('keeps `written` of a no-token issue, and rejects a wrong one', () => {
    const file = issuesWith(0, (issue) => (issue.written = true))
    expect(parseIssues(file).issues[0]).toMatchObject({ written: true })
    expect(() => parseIssues(issuesWith(0, (issue) => (issue.written = 'yes')))).toThrow(/issue 1 .*written/)
  })

  test('rejects a no-token issue with a wrong `set`', () => {
    const file = issuesWith(0, (issue) => (issue.set = 'page'))
    expect(() => parseIssues(file)).toThrow(/issue 1 .*set "page"/)
  })

  test('counts each issue as a deviation, but a default of the library', () => {
    expect(issues.issues.map(isDeviation)).toEqual([false, true, true, true, true, true, true])
    expect(deviationCount(issues.issues)).toBe(6)
  })

  test('rejects an override with no property and a render error with no text', () => {
    expect(() => parseIssues(issuesWith(2, (issue) => delete issue.property))).toThrow(
      /issue 3 .*property/,
    )
    expect(() => parseIssues(issuesWith(5, (issue) => (issue.text = '')))).toThrow(/issue 6 .*text/)
  })

  test('gives a broken link with its address', () => {
    expect(parseIssues(structuredClone(issues)).issues[4]).toEqual({
      kind: 'broken-link',
      target: { ...target, tag: 'Button', element: 'a' },
      href: '#/onboarding/nothing',
    })
  })

  test('rejects a broken link with no address, an empty address, or no target', () => {
    expect(() => parseIssues(issuesWith(4, (issue) => delete issue.href))).toThrow(/issue 5 .*href/)
    expect(() => parseIssues(issuesWith(4, (issue) => (issue.href = '')))).toThrow(/issue 5 .*href/)
    expect(() => parseIssues(issuesWith(4, (issue) => delete issue.target))).toThrow(/issue 5 .*target/)
  })

  test('gives a relation issue with its cause and no target', () => {
    expect(parseIssues(structuredClone(issues)).issues[6]).toEqual({
      kind: 'relation',
      text: 'stateOf: no screen has the id onboarding/nothing',
    })
  })

  test('rejects a relation issue with no text or an empty text', () => {
    expect(() => parseIssues(issuesWith(6, (issue) => delete issue.text))).toThrow(/issue 7 .*text/)
    expect(() => parseIssues(issuesWith(6, (issue) => (issue.text = '')))).toThrow(/issue 7 .*text/)
  })
})

describe('formatIssues', () => {
  test('writes one stable text with a final line break', () => {
    const text = formatIssues(issues)
    expect(text).toBe(formatIssues(structuredClone(issues)))
    expect(text.endsWith('}\n')).toBe(true)
  })

  test('gives the same issues after parseIssues and JSON.parse', () => {
    expect(parseIssues(JSON.parse(formatIssues(issues)))).toEqual(issues)
  })
})
