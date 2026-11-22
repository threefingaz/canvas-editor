// A value that is made at its first read and kept: `make` runs one time at
// the most, and not at all when no one reads the value.
export function once<T>(make: () => T): () => T {
  let made = false
  let value: T
  return () => {
    if (!made) {
      value = make()
      made = true
    }
    return value
  }
}
