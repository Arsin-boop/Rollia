import type { DamageType } from './damage'

export type SkillCategory = 'melee' | 'ranged' | 'support' | 'utility'

export type SkillTargetType = 'single' | 'self' | 'aoe' | 'ally'

export interface SkillEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'statusApply' | 'statusRemove'
  value: number
  duration?: number // turns
  statusId?: string
  damageType?: DamageType
}

export interface Skill {
  id: string
  name: string
  description: string
  category: SkillCategory
  stat: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'
  targetType: SkillTargetType
  mpCost: number
  cooldown: number // turns
  damageFormula?: string // e.g. "2d6+3"
  effects: SkillEffect[]
  requiredLevel?: number
  requiredClass?: string[]
  tags?: string[]
}
