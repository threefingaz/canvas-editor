// The check of the screens: `npm run check`. It reads each screen file with
// the parser, with no browser, and finds what the file itself does against
// the rules of a screen and against the design system:
//
// - `file`: the file cannot be read as a screen (a syntax error, a wrong
//   `meta`);
// - `relation`: `stateOf` or `optionOf` breaks a rule of the list;
// - `broken-link`: a link to a screen address that no screen has;
// - `not-library`: an element that is not from the library (a plain element,
//   or a component of the file or of a different module);
// - `inline-style`: an element with a `style` attribute;
// - `raw-value`: a length or a color as a text literal in an attribute.
//
// A note is not a finding: a screen that no link reaches.
//
// The editor shows the same things in its Issues list, read from the page;
// the check shows what the code says, thus an agent can run it after its work
// and a person before a review. It does not find a value that only the page
// shows (a number of pixels, a value that the code computes).

import { unreached } from '../src/related/links.ts'
import { screenFacts } from './screen-facts.ts'
import { screenList, type ScreenFile } from './screens.ts'

export const findingKinds = ['file', 'relation', 'broken-link', 'not-library', 'inline-style', 'raw-value'] as const

export type FindingKind = (typeof findingKinds)[number]

// `line` and `column` are the place of the element; a finding of the file or
// of its relation has none.
export type Finding = { kind: FindingKind; screen: string; file: string; line?: number; column?: number; text: string }

export type Note = { screen: string; text: string }

export type CheckResult = {
  // The count of the screens that the check read.
  screens: number
  findings: Finding[]
  notes: Note[]
}

export type CheckOptions = {
  // The npm package of the library, or null when no library is connected.
  libraryPackage: string | null
  // The screens to report, as ids or as paths of files; with none, each
  // screen. The links and the relations are always read against the whole
  // list.
  only?: readonly string[]
}

function compare(a: Finding, b: Finding): number {
  return (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0)
}

// The id of a screen from an argument of the command: an id, or the path of
// its file (`screens/onboarding/welcome.tsx`, `./screens/…`, with `\`).
export function screenArgument(argument: string, entries: readonly { id: string; file: string }[]): string | null {
  const text = argument.replaceAll('\\', '/').replace(/^\.\//, '')
  return entries.find((entry) => entry.id === text || entry.file === text)?.id ?? null
}

export function checkScreens(files: readonly ScreenFile[], options: CheckOptions): CheckResult {
  const entries = screenList(files, undefined, undefined, options.libraryPackage)
  const ids = new Set(entries.map((entry) => entry.id))
  const codeOf = new Map(files.map((file) => [file.file.replaceAll('\\', '/'), file.code]))
  const only = options.only && options.only.length > 0 ? new Set(options.only) : null

  const findings: Finding[] = []
  for (const entry of entries) {
    if (only && !only.has(entry.id)) continue
    const base = { screen: entry.id, file: entry.file }
    if (entry.error !== undefined) {
      findings.push({ ...base, kind: 'file', text: entry.error })
      continue
    }
    if (entry.relationError !== undefined) findings.push({ ...base, kind: 'relation', text: entry.relationError })

    const facts = screenFacts(codeOf.get(entry.file) ?? '', entry.file, options.libraryPackage)
    const placed: Finding[] = []
    for (const link of facts.links) {
      if (!ids.has(link.id)) {
        placed.push({ ...base, kind: 'broken-link', line: link.line, column: link.column, text: `${link.tag}: link to ${link.href}, no screen with this id` })
      }
    }
    if (options.libraryPackage !== null) {
      for (const element of facts.elements) {
        if (element.origin === 'library') continue
        const what = element.origin === 'host' ? 'an HTML element' : 'a local component'
        placed.push({ ...base, kind: 'not-library', line: element.line, column: element.column, text: `${element.tag}: ${what}, not from the library` })
      }
    }
    for (const style of facts.styles) {
      placed.push({ ...base, kind: 'inline-style', line: style.line, column: style.column, text: `${style.tag}: a \`style\` attribute` })
    }
    for (const raw of facts.raw) {
      placed.push({ ...base, kind: 'raw-value', line: raw.line, column: raw.column, text: `${raw.tag}: '${raw.text}' in \`${raw.attribute}\`` })
    }
    findings.push(...placed.sort(compare))
  }

  const titles = new Map(entries.map((entry) => [entry.id, entry]))
  const notes = unreached(entries)
    .filter((id) => !only || only.has(id))
    .map((id) => ({ screen: id, text: `${titles.get(id)!.file}: no link leads to this screen` }))

  return { screens: only ? entries.filter((entry) => only.has(entry.id)).length : entries.length, findings, notes }
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

// The text that the command prints: the findings by file, each with its
// place, then the total, then the notes.
export function checkReport(result: CheckResult): string {
  const lines: string[] = []
  const files = [...new Set(result.findings.map((finding) => finding.file))]
  for (const file of files) {
    lines.push(file)
    for (const finding of result.findings.filter((item) => item.file === file)) {
      const place = finding.line === undefined ? '' : `${finding.line}:${finding.column}`
      lines.push(`  ${place.padEnd(7)} ${finding.kind.padEnd(12)} ${finding.text}`)
    }
    lines.push('')
  }
  lines.push(
    result.findings.length === 0
      ? `No finding in ${plural(result.screens, 'screen')}.`
      : `${plural(result.findings.length, 'finding')} in ${files.length} of ${plural(result.screens, 'screen')}.`,
  )
  if (result.notes.length > 0) {
    lines.push('', 'Notes (not findings):')
    for (const note of result.notes) lines.push(`  ${note.text}`)
  }
  return lines.join('\n')
}
