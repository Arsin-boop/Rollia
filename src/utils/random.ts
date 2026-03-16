/**
 * Roll dice using standard notation, e.g. "2d6+3", "1d20", "3d4-1".
 * Returns the total result and individual roll values.
 */
export const rollDice = (notation: string): { total: number; rolls: number[]; modifier: number } => {
  const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/)
  if (!match) return { total: 0, rolls: [], modifier: 0 }

  const count = Math.min(Number(match[1]), 100) // safety cap
  const sides = Math.min(Number(match[2]), 100)
  const modifier = Number(match[3] || 0)

  const rolls: number[] = []
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1)
  }

  const total = rolls.reduce((sum, r) => sum + r, 0) + modifier
  return { total, rolls, modifier }
}

/**
 * Roll a single die with the given number of sides.
 */
export const rollSingle = (sides: number): number =>
  Math.floor(Math.random() * sides) + 1

/**
 * Random integer between min and max (inclusive).
 */
export const randomBetween = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min

/**
 * Pick a random element from an array.
 */
export const randomPick = <T>(items: T[]): T | undefined =>
  items.length ? items[Math.floor(Math.random() * items.length)] : undefined

/**
 * Pick a random element using weighted probabilities.
 * `weights` must be the same length as `items`.
 */
export const weightedPick = <T>(items: T[], weights: number[]): T | undefined => {
  if (!items.length || items.length !== weights.length) return undefined

  const totalWeight = weights.reduce((sum, w) => sum + Math.max(0, w), 0)
  if (totalWeight <= 0) return randomPick(items)

  let roll = Math.random() * totalWeight
  for (let i = 0; i < items.length; i++) {
    roll -= Math.max(0, weights[i])
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}

/**
 * Shuffle an array using Fisher-Yates algorithm. Returns a new array.
 */
export const shuffled = <T>(array: T[]): T[] => {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Generate a random string ID.
 */
export const randomId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
