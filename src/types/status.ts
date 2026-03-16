import type { DamageType } from './damage'

export type StatusTier = 'minor' | 'moderate' | 'severe'

export type StatusCategory = 'buff' | 'debuff' | 'condition' | 'environmental'

export interface StatusModifier {
  stat: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA' | 'AC' | 'speed' | 'attackBonus'
  value: number // positive = bonus, negative = penalty
}

export interface StatusTick {
  type: 'damage' | 'heal' | 'mpDrain' | 'mpRestore'
  amount: number
  damageType?: DamageType
}

export interface StatusEffectDef {
  id: string
  name: string
  description: string
  category: StatusCategory
  tier: StatusTier
  duration: number // turns, -1 = permanent until cured
  tickEffect?: StatusTick
  modifiers: StatusModifier[]
  canStack: boolean
  maxStacks?: number
  cure?: string // description of how to cure
  icon?: string
  restrictions?: string[] // e.g. ["cannot_cast", "cannot_move"]
}
