import type { Skill } from '../types/skill'

// ── Warrior Techniques ───────────────────────────────────────────────

export const WARRIOR_SKILLS: Skill[] = [
  {
    id: 'skill-power-strike',
    name: 'Power Strike',
    description: 'A devastating overhead blow that sacrifices speed for raw damage.',
    category: 'melee',
    stat: 'STR',
    targetType: 'single',
    mpCost: 2,
    cooldown: 1,
    damageFormula: '2d8+3',
    effects: [{ type: 'damage', value: 12, damageType: 'slashing' }],
    requiredLevel: 1,
    requiredClass: ['warrior'],
    tags: ['melee', 'heavy', 'martial']
  },
  {
    id: 'skill-shield-bash',
    name: 'Shield Bash',
    description: 'Slams the shield into the target, dealing damage and staggering them.',
    category: 'melee',
    stat: 'STR',
    targetType: 'single',
    mpCost: 2,
    cooldown: 2,
    damageFormula: '1d6+2',
    effects: [
      { type: 'damage', value: 5, damageType: 'bludgeoning' },
      { type: 'statusApply', value: 0, statusId: 'stunned', duration: 1 }
    ],
    requiredLevel: 2,
    requiredClass: ['warrior', 'paladin'],
    tags: ['melee', 'stun', 'martial']
  },
  {
    id: 'skill-battle-cry',
    name: 'Battle Cry',
    description: 'A fierce war shout that bolsters resolve and intimidates nearby foes.',
    category: 'support',
    stat: 'CHA',
    targetType: 'self',
    mpCost: 3,
    cooldown: 4,
    effects: [
      { type: 'buff', value: 2, duration: 3, statusId: 'inspired' }
    ],
    requiredLevel: 3,
    requiredClass: ['warrior'],
    tags: ['buff', 'aoe', 'martial']
  }
]

// ── Rogue Techniques ─────────────────────────────────────────────────

export const ROGUE_SKILLS: Skill[] = [
  {
    id: 'skill-backstab',
    name: 'Backstab',
    description: 'Exploits a moment of distraction to land a precise, crippling strike.',
    category: 'melee',
    stat: 'DEX',
    targetType: 'single',
    mpCost: 3,
    cooldown: 2,
    damageFormula: '3d6',
    effects: [{ type: 'damage', value: 10, damageType: 'piercing' }],
    requiredLevel: 1,
    requiredClass: ['rogue'],
    tags: ['melee', 'finesse', 'stealth']
  },
  {
    id: 'skill-evasive-roll',
    name: 'Evasive Roll',
    description: 'A quick tumble that dodges the next incoming attack and repositions.',
    category: 'utility',
    stat: 'DEX',
    targetType: 'self',
    mpCost: 1,
    cooldown: 1,
    effects: [{ type: 'buff', value: 3, duration: 1, statusId: 'dodging' }],
    requiredLevel: 1,
    requiredClass: ['rogue'],
    tags: ['dodge', 'mobility', 'finesse']
  },
  {
    id: 'skill-poisoned-blade',
    name: 'Poisoned Blade',
    description: 'Coats the weapon with a fast-acting toxin. The next hit inflicts lingering poison.',
    category: 'utility',
    stat: 'DEX',
    targetType: 'self',
    mpCost: 2,
    cooldown: 3,
    effects: [
      { type: 'statusApply', value: 0, statusId: 'poisoned', duration: 3 }
    ],
    requiredLevel: 3,
    requiredClass: ['rogue'],
    tags: ['poison', 'buff', 'stealth']
  }
]

// ── Paladin Techniques ───────────────────────────────────────────────

export const PALADIN_SKILLS: Skill[] = [
  {
    id: 'skill-shield-of-dawn',
    name: 'Shield of Dawn',
    description: 'Raises the shield high, bathing it in radiance that deflects attacks and sears the undead.',
    category: 'support',
    stat: 'CHA',
    targetType: 'self',
    mpCost: 3,
    cooldown: 3,
    effects: [{ type: 'buff', value: 3, duration: 2, statusId: 'shielded' }],
    requiredLevel: 2,
    requiredClass: ['paladin'],
    tags: ['defense', 'radiant', 'divine']
  },
  {
    id: 'skill-righteous-cleave',
    name: 'Righteous Cleave',
    description: 'A wide, punishing arc that strikes multiple enemies in melee range.',
    category: 'melee',
    stat: 'STR',
    targetType: 'aoe',
    mpCost: 4,
    cooldown: 2,
    damageFormula: '2d6+2',
    effects: [{ type: 'damage', value: 9, damageType: 'slashing' }],
    requiredLevel: 3,
    requiredClass: ['paladin'],
    tags: ['melee', 'aoe', 'martial']
  }
]

// ── Aggregated ────────────────────────────────────────────────────────

export const ALL_SKILLS: Skill[] = [
  ...WARRIOR_SKILLS,
  ...ROGUE_SKILLS,
  ...PALADIN_SKILLS
]

const skillIndex = new Map(ALL_SKILLS.map(skill => [skill.id, skill]))

export const getSkillById = (id: string): Skill | undefined => skillIndex.get(id)

export const getSkillsByClass = (className: string): Skill[] =>
  ALL_SKILLS.filter(skill =>
    skill.requiredClass?.some(c => c.toLowerCase() === className.toLowerCase())
  )
