export interface CharacterStats {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}

export interface InventoryItem {
  id: string
  name: string
  type?: 'weapon' | 'armor' | 'consumable' | 'misc'
  damage?: string
  armorClass?: number
  description: string
  tags: string[]
  equipped?: boolean
  slot?: 'weapon' | 'armor' | 'equipment'
  consumable?: boolean
  effects?: {
    hp?: number
    mp?: number
  }
  charges?: number
}

export interface EquipmentSlots {
  rightHand?: InventoryItem
  leftHand?: InventoryItem
  body?: InventoryItem
  head?: InventoryItem
}

export interface Character {
  id: string
  name: string
  class: string
  backstory: string
  appearance: string
  stats: CharacterStats
  hitDie: string
  proficiencies: string[]
  features: string[]
  equipment: EquipmentSlots
  inventory: InventoryItem[]
}
