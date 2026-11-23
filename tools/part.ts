// The part of an option: the block that an option of one element is about.
//
// An option is a full screen file. When the user asked for options of one
// element, the file marks that block with a comment whose text is
// `canvas-part`, directly before the JSX element of the block:
// `{/* canvas-part */}` among JSX children, or `/* canvas-part */` before a
// root element. The canvas then shows the frame of the option cropped to that
// block.
//
// The part is the first JSX element whose `<` starts after the end of the
// marker. A fragment has no place in the page, thus it does not count, and
// its first element is the part. This module reads the marker with the parser
// and with no browser; `screenList` in `screens.ts` gives the result to the
// entry of the screen.

import { parseSync, Visitor } from 'vite'
import { fragmentNames, isFragment, position } from './jsx.ts'

// The text of the comment that marks the part of an option.
export const partMarker = 'canvas-part'

// What a screen file says about its part: the count of its markers, and the
// place of the `<` of the part (1-based, as the location of an element), or
// null when the file has no single marker with a JSX element after it.
export type PartFacts = { markers: number; place: { line: number; column: number } | null }

const noPart: PartFacts = { markers: 0, place: null }

// A file with a syntax error has no part: the list reports the error of the
// file.
export function partFacts(code: string, file: string): PartFacts {
  // Most screen files have no marker: no walk of the file for them.
  if (!code.includes(partMarker)) return noPart
  const { program, comments, errors } = parseSync(file, code)
  if (errors.length > 0) return noPart

  const markers = comments.filter((comment) => comment.value.trim() === partMarker)
  if (markers.length !== 1) return { markers: markers.length, place: null }

  const after = markers[0].end
  const fragments = fragmentNames(program)
  let start: number | null = null
  new Visitor({
    JSXOpeningElement(node) {
      if (node.start < after || (start !== null && node.start >= start)) return
      if (isFragment(code.slice(node.name.start, node.name.end), fragments)) return
      start = node.start
    },
  }).visit(program)
  return { markers: 1, place: start === null ? null : position(code, start) }
}

// The part of an entry of the list: `part` is the place of the block as
// `<line>:<column>`, the same numbers as in the location of its element;
// `problem` is the cause when the marker breaks a rule. With no marker, the
// two are undefined: an option of the whole screen, or a screen that is not
// an option. `option` is true for a screen whose relation is a valid
// `optionOf`.
export type PartResult = { part?: string; problem?: string }

export function partOf(facts: PartFacts, option: boolean): PartResult {
  if (facts.markers === 0) return {}
  const name = `\`${partMarker}\``
  if (!option) return { problem: `${name}: the screen is not an option (\`optionOf\`), thus the marker is ignored` }
  if (facts.markers > 1) {
    return { problem: `${name}: the file has ${facts.markers} markers; an option has one, thus the whole screen shows` }
  }
  if (facts.place === null) {
    return { problem: `${name}: no JSX element comes after the marker, thus the whole screen shows` }
  }
  return { part: `${facts.place.line}:${facts.place.column}` }
}
