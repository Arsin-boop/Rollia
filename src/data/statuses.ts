import type { StatusEffectDef } from '../types/status'

export const STATUS_EFFECTS: StatusEffectDef[] = [
  {
    id: 'poisoned',
    name: 'Poisoned',
    description: 'Toxins course through the body, dealing damage each turn and reducing attack accuracy.',
    category: 'debuff',
    tier: 'moderate',
    duration: 3,
    tickEffect: { type: 'damage', amount: 2, damageType: 'poison' },
    modifiers: [{ stat: 'attackBonus', value: -2 }],
    canStack: false,
    cure: 'Antidote, Lesser Restoration, or a successful CON save (DC 12).',
    icon: '🧪',
    restrictions: []
  },
  {
    id: 'blessed',
    name: 'Blessed',
    description: 'Divine favor enhances attacks and saves. A warm golden glow surrounds you.',
    category: 'buff',
    tier: 'minor',
    duration: 3,
    modifiers: [
      { stat: 'attackBonus', value: 2 },
      { stat: 'WIS', value: 1 }
    ],
    canStack: false,
    icon: '✨'
  },
  {
    id: 'stunned',
    name: 'Stunned',
    description: 'Unable to act or move. Attacks against you have advantage.',
    category: 'condition',
    tier: 'severe',
    duration: 1,
    modifiers: [{ stat: 'AC', value: -4 }],
    canStack: false,
    icon: '💫',
    restrictions: ['cannot_act', 'cannot_move']
  },
  {
    id: 'burning',
    name: 'Burning',
    description: 'Flames lick at skin and cloth. Fire damage each turn until extinguished.',
    category: 'debuff',
    tier: 'moderate',
    duration: 2,
    tickEffect: { type: 'damage', amount: 3, damageType: 'fire' },
    modifiers: [],
    canStack: false,
    cure: 'Spend an action to douse flames, or jump into water.',
    icon: '🔥'
  },
  {
    id: 'frozen',
    name: 'Frozen',
    description: 'Ice encrusts joints and limbs. Movement is halved and dexterity is impaired.',
    category: 'debuff',
    tier: 'moderate',
    duration: 2,
    modifiers: [
      { stat: 'DEX', value: -3 },
      { stat: 'speed', value: -15 }
    ],
    canStack: false,
    cure: 'Warmth, fire damage, or a successful STR save (DC 11).',
    icon: '❄️'
  },
  {
    id: 'frightened',
    name: 'Frightened',
    description: 'Terror grips the heart. Cannot willingly move closer to the source of fear.',
    category: 'condition',
    tier: 'moderate',
    duration: 2,
    modifiers: [{ stat: 'attackBonus', value: -2 }],
    canStack: false,
    cure: 'Move out of line of sight or succeed on a WIS save (DC 13).',
    icon: '😨',
    restrictions: ['cannot_approach_source']
  },
  {
    id: 'invisible',
    name: 'Invisible',
    description: 'Light passes through you. Attacks against you have disadvantage; your attacks have advantage.',
    category: 'buff',
    tier: 'moderate',
    duration: 3,
    modifiers: [
      { stat: 'AC', value: 3 },
      { stat: 'attackBonus', value: 3 }
    ],
    canStack: false,
    cure: 'Attacking, casting a spell, or taking damage breaks invisibility.',
    icon: '👻'
  },
  {
    id: 'hasted',
    name: 'Hasted',
    description: 'Time bends around you. Speed doubles and you gain an extra action.',
    category: 'buff',
    tier: 'severe',
    duration: 3,
    modifiers: [
      { stat: 'speed', value: 30 },
      { stat: 'AC', value: 2 },
      { stat: 'DEX', value: 2 }
    ],
    canStack: false,
    icon: '⚡'
  },
  {
    id: 'exhaustion',
    name: 'Exhaustion',
    description: 'Overwhelming fatigue. Stats are reduced and further exertion risks collapse.',
    category: 'condition',
    tier: 'severe',
    duration: -1, // permanent until rest
    modifiers: [
      { stat: 'STR', value: -2 },
      { stat: 'DEX', value: -2 },
      { stat: 'speed', value: -10 }
    ],
    canStack: true,
    maxStacks: 5,
    cure: 'Long rest removes one level of exhaustion.',
    icon: '😴'
  },
  {
    id: 'regenerating',
    name: 'Regenerating',
    description: 'Wounds knit together steadily. Regains health at the start of each turn.',
    category: 'buff',
    tier: 'minor',
    duration: 4,
    tickEffect: { type: 'heal', amount: 3 },
    modifiers: [],
    canStack: false,
    icon: '💚'
  },
  {
    id: 'shielded',
    name: 'Shielded',
    description: 'A protective aura or barrier deflects incoming blows.',
    category: 'buff',
    tier: 'minor',
    duration: 3,
    modifiers: [{ stat: 'AC', value: 3 }],
    canStack: false,
    icon: '🛡️'
  },
  {
    id: 'hexed',
    name: 'Hexed',
    description: 'A dark curse lingers. Stat penalties and additional damage from the caster.',
    category: 'debuff',
    tier: 'moderate',
    duration: 3,
    tickEffect: { type: 'damage', amount: 1, damageType: 'necrotic' },
    modifiers: [{ stat: 'STR', value: -2 }],
    canStack: false,
    cure: 'Remove Curse, or the caster loses concentration.',
    icon: '🔮'
  },
  {
    id: 'inspired',
    name: 'Inspired',
    description: 'A burst of morale. Attack rolls and saving throws are bolstered.',
    category: 'buff',
    tier: 'minor',
    duration: 3,
    modifiers: [
      { stat: 'attackBonus', value: 2 },
      { stat: 'CHA', value: 1 }
    ],
    canStack: false,
    icon: '🎵'
  },
  {
    id: 'dodging',
    name: 'Dodging',
    description: 'Focused on evasion. Attacks against you have disadvantage until your next turn.',
    category: 'buff',
    tier: 'minor',
    duration: 1,
    modifiers: [{ stat: 'AC', value: 4 }],
    canStack: false,
    icon: '💨'
  }
]

// ── Lookup helpers ───────────────────────────────────────────────────

const statusIndex = new Map(STATUS_EFFECTS.map(s => [s.id, s]))

export const getStatusById = (id: string): StatusEffectDef | undefined => statusIndex.get(id)

export const getStatusesByCategory = (category: StatusEffectDef['category']): StatusEffectDef[] =>
  STATUS_EFFECTS.filter(s => s.category === category)

export const getBuffs = (): StatusEffectDef[] => getStatusesByCategory('buff')
export const getDebuffs = (): StatusEffectDef[] => getStatusesByCategory('debuff')
