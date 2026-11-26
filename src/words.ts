// Small helpers of the words of a text, which the editor and the tools share.
// The module imports nothing.

// A count with its word: "1 screen", "3 screens", "2 boxes".
export function counted(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

// The text with its first letter in upper case: "a screen exists" gives
// "A screen exists".
export function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
