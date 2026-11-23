// The names of a screen id: the flow (the folders of the path) and the file
// name with no extension. The tool (`tools/screen-ops.ts`) and the editor
// (the rename dialog) share these rules, thus the editor refuses the same
// names that the server refuses. It imports nothing: the tools load it with
// no bundler (the module runner of Vite), and the editor bundles it.

// A file name of a screen, and each part of a flow: letters, digits, `-` and
// `_`, with a letter or a digit first.
const namePattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

// Why `name` cannot be the file name of a screen, or null.
export function nameProblem(name: string): string | null {
  return namePattern.test(name)
    ? null
    : `'${name}' is not a valid name: use letters, digits, '-' and '_', with a letter or a digit first`
}

// Why `flow` cannot be a flow, or null. '' is the screens folder itself.
export function flowProblem(flow: string): string | null {
  if (flow === '') return null
  return flow.split('/').every((part) => namePattern.test(part))
    ? null
    : `'${flow}' is not a valid flow: each part of the path uses letters, digits, '-' and '_', with a letter or a digit first`
}

// The id of the screen `name` in `flow`.
export function idOf(flow: string, name: string): string {
  return flow === '' ? name : `${flow}/${name}`
}

// The flow of an id: '' for a screen directly in the screens folder.
export function flowOfId(id: string): string {
  const slash = id.lastIndexOf('/')
  return slash === -1 ? '' : id.slice(0, slash)
}

// The file name of an id, with no extension.
export function nameOfId(id: string): string {
  return id.slice(id.lastIndexOf('/') + 1)
}

// The new name of a state or an option of a renamed base: a name that starts
// with the old name of the base and `-` gets the new name in its place
// (`welcome-option-2` of `welcome` is `hello-option-2` of `hello`); a
// different name stays.
export function memberName(member: string, base: string, next: string): string {
  return member.startsWith(`${base}-`) ? next + member.slice(base.length) : member
}
