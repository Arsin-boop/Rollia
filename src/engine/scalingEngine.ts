import { clamp } from '../utils/math'

// ── Types ────────────────────────────────────────────────────────────

export type DifficultyTier = 'easy' | 'normal' | 'hard' | 'deadly'

export interface EnemyBaseStats {
  hp: number
  ac: number
  attackBonus: number
  damage: string          // dice notation e.g. "1d8+2"
  damageFlat: number      // average damage for scaling
  xpReward: number
}

export interface ScaledEnemyStats extends EnemyBaseStats {
  scaleFactor: number
  playerLevel: number
  tier: DifficultyTier
}

// ── Difficulty Multipliers ───────────────────────────────────────────

const TIER_MULTIPLIERS: Record<DifficultyTier, number> = {
  easy: 0.75,
  normal: 1.0,
  hard: 1.35,
  deadly: 1.8
}

const TIER_XP_MULTIPLIERS: Record<DifficultyTier, number> = {
  easy: 0.5,
  normal: 1.0,
  hard: 1.5,
  deadly: 2.5
}

// ── Scaling Functions ────────────────────────────────────────────────

/**
 * Calculate a scale factor based on player level.
 * Level 1 = 1.0, scales logarithmically so high-level enemies
 * don't become absurd, but are still challenging.
 */
export const getLevelScaleFactor = (playerLevel: number): number => {
  const safeLevel = clamp(playerLevel, 1, 20)
  // Base scaling: linear ramp with diminishing returns at high levels
  return 1 + (safeLevel - 1) * 0.15 + Math.log2(safeLevel) * 0.1
}

/**
 * Scale enemy HP based on player level and difficulty tier.
 */
export const scaleHP = (
  baseHp: number,
  playerLevel: number,
  tier: DifficultyTier = 'normal'
): number => {
  const factor = getLevelScaleFactor(playerLevel) * TIER_MULTIPLIERS[tier]
  return Math.max(1, Math.round(baseHp * factor))
}

/**
 * Scale enemy AC based on player level and tier.
 * AC scales slower than HP to avoid unhittable enemies.
 */
export const scaleAC = (
  baseAC: number,
  playerLevel: number,
  tier: DifficultyTier = 'normal'
): number => {
  const tierBonus = tier === 'deadly' ? 2 : tier === 'hard' ? 1 : 0
  const levelBonus = Math.floor((playerLevel - 1) / 4) // +1 AC every 4 levels
  return baseAC + levelBonus + tierBonus
}

/**
 * Scale enemy attack bonus.
 */
export const scaleAttackBonus = (
  baseBonus: number,
  playerLevel: number,
  tier: DifficultyTier = 'normal'
): number => {
  const tierBonus = tier === 'deadly' ? 2 : tier === 'hard' ? 1 : 0
  const levelBonus = Math.floor((playerLevel - 1) / 3)
  return baseBonus + levelBonus + tierBonus
}

/**
 * Scale flat damage based on player level and tier.
 */
export const scaleDamage = (
  baseDamage: number,
  playerLevel: number,
  tier: DifficultyTier = 'normal'
): number => {
  const factor = getLevelScaleFactor(playerLevel) * TIER_MULTIPLIERS[tier]
  return Math.max(1, Math.round(baseDamage * factor * 0.85)) // slightly lower factor for damage
}

/**
 * Scale all enemy stats at once.
 */
export const scaleEnemyStats = (
  base: EnemyBaseStats,
  playerLevel: number,
  tier: DifficultyTier = 'normal'
): ScaledEnemyStats => {
  return {
    hp: scaleHP(base.hp, playerLevel, tier),
    ac: scaleAC(base.ac, playerLevel, tier),
    attackBonus: scaleAttackBonus(base.attackBonus, playerLevel, tier),
    damage: base.damage, // dice notation stays same; DM describes the hit
    damageFlat: scaleDamage(base.damageFlat, playerLevel, tier),
    xpReward: getXPReward(tier, 1, base.xpReward),
    scaleFactor: getLevelScaleFactor(playerLevel) * TIER_MULTIPLIERS[tier],
    playerLevel,
    tier
  }
}

// ── Encounter Difficulty ─────────────────────────────────────────────

/**
 * XP thresholds per player level for encounter difficulty (D&D 5e DMG).
 * [Easy, Medium, Hard, Deadly]
 */
const XP_THRESHOLDS_BY_LEVEL: number[][] = [
  [25, 50, 75, 100],       // Level 1
  [50, 100, 150, 200],     // Level 2
  [75, 150, 225, 400],     // Level 3
  [125, 250, 375, 500],    // Level 4
  [250, 500, 750, 1100],   // Level 5
  [300, 600, 900, 1400],   // Level 6
  [350, 750, 1100, 1700],  // Level 7
  [450, 900, 1400, 2100],  // Level 8
  [550, 1100, 1600, 2400], // Level 9
  [600, 1200, 1900, 2800], // Level 10
  [800, 1600, 2400, 3600], // Level 11
  [1000, 2000, 3000, 4500],// Level 12
  [1100, 2200, 3400, 5100],// Level 13
  [1250, 2500, 3800, 5700],// Level 14
  [1400, 2800, 4300, 6400],// Level 15
  [1600, 3200, 4800, 7200],// Level 16
  [2000, 3900, 5900, 8800],// Level 17
  [2100, 4200, 6300, 9500],// Level 18
  [2400, 4900, 7300, 10900],// Level 19
  [2800, 5700, 8500, 12700] // Level 20
]

/**
 * Determine encounter difficulty based on player level and total enemy XP.
 */
export const getEncounterDifficulty = (
  playerLevel: number,
  totalEnemyXP: number
): DifficultyTier => {
  const safeLevel = clamp(playerLevel, 1, 20)
  const thresholds = XP_THRESHOLDS_BY_LEVEL[safeLevel - 1]
  if (!thresholds) return 'normal'

  if (totalEnemyXP >= thresholds[3]) return 'deadly'
  if (totalEnemyXP >= thresholds[2]) return 'hard'
  if (totalEnemyXP >= thresholds[1]) return 'normal'
  return 'easy'
}

/**
 * Calculate XP reward for an encounter.
 */
export const getXPReward = (
  tier: DifficultyTier,
  enemyCount: number,
  baseXPPerEnemy: number = 50
): number => {
  const multiplier = TIER_XP_MULTIPLIERS[tier]
  return Math.round(baseXPPerEnemy * enemyCount * multiplier)
}

/**
 * Suggest a CR-appropriate enemy count for a given player level and desired difficulty.
 */
export const suggestEnemyCount = (
  playerLevel: number,
  tier: DifficultyTier = 'normal'
): { minEnemies: number; maxEnemies: number } => {
  const base = tier === 'easy' ? 1 : tier === 'normal' ? 2 : tier === 'hard' ? 3 : 4
  const levelBonus = Math.floor(playerLevel / 5)
  return {
    minEnemies: Math.max(1, base),
    maxEnemies: base + levelBonus + 1
  }
}
