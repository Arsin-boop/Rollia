/**
 * Clamp a value between min and max (inclusive).
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/**
 * Linear interpolation between a and b by factor t (0..1).
 */
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * clamp(t, 0, 1)

/**
 * D&D 5e ability modifier from ability score.
 * Example: score 14 → modifier +2, score 8 → modifier -1
 */
export const modFromScore = (score: number): number =>
  Math.floor((score - 10) / 2)

/**
 * Calculate the average roll of a dice notation.
 * Supports formats like "2d6", "1d8+3", "3d4-1".
 */
export const diceAverage = (notation: string): number => {
  const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/)
  if (!match) return 0
  const count = Number(match[1])
  const sides = Number(match[2])
  const modifier = Number(match[3] || 0)
  return count * ((sides + 1) / 2) + modifier
}

/**
 * What percentage `value` is of `total`. Returns 0–100.
 */
export const percentOf = (value: number, total: number): number => {
  if (total <= 0) return 0
  return clamp((value / total) * 100, 0, 100)
}

/**
 * Round a number to N decimal places.
 */
export const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Sum an array of numbers.
 */
export const sum = (values: number[]): number =>
  values.reduce((a, b) => a + b, 0)

/**
 * Safely parse an integer from any value, with a fallback.
 */
export const safeInt = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value)
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}
