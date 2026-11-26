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

// The folders of a flow, from the screens folder down: `a`, `a/b` and `a/b/c`
// for `a/b/c`; none for ''.
function foldersOf(flow: string): string[] {
  if (flow === '') return []
  const parts = flow.split('/')
  return parts.map((_, index) => parts.slice(0, index + 1).join('/'))
}

// The new name of a state or an option of a renamed base: a name that starts
// with the old name of the base and `-` gets the new name in its place
// (`welcome-option-2` of `welcome` is `hello-option-2` of `hello`); a
// different name stays.
export function memberName(member: string, base: string, next: string): string {
  return member.startsWith(`${base}-`) ? next + member.slice(base.length) : member
}

// Why a rename that gives the moved screens the new ids of `moved` (old id,
// new id) cannot run, next to the screens of `ids`: a flow or an id that
// differs from one that exists only in its case is the same file on a file
// system that ignores the case (macOS, Windows), with a different id in the
// links and the request files; so is a folder above a nested flow
// (`Onboarding/forms` next to `onboarding/welcome`). A screen may change only the case of its own
// id. An empty list when it can run.
export function renameClashes(ids: readonly string[], moved: readonly (readonly [string, string])[], flow: string): string[] {
  const clashes: string[] = []
  const flows = new Set(ids.map(flowOfId))
  // Each folder of a flow, also the folders above it (`a` and `a/b` of
  // `a/b/c`): a nested flow is in each of them.
  const folders = new Set([...flows].flatMap(foldersOf))
  for (const folder of foldersOf(flow)) {
    const other = [...folders].find((each) => each !== folder && each.toLowerCase() === folder.toLowerCase())
    if (other === undefined) continue
    const what = flows.has(other) ? `the flow '${other}'` : `the folder '${other}' of a flow`
    clashes.push(`${what} exists; a flow name that differs only in its case is the same folder on some file systems`)
    break
  }
  // Each id of a folded name: on a file system that keeps the case apart,
  // two screens can differ only in it.
  const existing = new Map<string, string[]>()
  for (const id of ids) existing.set(id.toLowerCase(), [...(existing.get(id.toLowerCase()) ?? []), id])
  const targets = new Set<string>()
  for (const [from, next] of moved) {
    const other = existing.get(next.toLowerCase())?.find((id) => id !== from)
    if (other !== undefined) clashes.push(`a screen with the id '${other}' exists`)
    else if (targets.has(next.toLowerCase())) clashes.push(`two screens would get the id '${next}'`)
    targets.add(next.toLowerCase())
  }
  return clashes
}
