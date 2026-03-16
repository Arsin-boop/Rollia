import type { Skill } from '../types/skill'

// ── Mage Spells ──────────────────────────────────────────────────────

export const MAGE_SPELLS: Skill[] = [
  {
    id: 'spell-fireball',
    name: 'Fireball',
    description: 'Hurls a ball of flame that detonates on impact, scorching everything in a wide radius.',
    category: 'ranged',
    stat: 'INT',
    targetType: 'aoe',
    mpCost: 6,
    cooldown: 2,
    damageFormula: '3d6',
    effects: [{ type: 'damage', value: 10, damageType: 'fire' }],
    requiredLevel: 3,
    requiredClass: ['mage'],
    tags: ['fire', 'aoe', 'evocation']
  },
  {
    id: 'spell-frost-lance',
    name: 'Frost Lance',
    description: 'A shard of pure cold streaks toward a single target, slowing their movements.',
    category: 'ranged',
    stat: 'INT',
    targetType: 'single',
    mpCost: 3,
    cooldown: 1,
    damageFormula: '2d6',
    effects: [
      { type: 'damage', value: 7, damageType: 'cold' },
      { type: 'statusApply', value: 0, statusId: 'frozen', duration: 1 }
    ],
    requiredLevel: 1,
    requiredClass: ['mage'],
    tags: ['cold', 'single', 'evocation']
  },
  {
    id: 'spell-arcane-shield',
    name: 'Arcane Shield',
    description: 'A shimmering barrier of force wraps around the caster, deflecting incoming strikes.',
    category: 'support',
    stat: 'INT',
    targetType: 'self',
    mpCost: 4,
    cooldown: 3,
    effects: [{ type: 'buff', value: 3, duration: 3, statusId: 'shielded' }],
    requiredLevel: 1,
    requiredClass: ['mage'],
    tags: ['force', 'defense', 'abjuration']
  },
  {
    id: 'spell-chain-lightning',
    name: 'Chain Lightning',
    description: 'A bolt of electricity arcs from the caster\'s hand, jumping between nearby enemies.',
    category: 'ranged',
    stat: 'INT',
    targetType: 'aoe',
    mpCost: 8,
    cooldown: 3,
    damageFormula: '4d6',
    effects: [{ type: 'damage', value: 14, damageType: 'lightning' }],
    requiredLevel: 5,
    requiredClass: ['mage'],
    tags: ['lightning', 'aoe', 'evocation']
  }
]

// ── Cleric Spells ────────────────────────────────────────────────────

export const CLERIC_SPELLS: Skill[] = [
  {
    id: 'spell-healing-word',
    name: 'Healing Word',
    description: 'A whispered prayer that mends wounds with warm golden light.',
    category: 'support',
    stat: 'WIS',
    targetType: 'ally',
    mpCost: 3,
    cooldown: 1,
    effects: [{ type: 'heal', value: 8 }],
    requiredLevel: 1,
    requiredClass: ['cleric'],
    tags: ['healing', 'divine']
  },
  {
    id: 'spell-sacred-flame',
    name: 'Sacred Flame',
    description: 'A pillar of divine radiance descends on the target. There is no dodging the light.',
    category: 'ranged',
    stat: 'WIS',
    targetType: 'single',
    mpCost: 2,
    cooldown: 0,
    damageFormula: '1d8',
    effects: [{ type: 'damage', value: 5, damageType: 'radiant' }],
    requiredLevel: 1,
    requiredClass: ['cleric'],
    tags: ['radiant', 'cantrip', 'divine']
  },
  {
    id: 'spell-bless',
    name: 'Bless',
    description: 'Divine favor flows into allies, sharpening their aim and resolve.',
    category: 'support',
    stat: 'WIS',
    targetType: 'ally',
    mpCost: 4,
    cooldown: 3,
    effects: [{ type: 'buff', value: 2, duration: 3, statusId: 'blessed' }],
    requiredLevel: 1,
    requiredClass: ['cleric', 'paladin'],
    tags: ['buff', 'divine', 'enchantment']
  },
  {
    id: 'spell-mass-heal',
    name: 'Mass Heal',
    description: 'A wave of restorative energy washes over all nearby allies, knitting flesh and spirit.',
    category: 'support',
    stat: 'WIS',
    targetType: 'aoe',
    mpCost: 10,
    cooldown: 4,
    effects: [{ type: 'heal', value: 14 }],
    requiredLevel: 7,
    requiredClass: ['cleric'],
    tags: ['healing', 'aoe', 'divine']
  }
]

// ── Warlock Spells ───────────────────────────────────────────────────

