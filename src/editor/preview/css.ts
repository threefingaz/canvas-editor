import { textStyleParts, tokenCss, type TextStyle, type Token } from '../../tokens/format.ts'
import { liveItems, sameTarget, type Item, type PreviewEdit } from '../edits/model.ts'
import { hiddenBy, type Hidden } from '../selection/pick.ts'
import { previewTextStyle } from '../tokens/match.ts'

// The attribute that the preview writes on each DOM node of a target, with
// the ids of its edits, separated by spaces.
export const editAttribute = 'data-canvas-edit'

export type PreviewRules = {
  // One CSS rule for each edit that has a rule.
  rules: string[]
  // One text for each edit that has no rule because of a problem; it names
  // the edit.
  problems: string[]
}

// A CSS text in double quotes: a backslash and a quote get a backslash, and a
// control character is written as its hex code.
function cssString(text: string): string {
  let escaped = ''
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (char === '\\' || char === '"') escaped += `\\${char}`
    else if (code < 0x20 || code === 0x7f) escaped += `\\${code.toString(16)} `
    else escaped += char
  }
  return `"${escaped}"`
}

// A property name that cannot end the declaration: lowercase words with
// hyphens.
const propertyName = /^-?[a-z][a-z-]*$/

// A value that could end the declaration or the rule, or hide the rules after
// it: a brace, a semicolon, a backslash, a line break, the start or the end
// of a comment, a quoted text with no end, a bracket or a parenthesis with
// no end (it takes the end of the rule into the value) or with no start, or
// a `!` outside a quoted text (`8px !important`: the rule adds its own, and
// a second one drops the declaration).
const unsafeValue = /[{};\\\n\r\f]|\/\*|\*\//

function unsafe(value: string): boolean {
  if (unsafeValue.test(value)) return true
  // One pass, as the CSS reader goes: a quote of the other kind is text in a
  // quoted text (`"O'Brien"`), and a bracket there does not count.
  const open: string[] = []
  let quote: string | null = null
  for (const char of value) {
    if (quote !== null) {
      if (char === quote) quote = null
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '!') {
      return true
    } else if (char === '(' || char === '[') {
      open.push(char === '(' ? ')' : ']')
    } else if ((char === ')' || char === ']') && open.pop() !== char) {
      return true
    }
  }
  return quote !== null || open.length > 0
}

const kebab: Record<keyof TextStyle, string> = {
  fontFamily: 'font-family',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  lineHeight: 'line-height',
  letterSpacing: 'letter-spacing',
}

type Declarations = [property: string, value: string][]

// The declarations of one edit, or null for an edit with no rule. `problem`
// records why an edit has no rule and gives null.
function declarationsOf(
  edit: PreviewEdit,
  tokens: Map<string, Token>,
  problem: (text: string) => null,
): Declarations | null {
  const change = edit.change
  switch (change.kind) {
    case 'style': {
      let value = change.after.value
      if (change.after.token) {
        const token = tokens.get(change.after.token.id)
        if (!token) return problem(`the token "${change.after.token.id}" is not in the token file`)
        if (token.group === 'textStyle') {
          const properties = change.properties.join(', ')
          return problem(`the token "${token.id}" is a text style, not a value of ${properties}`)
        }
        value = tokenCss(token)
      }
      return change.properties.map((property) => [property, value])
    }
    case 'textStyle': {
      if (!change.after.token) return problem('the text style has no token')
      const token = tokens.get(change.after.token.id)
      if (!token) return problem(`the token "${change.after.token.id}" is not in the token file`)
      if (typeof token.value === 'string') {
        return problem(`the token "${token.id}" is not a text style`)
      }
      // The variable of a text style is a `font` shorthand with no letter
      // spacing.
      if (token.cssVar) {
        return [
          ['font', tokenCss(token)],
          ['letter-spacing', token.value.letterSpacing],
        ]
      }
      // A style with no variable: its five parts (`textStyleMark` adds the id
      // of the style).
      const style = token.value
      return textStyleParts.map((part): [string, string] => [kebab[part], style[part]])
    }
    case 'remove':
      return [['display', 'none']]
    // A text edit and an order edit change the DOM, not the styles.
    case 'text':
    case 'order':
      return null
  }
}

// The mark of a text style edit, written after the check of the
// declarations: the id of a style with no variable as a CSS text, from the
// token file, never from the request. The element keeps its class, thus the
// inspector reads the id (`previewTextStyle`) and shows the previewed style as
// linked. A style with a variable resets the mark, thus a node does not take
// the mark of a previewed parent.
function textStyleMark(edit: PreviewEdit, tokens: Map<string, Token>): [string, string] | null {
  if (edit.change.kind !== 'textStyle' || !edit.change.after.token) return null
  const token = tokens.get(edit.change.after.token.id)
  if (!token) return null
  return [previewTextStyle, token.cssVar ? 'initial' : cssString(token.id)]
}

// The selector of the nodes that a remove edit of the preview hides: one
// attribute selector for each remove edit, by its id. Null when no edit
// removes an element.
export function removedSelector(items: readonly Item[]): string | null {
  const selectors = liveItems(items)
    .filter((item) => item.edit.change.kind === 'remove')
    .map((item) => `[${editAttribute}~=${cssString(item.edit.id)}]`)
  return selectors.length === 0 ? null : selectors.join(', ')
}

// A node that the preview of `items` hides: a removed element or a node in it.
export function hiddenIn(items: readonly Item[]): Hidden {
  return hiddenBy(removedSelector(items))
}

// The CSS rules of the preview of one screen: one rule for each style, text
// style and remove edit, on the nodes that have the id of the edit in
// `data-canvas-edit`. Each declaration is `!important`, thus the place of the
// rules in the frame does not matter. A token is written as the library writes
// it, thus the inspector shows the previewed value as linked.
//
// An item with a reply of the agent or with `stale` gives no rule. A removed
// target gets only its `display: none`.
export function previewRules(items: readonly Item[], tokens: readonly Token[]): PreviewRules {
  const byId = new Map(tokens.map((token) => [token.id, token]))
  const live = liveItems(items)
  const removed = live.filter((item) => item.edit.change.kind === 'remove').map((item) => item.edit.target)
  const rules: string[] = []
  const problems: string[] = []

  for (const { edit } of live) {
    if (edit.change.kind !== 'remove' && removed.some((target) => sameTarget(target, edit.target))) {
      continue
    }
    const problem = (text: string) => {
      problems.push(`edit "${edit.id}": ${text}`)
      return null
    }
    const declarations = declarationsOf(edit, byId, problem)
    if (!declarations) continue
    const bad = declarations.find(([property, value]) => !propertyName.test(property) || unsafe(value))
    if (bad) {
      problem(`the declaration "${bad[0]}: ${bad[1]}" is not a valid CSS declaration`)
      continue
    }
    const mark = textStyleMark(edit, byId)
    if (mark) declarations.push(mark)
    const body = declarations.map(([property, value]) => `${property}: ${value} !important`).join('; ')
    rules.push(`[${editAttribute}~=${cssString(edit.id)}] { ${body} }`)
  }
  return { rules, problems }
}
