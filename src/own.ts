// The value of `key` in a record by id, or undefined when the record has no
// own property of that name. A screen id can be the name of a property that
// each object has (`constructor`, `toString`): a plain lookup would give the
// function of `Object.prototype`.
export function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined
}
