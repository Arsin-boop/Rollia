import type { InventoryItem } from '../types/character'

// ── Starter Weapons ──────────────────────────────────────────────────

export const STARTER_WEAPONS: InventoryItem[] = [
  {
    id: 'weapon-longsword',
    name: 'Longsword',
    type: 'weapon',
    description: 'A versatile blade balanced for offense and defense. Standard issue for trained fighters.',
    tags: ['equipment', 'weapon', 'martial', 'slashing'],
    damage: '1d10',
    slot: 'weapon',
    equipped: false
  },
  {
    id: 'weapon-arcane-staff',
    name: 'Arcane Staff',
    type: 'weapon',
    description: 'A gnarled staff humming with residual arcane energy. Channels spells with greater focus.',
    tags: ['equipment', 'weapon', 'arcane', 'bludgeoning'],
    damage: '1d6',
    slot: 'weapon',
    equipped: false
  },
  {
    id: 'weapon-warhammer',
    name: 'Blessed Warhammer',
    type: 'weapon',
    description: 'A heavy warhammer etched with divine sigils. Strikes with holy conviction.',
    tags: ['equipment', 'weapon', 'martial', 'bludgeoning', 'radiant'],
    damage: '1d8',
    slot: 'weapon',
    equipped: false
  },
  {
    id: 'weapon-twin-daggers',
    name: 'Twin Daggers',
    type: 'weapon',
    description: 'A pair of slim, blackened daggers. Balanced for throwing or close work.',
    tags: ['equipment', 'weapon', 'finesse', 'piercing'],
    damage: '2d4',
    slot: 'weapon',
    equipped: false
  },
  {
    id: 'weapon-sacred-mace',
    name: 'Sacred Mace',
    type: 'weapon',
    description: 'A silver-headed mace consecrated at the shrine. Channels divine energy on impact.',
    tags: ['equipment', 'weapon', 'simple', 'bludgeoning', 'radiant'],
    damage: '1d6',
    slot: 'weapon',
    equipped: false
  },
  {
    id: 'weapon-pact-blade',
    name: 'Pact Blade',
    type: 'weapon',
    description: 'A shadowy blade that flickers between solid and spectral. Forged from a patron\'s gift.',
    tags: ['equipment', 'weapon', 'pact', 'necrotic'],
    damage: '1d8',
    slot: 'weapon',
    equipped: false
  }
]

// ── Starter Armor ────────────────────────────────────────────────────

export const STARTER_ARMOR: InventoryItem[] = [
  {
    id: 'armor-chain-mail',
    name: 'Chain Mail',
    type: 'armor',
    description: 'Interlocking metal rings layered over padding. Heavy but reliable protection.',
    tags: ['equipment', 'armor', 'heavy'],
    armorClass: 16,
    slot: 'armor',
    equipped: false
  },
  {
    id: 'armor-mage-robes',
    name: 'Enchanted Robes',
    type: 'armor',
    description: 'Silk robes threaded with protective wards. Light enough to avoid interference with spellcasting.',
    tags: ['equipment', 'armor', 'light', 'arcane'],
    armorClass: 12,
    slot: 'armor',
    equipped: false
  },
  {
    id: 'armor-plate-mail',
    name: 'Plate Mail',
    type: 'armor',
    description: 'Full plate armor polished to a mirror sheen. Maximum protection for those sworn to serve.',
    tags: ['equipment', 'armor', 'heavy'],
    armorClass: 18,
    slot: 'armor',
    equipped: false
  },
  {
    id: 'armor-leather',
    name: 'Studded Leather',
    type: 'armor',
    description: 'Supple leather reinforced with rivets. Offers protection without sacrificing agility.',
    tags: ['equipment', 'armor', 'light'],
    armorClass: 13,
    slot: 'armor',
    equipped: false
  },
  {
    id: 'armor-vestments',
    name: 'Divine Vestments',
    type: 'armor',
    description: 'Layered white vestments blessed by temple elders. Offers moderate protection and spiritual focus.',
    tags: ['equipment', 'armor', 'medium', 'divine'],
    armorClass: 14,
    slot: 'armor',
    equipped: false
  },
  {
    id: 'armor-shadow-cloak',
    name: 'Shadow Cloak',
    type: 'armor',
    description: 'A dark cloak that seems to absorb light. Grants minor protection and aids in deception.',
    tags: ['equipment', 'armor', 'light', 'pact'],
    armorClass: 13,
    slot: 'armor',
    equipped: false
  }
]

// ── Consumables ──────────────────────────────────────────────────────

