/** Common validation utilities used across the bot. */

/** Validate that a string is a valid JID-like identifier. */
export function isValidIdentifier(value: string): boolean {
  return value.length > 0 && !/\s/.test(value);
}

/** Validate that an array is non-empty. */
export function nonEmptyArray<T>(arr: readonly T[]): arr is readonly [T, ...T[]] {
  return arr.length > 0;
}

/** Validate that a number is within range (inclusive). */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}
