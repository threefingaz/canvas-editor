import { useSyncExternalStore } from 'react'

// The errors of the files of the work folder, by key, for the toolbar. Each
// kind of error has its own keys: the load and the save of a request file
// (`requests:<screen id>`, `sync.ts`), the save of an issues file
// (`issues:<screen id>`, `sync.ts`), and the reading of the Issues list of a
// screen (`collect:<screen id>`, `issues/collect.ts`).

// Sets the error text of a key, or clears it with null.
export type ReportError = (key: string, error: string | null) => void

// One list of errors by key. `publish` gets the list after each change.
export function createErrorList(publish: (errors: ReadonlyMap<string, string>) => void): ReportError {
  const errors = new Map<string, string>()
  return (key, error) => {
    if (error === null ? !errors.has(key) : errors.get(key) === error) return
    if (error === null) errors.delete(key)
    else errors.set(key, error)
    publish(new Map(errors))
  }
}

export type FileErrorsStore = {
  // The same map until an error changes.
  errors: () => ReadonlyMap<string, string>
  report: ReportError
  subscribe: (listener: () => void) => () => void
}

export function createFileErrorsStore(): FileErrorsStore {
  let errors: ReadonlyMap<string, string> = new Map()
  const listeners = new Set<() => void>()
  return {
    errors: () => errors,
    report: createErrorList((next) => {
      errors = next
      for (const listener of listeners) listener()
    }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// The file errors of the editor.
export const fileErrors = createFileErrorsStore()

export function useFileErrors(): ReadonlyMap<string, string> {
  return useSyncExternalStore(fileErrors.subscribe, fileErrors.errors, fileErrors.errors)
}