export const WARLOCK_SPELLS: Skill[] = [
  {
    id: 'spell-eldritch-blast',
    name: 'Eldritch Blast',
    description: 'A crackling beam of otherworldly force streaks toward the target.',
    category: 'ranged',
    stat: 'CHA',
    targetType: 'single',
    mpCost: 0,
    cooldown: 0,
    damageFormula: '1d10',
    effects: [{ type: 'damage', value: 6, damageType: 'force' }],
    requiredLevel: 1,
    requiredClass: ['warlock'],
    tags: ['force', 'cantrip', 'pact']
  },
  {
    id: 'spell-hex',
    name: 'Hex',
    description: 'A dark curse clings to the target, weakening them and amplifying damage dealt to them.',
    category: 'ranged',
    stat: 'CHA',
    targetType: 'single',
    mpCost: 3,
    cooldown: 2,
    effects: [
      { type: 'debuff', value: -2, duration: 3, statusId: 'hexed' },
      { type: 'damage', value: 3, damageType: 'necrotic' }
    ],
    requiredLevel: 1,
    requiredClass: ['warlock'],
    tags: ['necrotic', 'curse', 'enchantment']
  },
  {
    id: 'spell-hunger-of-hadar',
    name: 'Hunger of Hadar',
    description: 'A sphere of absolute darkness and cold opens, gnawing at everything within.',
    category: 'ranged',
    stat: 'CHA',
    targetType: 'aoe',
    mpCost: 6,
    cooldown: 3,
    damageFormula: '2d6',
    effects: [
      { type: 'damage', value: 7, damageType: 'cold' },
      { type: 'statusApply', value: 0, statusId: 'frightened', duration: 1 }
    ],
    requiredLevel: 5,
    requiredClass: ['warlock'],
    tags: ['cold', 'aoe', 'conjuration']
  },
  {
    id: 'spell-dark-pact-heal',
    name: 'Life Tap',
    description: 'Sacrifice a fragment of vitality to refuel arcane reserves. A warlock\'s currency.',
    category: 'utility',
    stat: 'CHA',
    targetType: 'self',
    mpCost: 0,
    cooldown: 2,
    effects: [
      { type: 'damage', value: 4, damageType: 'necrotic' },
      { type: 'heal', value: 0 } // special: restores MP instead
    ],
    requiredLevel: 3,
    requiredClass: ['warlock'],
    tags: ['necrotic', 'self', 'pact']
  }
]

// ── Paladin Spells ───────────────────────────────────────────────────

export const PALADIN_SPELLS: Skill[] = [
  {
    id: 'spell-divine-smite',
    name: 'Divine Smite',
    description: 'Channels divine wrath through the weapon, adding radiant energy to a melee strike.',
    category: 'melee',
    stat: 'CHA',
    targetType: 'single',
    mpCost: 4,
    cooldown: 1,
    damageFormula: '2d8',
    effects: [{ type: 'damage', value: 9, damageType: 'radiant' }],
    requiredLevel: 2,
    requiredClass: ['paladin'],
    tags: ['radiant', 'melee', 'divine']
  },
  {
    id: 'spell-lay-on-hands',
    name: 'Lay on Hands',
    description: 'Places hands on a creature, channeling pure restorative energy directly into their body.',
    category: 'support',
    stat: 'CHA',
    targetType: 'ally',
    mpCost: 5,
    cooldown: 3,
    effects: [{ type: 'heal', value: 12 }],
    requiredLevel: 1,
    requiredClass: ['paladin'],
    tags: ['healing', 'divine', 'touch']
  },
  {
    id: 'spell-shield-of-faith',
    name: 'Shield of Faith',
    description: 'A golden aura surrounds the target, deflecting incoming blows.',
    category: 'support',
    stat: 'CHA',
    targetType: 'ally',
    mpCost: 3,
    cooldown: 2,
    effects: [{ type: 'buff', value: 2, duration: 3, statusId: 'shielded' }],
    requiredLevel: 1,
    requiredClass: ['paladin'],
    tags: ['defense', 'divine', 'abjuration']
  }
]

// ── Aggregated ────────────────────────────────────────────────────────

export const ALL_SPELLS: Skill[] = [
  ...MAGE_SPELLS,
  ...CLERIC_SPELLS,
  ...WARLOCK_SPELLS,
  ...PALADIN_SPELLS
]

const spellIndex = new Map(ALL_SPELLS.map(spell => [spell.id, spell]))

export const getSpellById = (id: string): Skill | undefined => spellIndex.get(id)

export const getSpellsByClass = (className: string): Skill[] =>
  ALL_SPELLS.filter(spell =>
    spell.requiredClass?.some(c => c.toLowerCase() === className.toLowerCase())
  )

export const getSpellsByLevel = (maxLevel: number): Skill[] =>
  ALL_SPELLS.filter(spell => (spell.requiredLevel ?? 1) <= maxLevel)
