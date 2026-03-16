import type { InventoryItem } from './character'
import type { CustomClassResponse, ChatMessage, StatusEffect } from '../utils/api'

export type Message = {
  id: string
  type: 'player' | 'dm' | 'system'
  content: string
  timestamp: Date
  sceneHeader?: string
  diceRoll?: {
    type: string
    result: number
    rolls: number[]
  }
  roll?: RollState
}

export type NPCRegistryEntry = {
  id: string
  name: string
  dialogueColorId: string
}

export type NPCPaletteEntry = {
  id: string
  color: string
  glow?: string
}

export type Stat = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'

export type SkillCheckRequest = {
  stat: Stat
  label: string
  dc?: number
  kind?: string
}

export type RollState =
  | { status: 'idle' }
  | { status: 'pending'; request: SkillCheckRequest }
  | { status: 'rolling'; request: SkillCheckRequest; seed: string; startedAt: number }
  | {
      status: 'done'
      request: SkillCheckRequest
      d20: number
      bonus: number
      statBonus: number
      proficiencyBonus: number
      total: number
      success: boolean
      resolvedAt: number
    }

export type SidebarSection = 'journal' | 'stats' | 'loadout' | 'social'
export type LoadoutTab = 'inventory' | 'spells'

export type QuestStatus = 'active' | 'completed' | 'failed'

export type Quest = {
  id: string
  title: string
  description: string
  xp: number
  status: QuestStatus
  progress?: string
  objectives?: string[]
  log: string[]
  objectiveStatus?: boolean[]
}

export type Rumor = {
  id: string
  title: string
  detail: string
  log?: string[]
}

export type NPCRelation = {
  id: string
  name: string
  affinity: number
  notes: string[]
}

export type CharacterAbility = {
  id: string
  name: string
  description: string
  unlockLevel: number
  requiresEquipment?: string[]
  requiresArtifact?: string[]
  type?: 'spell' | 'skill'
}

export type StoredCharacterProfile = {
  id?: string
  name: string
  class: string
  classDescription?: string
  customClassData?: CustomClassResponse | null
  backstory?: string
  backstorySummary?: string
  appearance?: string
  isCustomClass?: boolean
  xp?: number
  level?: number
  quests?: Quest[]
  rumors?: Rumor[]
  equipment?: string[]
  inventoryItems?: InventoryItem[]
  artifacts?: string[]
  abilities?: CharacterAbility[]
  abilityDeck?: CharacterAbility[]
  statusEffects?: StatusEffect[]
  sceneId?: number
  npcRelations?: NPCRelation[]
  systemNotices?: string[]
  spellCooldowns?: Record<string, number>
  resources?: {
    hp: number
    mp: number
  }
  avatarUrl?: string | null
  avatarStatus?: 'pending' | 'ready' | 'failed'
  activeCampaignId?: string | null
  updatedAt?: string
}

export type PersistedCampaignState = {
  messages: Array<{
    id: string
    type: 'player' | 'dm' | 'system'
    content: string
    timestamp: string
    sceneHeader?: string
    diceRoll?: {
      type: string
      result: number
      rolls: number[]
    }
  }>
  chatHistory: ChatMessage[]
  sceneSummary?: string
}