export const CONSUMABLE_ITEMS: InventoryItem[] = [
  {
    id: 'consumable-health-potion',
    name: 'Health Potion',
    type: 'consumable',
    description: 'A ruby-red liquid that mends wounds on contact. Standard adventurer supply.',
    tags: ['consumable', 'healing'],
    consumable: true,
    effects: { hp: 8 },
    charges: 1
  },
  {
    id: 'consumable-greater-health-potion',
    name: 'Greater Health Potion',
    type: 'consumable',
    description: 'A concentrated draught of restoration. Heals deep wounds and mends broken bones.',
    tags: ['consumable', 'healing'],
    consumable: true,
    effects: { hp: 16 },
    charges: 1
  },
  {
    id: 'consumable-mana-potion',
    name: 'Mana Potion',
    type: 'consumable',
    description: 'A shimmering azure liquid that replenishes magical reserves.',
    tags: ['consumable', 'arcane'],
    consumable: true,
    effects: { mp: 8 },
    charges: 1
  },
  {
    id: 'consumable-greater-mana-potion',
    name: 'Greater Mana Potion',
    type: 'consumable',
    description: 'A deep cobalt elixir of concentrated arcane essence.',
    tags: ['consumable', 'arcane'],
    consumable: true,
    effects: { mp: 16 },
    charges: 1
  },
  {
    id: 'consumable-antidote',
    name: 'Antidote',
    type: 'consumable',
    description: 'A bitter herbal remedy that neutralizes most common poisons.',
    tags: ['consumable', 'remedy'],
    consumable: true,
    effects: { hp: 2 },
    charges: 1
  },
  {
    id: 'consumable-ration',
    name: 'Trail Rations',
    type: 'consumable',
    description: 'Dried meat, hardtack, and nuts. Enough to sustain one person for a day.',
    tags: ['consumable', 'food'],
    consumable: true,
    effects: { hp: 2 },
    charges: 3
  }
]

// ── Miscellaneous Items ──────────────────────────────────────────────

export const MISC_ITEMS: InventoryItem[] = [
  {
    id: 'misc-torch',
    name: 'Torch',
    type: 'misc',
    description: 'A pitch-soaked wooden torch. Burns for about one hour.',
    tags: ['misc', 'light'],
    charges: 3
  },
  {
    id: 'misc-rope',
    name: 'Hempen Rope (50 ft)',
    type: 'misc',
    description: 'Fifty feet of sturdy hemp rope. Essential for climbing and binding.',
    tags: ['misc', 'utility']
  },
  {
    id: 'misc-lockpicks',
    name: 'Thieves\' Tools',
    type: 'misc',
    description: 'A leather case containing lockpicks, a small file, pliers, and a mirror on a handle.',
    tags: ['misc', 'tool', 'rogue']
  },
  {
    id: 'misc-holy-symbol',
    name: 'Holy Symbol',
    type: 'misc',
    description: 'A sacred emblem worn at the neck. Required for channeling divine magic.',
    tags: ['misc', 'divine', 'focus']
  },
  {
    id: 'misc-spellbook',
    name: 'Spellbook',
    type: 'misc',
    description: 'A leather-bound tome filled with arcane formulae and notes.',
    tags: ['misc', 'arcane', 'focus']
  },
  {
    id: 'misc-bedroll',
    name: 'Bedroll',
    type: 'misc',
    description: 'A rolled canvas sleeping bag. Offers comfort during long rests.',
    tags: ['misc', 'camping']
  }
]

// ── Class Starter Kits ───────────────────────────────────────────────

export type ClassName = 'warrior' | 'mage' | 'paladin' | 'rogue' | 'cleric' | 'warlock'

export const CLASS_STARTER_ITEMS: Record<ClassName, string[]> = {
  warrior: ['weapon-longsword', 'armor-chain-mail', 'consumable-health-potion', 'misc-rope'],
  mage: ['weapon-arcane-staff', 'armor-mage-robes', 'consumable-mana-potion', 'misc-spellbook'],
  paladin: ['weapon-warhammer', 'armor-plate-mail', 'consumable-health-potion', 'misc-holy-symbol'],
  rogue: ['weapon-twin-daggers', 'armor-leather', 'consumable-health-potion', 'misc-lockpicks'],
  cleric: ['weapon-sacred-mace', 'armor-vestments', 'consumable-health-potion', 'misc-holy-symbol'],
  warlock: ['weapon-pact-blade', 'armor-shadow-cloak', 'consumable-mana-potion', 'misc-torch']
}

// ── Lookup Helpers ───────────────────────────────────────────────────

const ALL_ITEMS: InventoryItem[] = [
  ...STARTER_WEAPONS,
  ...STARTER_ARMOR,
  ...CONSUMABLE_ITEMS,
  ...MISC_ITEMS
]

const itemIndex = new Map(ALL_ITEMS.map(item => [item.id, item]))

export const getItemById = (id: string): InventoryItem | undefined => itemIndex.get(id)

export const getStarterKit = (className: ClassName): InventoryItem[] => {
  const ids = CLASS_STARTER_ITEMS[className] || []
  return ids.map(id => getItemById(id)).filter((item): item is InventoryItem => !!item)
}

export { ALL_ITEMS }
