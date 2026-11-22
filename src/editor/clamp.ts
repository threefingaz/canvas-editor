// `value` in the range from `min` to `max`; `min` when the range is empty.
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}
