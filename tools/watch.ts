// The filter of the events of the file watcher of the dev server, which the
// plugins share.

// True for an event of the file watcher of the dev server that adds, changes
// or removes a file; not for the events of a folder.
export function fileEvent(event: string): boolean {
  return event === 'add' || event === 'change' || event === 'unlink'
}
