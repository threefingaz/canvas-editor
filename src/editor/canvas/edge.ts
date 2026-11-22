// The edge of a frame and its mark, as one `box-shadow`. Each width is in px on
// the screen and is divided by the scale, thus it keeps one size at each zoom.
// The edge is a thin line at the frame, in each state, thus a light screen has
// a border on a light canvas too. One mark at a distance from the frame shows
// its state, with this priority: a kept option, then the target of the last
// link, then the listed frame. The space between the edge and the mark has
// the color of the canvas.

export type FrameMarks = { kept: boolean; marked: boolean; listed: boolean }

export const edgeWidth = 1
export const markWidth = 3
export const markOffset = 4

// The edge is the text color of the theme, faint, thus it shows in the two
// themes.
export const edgeColor = 'color-mix(in oklab, var(--foreground) 18%, transparent)'
export const canvasColor = 'var(--background)'

export const markColor = {
  kept: 'var(--accent)',
  marked: 'var(--link)',
  listed: 'var(--muted-foreground)',
} as const

export type FrameMark = keyof typeof markColor

export function frameMark({ kept, marked, listed }: FrameMarks): FrameMark | null {
  if (kept) return 'kept'
  if (marked) return 'marked'
  if (listed) return 'listed'
  return null
}

export function frameShadow(marks: FrameMarks, scale: number): string {
  const px = (value: number) => `${value / scale}px`
  const edge = `0 0 0 ${px(edgeWidth)} ${edgeColor}`
  const mark = frameMark(marks)
  if (!mark) return edge
  // The first shadow is on top: the edge, then the space, then the mark.
  return [edge, `0 0 0 ${px(markOffset)} ${canvasColor}`, `0 0 0 ${px(markOffset + markWidth)} ${markColor[mark]}`].join(', ')
}
