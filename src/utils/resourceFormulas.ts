const toFiniteNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const toSafeLevel = (value: unknown): number => Math.max(1, Math.floor(toFiniteNumber(value, 1)))

const toSafeStat = (value: unknown, fallback: number): number => Math.max(1, Math.floor(toFiniteNumber(value, fallback)))

export const calculateHp = (level: unknown, constitution: unknown): number => {
  const safeLevel = toSafeLevel(level)
  const safeCon = toSafeStat(constitution, 10)
  return Math.max(1, 8 * safeLevel + 2 * safeCon)
}

export const calculateMp = (level: unknown, intelligence: unknown): number => {
  const safeLevel = toSafeLevel(level)
  const safeInt = toSafeStat(intelligence, 10)
  return Math.max(1, 5 * safeLevel + 3 * safeInt)
}
