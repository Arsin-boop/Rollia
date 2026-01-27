
import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import {
  BookOpen,
  User,
  Package,
  Users,
  Book,
  Sparkles,
  Send,
  MessageCircle
} from 'lucide-react'
import {
  API_ORIGIN,
  getDMResponse,
  generateQuestFromBackstory,
  summarizeScene,
  summarizeBackstory,
  getStatusUpdate,
  rollD20,
  startBattle,
  actBattle,
  getBattleState,
  type CustomClassResponse,
  type DMResponse,
  type ChatMessage,
  type StatusEffect,
  type StatusUpdatePayload,
  type StatusStateInput,
  type CombatState,
  type CombatEvent,
  type ActionIntent
} from '../utils/api'
import './GameSession.css'

type Message = {
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

type NPCRegistryEntry = {
  id: string
  name: string
  dialogueColorId: string
}

type NPCPaletteEntry = {
  id: string
  color: string
  glow?: string
}

type Stat = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'

type SkillCheckRequest = {
  stat: Stat
  label: string
  dc?: number
  kind?: string
}

type RollState =
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

type SidebarSection = 'quests' | 'rumors' | 'stats' | 'inventory' | 'npcs' | 'spells' | 'boons'

type QuestStatus = 'active' | 'completed' | 'failed'

type Quest = {
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

type Rumor = {
  id: string
  title: string
  detail: string
  log?: string[]
}

type NPCRelation = {
  id: string
  name: string
  affinity: number
  notes: string[]
}

type InventoryItem = {
  id: string
  name: string
  description: string
  tags: string[]
  consumable?: boolean
  effects?: {
    hp?: number
    mp?: number
  }
  charges?: number
}



type CharacterAbility = {
  id: string
  name: string
  description: string
  unlockLevel: number
  requiresEquipment?: string[]
  requiresArtifact?: string[]
  type?: 'spell' | 'skill'
}

type StoredCharacterProfile = {
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
}

const DEFAULT_STATS = {
  strength: 10,
  dexterity: 14,
  constitution: 12,
  intelligence: 13,
  wisdom: 15,
  charisma: 11
}

const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500,
  14000, 23000, 34000, 48000,
  64000, 85000, 100000, 120000,
  140000, 165000, 195000, 225000,
  265000, 305000, 355000
]

const CHARACTER_STORAGE_KEY = 'dnd-ai-character'
const CHARACTER_TAG_REGEX =
  /\[CHARACTER\s+name="([^"]+)"(?:\s+color="([^"]+)")?\s*\](.*?)\[\/CHARACTER\]/gis
const NPC_TAG_REGEX = /<npc\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/npc>/gi
const QUEST_TAG_REGEX = /\[QUEST([^\]]*)\]([\s\S]*?)\[\/QUEST\]/gi
const RUMOR_TAG_REGEX = /\[RUMOR([^\]]*)\]([\s\S]*?)\[\/RUMOR\]/gi
const RELATION_TAG_REGEX = /\[RELATION([^\]]*)\]([\s\S]*?)\[\/RELATION\]/gi
const BATTLE_TAG_REGEX = /\[BATTLE([^\]]*)\]([\s\S]*?)\[\/BATTLE\]/gi
const EFFECT_TAG_REGEX = /\[EFFECT([^\]]*)\]/gi
const GLOW_TAG_REGEX = /<glow([^>]*)>([\s\S]*?)<\/glow>/gi
const HIGHLIGHT_TAG_REGEX =
  /<span\s+class="([^"]*\bhl\b[^"]*)"\s*>([\s\S]*?)<\/span>/gi
const GLOW_ATTR_REGEX = /(\w+)="([^"]+)"/gi

const DEFAULT_NPC_PALETTE: NPCPaletteEntry[] = [
  { id: 'ember1', color: '#ffd88a', glow: '0 0 6px rgba(255, 216, 138, 0.35), 0 0 12px rgba(255, 216, 138, 0.15)' },
  { id: 'ember2', color: '#ffc89a', glow: '0 0 6px rgba(255, 200, 154, 0.35), 0 0 12px rgba(255, 200, 154, 0.15)' },
  { id: 'violet1', color: '#d9b8ff', glow: '0 0 6px rgba(217, 184, 255, 0.35), 0 0 12px rgba(217, 184, 255, 0.15)' },
  { id: 'violet2', color: '#cbb0ff', glow: '0 0 6px rgba(203, 176, 255, 0.35), 0 0 12px rgba(203, 176, 255, 0.15)' },
  { id: 'cyan1', color: '#9fe8ff', glow: '0 0 6px rgba(159, 232, 255, 0.35), 0 0 12px rgba(159, 232, 255, 0.15)' },
  { id: 'cyan2', color: '#8ad9ff', glow: '0 0 6px rgba(138, 217, 255, 0.35), 0 0 12px rgba(138, 217, 255, 0.15)' },
  { id: 'rose1', color: '#ffb2c0', glow: '0 0 6px rgba(255, 178, 192, 0.35), 0 0 12px rgba(255, 178, 192, 0.15)' },
  { id: 'rose2', color: '#ffa1b2', glow: '0 0 6px rgba(255, 161, 178, 0.35), 0 0 12px rgba(255, 161, 178, 0.15)' },
  { id: 'green1', color: '#baf6c4', glow: '0 0 6px rgba(186, 246, 196, 0.35), 0 0 12px rgba(186, 246, 196, 0.15)' },
  { id: 'green2', color: '#a6efb4', glow: '0 0 6px rgba(166, 239, 180, 0.35), 0 0 12px rgba(166, 239, 180, 0.15)' },
  { id: 'blue1', color: '#b6ccff', glow: '0 0 6px rgba(182, 204, 255, 0.35), 0 0 12px rgba(182, 204, 255, 0.15)' },
  { id: 'blue2', color: '#a8beff', glow: '0 0 6px rgba(168, 190, 255, 0.35), 0 0 12px rgba(168, 190, 255, 0.15)' }
]

const hashString = (value: string): number => {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}
const ATTRIBUTE_REGEX = /(\w+)="([^"]+)"/gi
const MIN_SUCCESS_THRESHOLD = 12
const SUMMARY_INTERVAL = 12
const SUMMARY_KEEP_LATEST = 2
const MIN_BACKSTORY_LENGTH = 200
const MIN_MESSAGES_FOR_BACKSTORY = 6
/* const INITIAL_DM_OPENING = `Dungeon Master

The Gilded Griffin · Taproom · Morning
[1] The heavy oak door grinds open and lanternlight washes the entry, catching wet cloaks and boot-mud on the boards. The Gilded Griffin smells of spice-warmed cider, smoke, and old ash, and the hearth pops hard enough to throw sparks against the stone. A long table near the fire is crowded with trappers and caravan hands, their knives laid flat beside half-empty bowls. [CHARACTER name="Corin the Barkeep" color="#d97706"]"Easy there, traveler,"[/CHARACTER] the barkeep rumbles as he sets a rinsed mug on the bar and wipes his hands on a comet-blue cloth.
[2] Dice stop clacking, a chair leg scrapes, and two gamblers angle their stools to watch without turning their shoulders. Rain ticks against stained glass, the lute upstairs falters, and a low murmur runs along the benches as people measure your gear and the set of your jaw. A server slips past with a tray held high, eyes fixed on the floor, as if avoiding a spark. Corin's gaze flicks past you to the door, then back, his voice lower but steady.
[3] A pair of city guards in damp cloaks step into the threshold, water streaming from their hems, and one of them scans the room before the door shuts behind him. The room tightens around the sound of the latch, and a few hands drift closer to belts and tankards. One guard lifts a folded writ and taps it against his palm, waiting for the room to settle. Whatever drove them inside is closing in on the tavern just as the room decides where you belong.`
*/

/* const extractSceneHeader = (content: string) => {
  const match = content.match(/^([^\n]+)\n\n([\s\S]*)$/)
  if (!match) {
    return { header: '', body: content }
  }
  const header = match[1].includes('·') ? match[1].trim() : ''
  if (!header) {
    return { header: '', body: content }
  }
  return { header, body: match[2] || '' }
}

*/

const extractSceneHeader = (content: string) => {
  if (!content) {
    return { header: '', body: '' }
  }
  const lines = content.split('\n')
  let index = 0
  while (index < lines.length && !lines[index].trim()) {
    index += 1
  }
  if (lines[index]?.trim().toLowerCase() === 'dungeon master') {
    index += 1
  }
  while (index < lines.length && !lines[index].trim()) {
    index += 1
  }
  const headerCandidate = lines[index]?.trim() || ''
  if (!headerCandidate || (!headerCandidate.includes('·') && !headerCandidate.includes('-'))) {
    return { header: '', body: content.trim() }
  }
  index += 1
  while (index < lines.length && !lines[index].trim()) {
    index += 1
  }
  const body = lines.slice(index).join('\n').trim()
  return { header: headerCandidate, body: body || '' }
}

const stripNumberedParagraphs = (content: string) => {
  return content
    .split('\n')
    .map(line => line.replace(/^\s*\[\d+\]\s*/, ''))
    .join('\n')
    .trim()
}

const getLevelFromXP = (xp: number): number => {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) {
      return i + 1
    }
  }
  return 1
}

const parseAttributes = (input: string): Record<string, string> => {
  const attributes: Record<string, string> = {}
  let match: RegExpExecArray | null
  while ((match = ATTRIBUTE_REGEX.exec(input)) !== null) {
    attributes[match[1].toLowerCase()] = match[2]
  }
  ATTRIBUTE_REGEX.lastIndex = 0
  return attributes
}

const parseGlowAttributes = (input: string): Record<string, string> => {
  const attributes: Record<string, string> = {}
  let match: RegExpExecArray | null
  while ((match = GLOW_ATTR_REGEX.exec(input)) !== null) {
    attributes[match[1].toLowerCase()] = match[2]
  }
  GLOW_ATTR_REGEX.lastIndex = 0
  return attributes
}

const parseEnemies = (input?: string): Array<{ name: string; hp: number }> => {
  if (!input) return []
  return input.split('|').map(token => {
    const [name, hp] = token.split(':')
    return { name: name?.trim() || 'Foe', hp: hp ? Number(hp) : 10 }
  })
}

const classifyCombatText = (text: string): ActionIntent => {
  const lower = text.toLowerCase()
  const actionMap: Array<{ action: ActionIntent['action']; pattern: RegExp }> = [
    { action: 'attack', pattern: /(attack|hit|strike|stab|slash|shoot)/i },
    { action: 'defend', pattern: /(defend|block|parry|guard)/i },
    { action: 'move', pattern: /(move|run|dash|step|retreat|advance|cover)/i },
    { action: 'item', pattern: /(use item|drink|potion|bandage)/i },
    { action: 'spell', pattern: /(cast|spell|incant|magic)/i }
  ]

  const matched = actionMap.find(entry => entry.pattern.test(lower))
  return {
    action: matched?.action || 'attempt',
    actor: 'player',
    target: null,
    free_text: text
  }
}


const isAbilityUnlocked = (
  ability: CharacterAbility,
  level: number,
  equipment: string[],
  artifacts: string[]
) => {
  const levelOk = level >= (ability.unlockLevel || 1)
  const normalizedEquipment = equipment.map(item => item.toLowerCase())
  const normalizedArtifacts = artifacts.map(item => item.toLowerCase())

  const equipmentOk =
    !ability.requiresEquipment?.length ||
    ability.requiresEquipment.some(req => normalizedEquipment.includes(req.toLowerCase()))

  const artifactOk =
    !ability.requiresArtifact?.length ||
    ability.requiresArtifact.some(req => normalizedArtifacts.includes(req.toLowerCase()))

  return levelOk && equipmentOk && artifactOk
}

const buildAbilitiesFromFeatures = (classData?: CustomClassResponse | null): CharacterAbility[] => {
  if (!classData?.features?.length) {
    return []
  }
  return classData.features.map((feature, index) => {
    const [namePart] = feature.split(':')
    const isSpell = /spell|magic|arcane|ritual|chant|bolt|blast|aura|hex|prayer/i.test(feature)
    const fallbackLabel = isSpell ? 'Spell' : 'Skill'
    const derivedName = namePart?.trim()
      ? namePart.trim()
      : feature
          .replace(/^feature\s*[:\-]?\s*/i, '')
          .trim()
          .split(/\s+/)
          .slice(0, 4)
          .join(' ')
    const finalName = derivedName || `${fallbackLabel} Technique`
    return {
      id: `${classData.className || 'class'}-${index}`,
      name: finalName.replace(/^feature\s*/i, '').trim(),
      description: feature.replace(/^feature\s*[:\-]?\s*/i, '').trim(),
      type: isSpell ? 'spell' : 'skill',
      unlockLevel: index === 0 ? 1 : Math.min(1 + index * 2, 20)
    }
  })
}

const buildAbilitiesFromProfile = (profile: StoredCharacterProfile | null): CharacterAbility[] => {
  if (!profile) return []
  if (profile.abilityDeck?.length) return profile.abilityDeck
  if (profile.abilities?.length) return profile.abilities
  return buildAbilitiesFromFeatures(profile.customClassData)
}

const computeResourcesFromProfile = (profile: StoredCharacterProfile | null) => {
  if (!profile) {
    return { hp: 24, mp: 16 }
  }
  if (profile.resources) {
    return profile.resources
  }
  const stats = profile.customClassData?.stats || DEFAULT_STATS
  const hitDie = Number(profile.customClassData?.hitDie?.replace('d', '')) || 8
  const hp = Math.max(1, hitDie + (stats.constitution || DEFAULT_STATS.constitution))
  const mp = Math.max(
    8,
    Math.round(((stats.intelligence || 10) + (stats.wisdom || 10) + (stats.charisma || 10)) / 3)
  )
  return { hp, mp }
}

const AFFINITY_TIERS = ['Hostile', 'Wary', 'Neutral', 'Friendly', 'Allied'] as const

const getAffinityTierIndex = (affinity: number): number => {
  if (affinity >= 40) return 4
  if (affinity >= 20) return 3
  if (affinity >= 5) return 2
  if (affinity <= -30) return 0
  if (affinity <= -10) return 1
  return 2
}

const getAffinityBadge = (affinity: number): string => {
  return AFFINITY_TIERS[getAffinityTierIndex(affinity)] || 'Neutral'
}

const normalizeNpcName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\bthe\b/g, '')
    .replace(/\b(barkeep|bartender|innkeeper)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const colorFromName = (name: string): string => {
  const seed = normalizeNpcName(name) || name
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  const saturation = 55
  const lightness = 68
  const c = (1 - Math.abs(2 * (lightness / 100) - 1)) * (saturation / 100)
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lightness / 100 - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (hue < 60) {
    r = c
    g = x
  } else if (hue < 120) {
    r = x
    g = c
  } else if (hue < 180) {
    g = c
    b = x
  } else if (hue < 240) {
    g = x
    b = c
  } else if (hue < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const toHex = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const GameSession = () => {
  const { campaignId } = useParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [activeSidebar, setActiveSidebar] = useState<SidebarSection>('stats')
  const [isLoading, setIsLoading] = useState(false)
  const [characterColors, setCharacterColors] = useState<Record<string, string>>({})
  const [npcRegistryById, setNpcRegistryById] = useState<Record<string, NPCRegistryEntry>>({})
  const [npcPaletteById, setNpcPaletteById] = useState<Record<string, NPCPaletteEntry>>(() => {
    return DEFAULT_NPC_PALETTE.reduce<Record<string, NPCPaletteEntry>>((acc, entry) => {
      acc[entry.id] = entry
      return acc
    }, {})
  })
  const [npcPaletteList, setNpcPaletteList] = useState<NPCPaletteEntry[]>(DEFAULT_NPC_PALETTE)
  const [battleState, setBattleState] = useState<CombatState | null>(null)
  const [combatEvents, setCombatEvents] = useState<CombatEvent[]>([])
  const [combatAction, setCombatAction] = useState<{ action: ActionIntent['action'] | null; target?: string | null }>({
    action: null
  })
  const [attemptText, setAttemptText] = useState('')
  const [characterProfile, setCharacterProfile] = useState<StoredCharacterProfile | null>(null)
  const [sceneSummary, setSceneSummary] = useState('')
  const [activeStatusName, setActiveStatusName] = useState<string | null>(null)
  const [expandedQuestIds, setExpandedQuestIds] = useState<Set<string>>(new Set())
  const [expandedRumorIds, setExpandedRumorIds] = useState<Set<string>>(new Set())
  const [expandedNpcIds, setExpandedNpcIds] = useState<Set<string>>(new Set())
  const [expandedSpellIds, setExpandedSpellIds] = useState<Set<string>>(new Set())
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [activeSpellId, setActiveSpellId] = useState<string | null>(null)
  const battleUiEnabled = false
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const questInitRef = useRef(false)
  const backstorySummaryAttemptedRef = useRef(false)
  const battleStateCheckEnabledRef = useRef(false)
  const rollStartedRef = useRef<Set<string>>(new Set())
  const pendingCheckByMessageRef = useRef<Map<string, string>>(new Map())
  const startInlineRollRef = useRef<((messageId: string, request: SkillCheckRequest) => void) | null>(null)
  const lastPlayerActionRef = useRef('')
  const lastPlayerMessageIdRef = useRef<string | null>(null)
  const summaryInFlightRef = useRef(false)
  const statusUpdateInFlightRef = useRef(false)
  const lastSceneHeaderRef = useRef<string>('')
  const openingGeneratedRef = useRef(false)

  const registerCharacterColors = useCallback((content: string) => {
    if (!content) return
    const matches = Array.from(content.matchAll(/\[CHARACTER\s+name="([^"]+)"\s+color="([^"]+)"\]/gi))
    if (!matches.length) return

    setCharacterColors(prev => {
      let changed = false
      const updated = { ...prev }
      matches.forEach(([, name, color]) => {
        const trimmedName = name.trim()
        const trimmedColor = color.trim()
        if (trimmedName && trimmedColor && !updated[trimmedName]) {
          updated[trimmedName] = trimmedColor
          changed = true
        }
      })
      return changed ? updated : prev
    })
  }, [])

  const persistProfile = useCallback((profile: StoredCharacterProfile) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(profile))
    } catch (error) {
      console.error('Failed to persist profile:', error)
    }
  }, [])

  const updateStoredProfile = useCallback(
    (updater: (prev: StoredCharacterProfile) => StoredCharacterProfile) => {
      setCharacterProfile(prev => {
        if (!prev) return prev
        const nextProfile = updater(prev)
        persistProfile(nextProfile)
        return nextProfile
      })
    },
    [persistProfile]
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      const stored = localStorage.getItem(CHARACTER_STORAGE_KEY)
      if (stored) {
        setCharacterProfile(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load stored character profile:', error)
    }
  }, [])

  useEffect(() => {
    if (!characterProfile) return
    if (!characterProfile.quests) {
      updateStoredProfile(prev => ({ ...prev, quests: [] }))
    }
    if (characterProfile.xp === undefined) {
      updateStoredProfile(prev => ({ ...prev, xp: 0 }))
    }
    if (!characterProfile.statusEffects) {
      updateStoredProfile(prev => ({ ...prev, statusEffects: [] }))
    }
    if (!characterProfile.sceneId) {
      updateStoredProfile(prev => ({ ...prev, sceneId: 1 }))
    }
    if (!characterProfile.rumors) {
      updateStoredProfile(prev => ({ ...prev, rumors: [] }))
    }
    if (!characterProfile.npcRelations) {
      updateStoredProfile(prev => ({ ...prev, npcRelations: [] }))
    }
    if (characterProfile.npcRelations?.length) {
      updateStoredProfile(prev => {
        if (!prev) return prev
        const merged = new Map<string, NPCRelation>()
        prev.npcRelations?.forEach(rel => {
          const key = normalizeNpcName(rel.name) || rel.id
          const existing = merged.get(key)
          if (!existing) {
            merged.set(key, { ...rel, id: key })
          } else {
            merged.set(key, {
              ...existing,
              affinity: Math.max(existing.affinity, rel.affinity),
              notes: [...existing.notes, ...rel.notes]
            })
          }
        })
        return { ...prev, npcRelations: Array.from(merged.values()) }
      })
    }
    if (!characterProfile.systemNotices) {
      updateStoredProfile(prev => ({ ...prev, systemNotices: [] }))
    }
    if (!characterProfile.spellCooldowns) {
      updateStoredProfile(prev => ({ ...prev, spellCooldowns: {} }))
    }
    if (!characterProfile.inventoryItems) {
      const equipment = characterProfile.equipment || []
      if (equipment.length) {
        const converted = equipment.map((name, index) => ({
          id: `${name.toLowerCase().replace(/\s+/g, '-')}-${index}`,
          name,
          description: 'A trusted item from your pack.',
          tags: ['equipment']
        }))
        updateStoredProfile(prev => ({ ...prev, inventoryItems: converted }))
      } else {
        updateStoredProfile(prev => ({ ...prev, inventoryItems: [] }))
      }
    }
  }, [characterProfile, updateStoredProfile])

  useEffect(() => {
    if (!campaignId) return
    if (!battleStateCheckEnabledRef.current) return
    getBattleState(campaignId)
      .then(response => {
        if (response.battle && response.battle.phase !== 'ended') {
          setBattleState(response.battle)
        }
      })
      .catch(() => {})
  }, [campaignId])

  useEffect(() => {
    if (backstorySummaryAttemptedRef.current) {
      return
    }
    if (!characterProfile?.backstory || characterProfile.backstorySummary) {
      return
    }
    if (characterProfile.backstory.length < MIN_BACKSTORY_LENGTH && messages.length < MIN_MESSAGES_FOR_BACKSTORY) {
      return
    }

    backstorySummaryAttemptedRef.current = true
    summarizeBackstory(characterProfile.backstory)
      .then(summary => {
        if (!summary) return
        updateStoredProfile(prev => ({
          ...prev,
          backstorySummary: summary
        }))
      })
      .catch(error => {
        console.error('Backstory summary failed:', error)
      })
  }, [characterProfile, messages.length, updateStoredProfile])

  useEffect(() => {
    if (!characterProfile) return
    if ((characterProfile.quests?.length || 0) > 0) return
    if (!characterProfile.backstory || questInitRef.current) return

    questInitRef.current = true
    generateQuestFromBackstory(
      characterProfile.backstory,
      characterProfile.name || 'Hero',
      characterProfile.class || 'Adventurer'
    )
      .then((quest) => {
        updateStoredProfile(prev => ({
          ...prev,
          quests: [
            ...(prev.quests || []),
            {
              id: quest.id,
              title: quest.title,
              description: quest.summary,
              xp: quest.xp,
              status: 'active',
              progress: quest.hook,
              objectives: quest.objectives,
              log: [quest.hook]
            }
          ]
        }))
      })
      .catch(error => {
        questInitRef.current = false
        console.error('Initial quest generation failed:', error)
      })
  }, [characterProfile, updateStoredProfile])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const lastDM = [...messages].reverse().find(message => message.type === 'dm')
    if (lastDM) {
      registerCharacterColors(lastDM.content)
    }
  }, [messages, registerCharacterColors])
  const stats = useMemo(() => characterProfile?.customClassData?.stats || DEFAULT_STATS, [characterProfile])
  const resources = useMemo(() => computeResourcesFromProfile(characterProfile), [characterProfile])
  const quests = characterProfile?.quests || []
  const rumors = characterProfile?.rumors || []
  const npcRelations = characterProfile?.npcRelations || []
  const mergedNpcRelations = useMemo(() => {
    const base = new Map<string, NPCRelation>()
    npcRelations.forEach(relation => {
      base.set(normalizeNpcName(relation.name) || relation.id, relation)
    })
    Object.values(npcRegistryById).forEach(npc => {
      const key = normalizeNpcName(npc.name) || npc.id
      if (!base.has(key)) {
        base.set(key, {
          id: npc.id,
          name: npc.name,
          affinity: 0,
          notes: []
        })
      }
    })
    return Array.from(base.values())
  }, [npcRelations, npcRegistryById])
  const inventoryItems = characterProfile?.inventoryItems || []
  const systemNotices = characterProfile?.systemNotices || []
  const spellCooldowns = characterProfile?.spellCooldowns || {}
  const xp = characterProfile?.xp ?? 0
  const level = characterProfile?.level ?? getLevelFromXP(xp)
  const statusEffects = characterProfile?.statusEffects || []
  const sceneId = characterProfile?.sceneId ?? 1
  const resolvedAvatarUrl =
    characterProfile?.avatarUrl && characterProfile.avatarUrl.startsWith('http')
      ? characterProfile.avatarUrl
      : characterProfile?.avatarUrl
      ? `${API_ORIGIN}${characterProfile.avatarUrl}`
      : null

  const getModifierFromLabel = useCallback(
    (label: string, statOverride?: string) => {
      const lower = label.toLowerCase()
      const override = statOverride?.toLowerCase()
      const statMap: Record<string, { key: keyof typeof DEFAULT_STATS; short: string }> = {
        strength: { key: 'strength', short: 'STR' },
        str: { key: 'strength', short: 'STR' },
        dexterity: { key: 'dexterity', short: 'DEX' },
        dex: { key: 'dexterity', short: 'DEX' },
        constitution: { key: 'constitution', short: 'CON' },
        con: { key: 'constitution', short: 'CON' },
        intelligence: { key: 'intelligence', short: 'INT' },
        int: { key: 'intelligence', short: 'INT' },
        wisdom: { key: 'wisdom', short: 'WIS' },
        wis: { key: 'wisdom', short: 'WIS' },
        charisma: { key: 'charisma', short: 'CHA' },
        cha: { key: 'charisma', short: 'CHA' }
      }

      const match = Object.keys(statMap).find(key => lower.includes(key) || (override && override === key))
      if (!match) {
        return null
      }

      const stat = statMap[match]
      const score = stats[stat.key] ?? 10
      const modifier = Math.floor((score - 10) / 2)
      return { modifier, label: stat.short }
    },
    [stats]
  )

  const getProficiencyBonus = useCallback((levelValue: number) => {
    if (levelValue >= 17) return 6
    if (levelValue >= 13) return 5
    if (levelValue >= 9) return 4
    if (levelValue >= 5) return 3
    return 2
  }, [])

  const shouldApplyProficiency = useCallback((request: SkillCheckRequest) => {
    const kind = request.kind?.toLowerCase() || ''
    if (!kind) {
      return true
    }
    return ['attack', 'skill', 'contest', 'social', 'stealth', 'magic', 'perception'].includes(
      kind
    )
  }, [])

  useEffect(() => {
    if (!characterProfile) return
    if ((characterProfile.level ?? 1) !== level) {
      updateStoredProfile(prev => ({ ...prev, level }))
    }
  }, [characterProfile, level, updateStoredProfile])

  const currentThreshold = XP_THRESHOLDS[Math.max(0, level - 1)] ?? 0
  const nextThreshold =
    XP_THRESHOLDS[Math.min(XP_THRESHOLDS.length - 1, level)] ?? XP_THRESHOLDS[XP_THRESHOLDS.length - 1]
  const xpProgress = Math.min(
    100,
    Math.max(0, ((xp - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)) * 100)
  )

  const abilityDeck = useMemo<CharacterAbility[]>(() => buildAbilitiesFromProfile(characterProfile), [characterProfile])
  const equipment = characterProfile?.equipment || []
  const artifacts = characterProfile?.artifacts || []

  const unlockedAbilities = useMemo(
    () =>
      abilityDeck.filter(ability =>
        isAbilityUnlocked(
          ability,
          level,
          equipment.length ? equipment : ["traveler's garb"],
          artifacts
        )
      ),
    [abilityDeck, level, equipment, artifacts]
  )

  const unlockedSpells = useMemo(
    () => unlockedAbilities.filter(ability => ability.type === 'spell'),
    [unlockedAbilities]
  )
  const unlockedSkills = useMemo(
    () => unlockedAbilities.filter(ability => ability.type !== 'spell'),
    [unlockedAbilities]
  )

  const knownNpcs = useMemo(
    () =>
      Object.values(npcRegistryById).map(npc => ({
        id: npc.id,
        name: npc.name
      })),
    [npcRegistryById]
  )

  useEffect(() => {
    if (!knownNpcs.length || !characterProfile) return
    updateStoredProfile(prev => {
      if (!prev) return prev
      const relations = [...(prev.npcRelations || [])]
      let changed = false
      knownNpcs.forEach(npc => {
        const normalized = normalizeNpcName(npc.name)
        if (!relations.some(entry => normalizeNpcName(entry.name) === normalized)) {
          relations.push({
            id: npc.id || normalized || npc.name.toLowerCase().replace(/\s+/g, '-'),
            name: npc.name,
            affinity: 0,
            notes: []
          })
          changed = true
        }
      })
      return changed ? { ...prev, npcRelations: relations } : prev
    })
  }, [characterProfile, knownNpcs, updateStoredProfile])

  const pushSystemMessage = useCallback((content: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: createMessageId(),
        type: 'system',
        content,
        timestamp: new Date()
      }
    ])
  }, [])

  const updateMessageRoll = useCallback(
    (messageId: string, roll: Message['roll']) => {
      setMessages(prev =>
        prev.map(message => {
          if (message.id !== messageId) {
            return message
          }
          return {
            ...message,
            roll
          }
        })
      )
    },
    []
  )

  const toggleExpanded = useCallback((setState: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setState(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const addSystemNotice = useCallback(
    (notice: string) => {
      updateStoredProfile(prev => {
        if (!prev) return prev
        const nextNotices = [...(prev.systemNotices || []), notice]
        return { ...prev, systemNotices: nextNotices }
      })
    },
    [updateStoredProfile]
  )

  const clearSystemNotices = useCallback(() => {
    updateStoredProfile(prev => {
      if (!prev) return prev
      return { ...prev, systemNotices: [] }
    })
  }, [updateStoredProfile])

  const tickCooldowns = useCallback(() => {
    updateStoredProfile(prev => {
      if (!prev) return prev
      const cooldowns = { ...(prev.spellCooldowns || {}) }
      let changed = false
      Object.keys(cooldowns).forEach(key => {
        if (cooldowns[key] > 0) {
          cooldowns[key] = cooldowns[key] - 1
          changed = true
        }
      })
      return changed ? { ...prev, spellCooldowns: cooldowns } : prev
    })
  }, [updateStoredProfile])

  const getSpellMeta = useCallback((spell: CharacterAbility) => {
    const name = spell.name.toLowerCase()
    const desc = spell.description.toLowerCase()
    const isHealing = /heal|restore|mend|soothe/.test(name + desc)
    const cost = isHealing ? 4 : 3
    const cooldown = isHealing ? 3 : 2
    return { cost, cooldown, isHealing }
  }, [])

  const useItem = useCallback(
    (itemId: string) => {
      const item = inventoryItems.find(entry => entry.id === itemId)
      if (!item) return

      if (item.consumable) {
        updateStoredProfile(prev => {
          if (!prev) return prev
          const baseResources = prev.resources ?? computeResourcesFromProfile(prev)
          const hpDelta = item.effects?.hp || 0
          const mpDelta = item.effects?.mp || 0
          const updatedItems = (prev.inventoryItems || []).filter(entry => entry.id !== itemId)

          return {
            ...prev,
            resources: {
              hp: Math.max(0, baseResources.hp + hpDelta),
              mp: Math.max(0, baseResources.mp + mpDelta)
            },
            inventoryItems: updatedItems
          }
        })

        const notice = `${item.name} used (${item.effects?.hp ? `${item.effects.hp > 0 ? '+' : ''}${item.effects.hp} HP` : ''}${item.effects?.mp ? `${item.effects?.hp ? ', ' : ''}${item.effects.mp > 0 ? '+' : ''}${item.effects.mp} MP` : ''})`
        pushSystemMessage(notice)
        addSystemNotice(notice)
        setSelectedItemId(null)
      }
    },
    [addSystemNotice, inventoryItems, pushSystemMessage, updateStoredProfile, setSelectedItemId]
  )

  const useSpell = useCallback(
    (spell: CharacterAbility) => {
      const meta = getSpellMeta(spell)
      const cooldownRemaining = spellCooldowns[spell.id] || 0
      if (cooldownRemaining > 0) {
        pushSystemMessage(`${spell.name} is still recovering (${cooldownRemaining} turns).`)
        return
      }
      if (resources.mp < meta.cost) {
        pushSystemMessage(`Not enough MP to cast ${spell.name}.`)
        return
      }

      updateStoredProfile(prev => {
        if (!prev) return prev
        const baseResources = prev.resources ?? computeResourcesFromProfile(prev)
        const updatedResources = {
          hp: baseResources.hp + (meta.isHealing ? 4 : 0),
          mp: Math.max(0, baseResources.mp - meta.cost)
        }

        const cooldowns = { ...(prev.spellCooldowns || {}) }
        cooldowns[spell.id] = meta.cooldown

        return {
          ...prev,
          resources: updatedResources,
          spellCooldowns: cooldowns
        }
      })

      setActiveSpellId(spell.id)
      setTimeout(() => setActiveSpellId(null), 900)

      const notice = `${spell.name}: ${meta.isHealing ? '+4 HP' : 'cast'} (${meta.cost} MP)`
      pushSystemMessage(notice)
      addSystemNotice(notice)
    },
    [addSystemNotice, getSpellMeta, pushSystemMessage, resources.mp, spellCooldowns, updateStoredProfile]
  )

  const applyCombatEvents = useCallback(
    (events: CombatEvent[]) => {
      if (!events.length) return
      const playerDamage = events
        .filter(event => event.type === 'DAMAGE_APPLIED' && event.data?.target === 'player')
        .reduce((sum, event) => sum + (Number(event.data?.amount) || 0), 0)

      if (playerDamage > 0) {
        updateStoredProfile(prev => {
          if (!prev) return prev
          const baseResources = prev.resources ?? computeResourcesFromProfile(prev)
          return {
            ...prev,
            resources: {
              hp: Math.max(0, baseResources.hp - playerDamage),
              mp: baseResources.mp
            }
          }
        })
        pushSystemMessage(`You take ${playerDamage} damage.`)
      }
    },
    [pushSystemMessage, updateStoredProfile]
  )

  const getEnemyTargets = useCallback(() => {
    if (!battleState) return []
    return battleState.entities.filter(entity => entity.type === 'enemy' && entity.hp > 0)
  }, [battleState])

  const resolveTargetFromText = useCallback(
    (text: string) => {
      const enemies = getEnemyTargets()
      if (!enemies.length) return null
      const match = enemies.find(enemy => text.toLowerCase().includes(enemy.name.toLowerCase()))
      return match ? match.id : enemies[0].id
    },
    [getEnemyTargets]
  )

  const buildGameContext = useCallback(
    () => {
      const segments: string[] = []
      if (campaignId) {
        segments.push(`Campaign: ${campaignId}`)
      }
      segments.push(`Scene ID: ${sceneId}`)
      if (sceneSummary) {
        segments.push(`Scene summary:\n${sceneSummary}`)
      }
      if (characterProfile?.backstorySummary) {
        segments.push(`Backstory key moments:\n${characterProfile.backstorySummary}`)
      }
      if (statusEffects.length) {
        const names = statusEffects.map(effect => effect.name).filter(Boolean)
        if (names.length) {
          segments.push(`Active conditions: ${names.join('; ')}`)
        }
      }
      if (systemNotices.length) {
        segments.push(`Recent system events: ${systemNotices.join(' | ')}`)
      }
      return segments.join('\n')
    },
    [campaignId, sceneSummary, statusEffects, systemNotices, characterProfile?.backstorySummary]
  )

  const sendCombatIntent = useCallback(
    async (intent: ActionIntent) => {
      if (!battleState) return
      try {
        const response = await actBattle({
          campaignId: campaignId || 'local',
          intent,
          context: buildGameContext(),
          playerSnapshot: { hp: resources.hp, mp: resources.mp }
        })
        setBattleState(response.battle)
        setCombatEvents(response.events)
        applyCombatEvents(response.events)

        if (response.narration) {
          const dmMessage: Message = {
            id: createMessageId(),
            type: 'dm',
            content: response.narration,
            timestamp: new Date()
          }
          setMessages(prev => [...prev, dmMessage])
          setChatHistory(prev => [...prev, { role: 'assistant', content: response.narration }])
        }
        clearSystemNotices()
      } catch (error: any) {
        console.error('Combat action failed:', error)
        pushSystemMessage(error?.message || 'The clash stutters. Try again.')
      } finally {
        setCombatAction({ action: null })
        setAttemptText('')
      }
    },
    [
      applyCombatEvents,
      battleState,
      buildGameContext,
      campaignId,
      clearSystemNotices,
      resources.hp,
      resources.mp,
      pushSystemMessage
    ]
  )

  const maybeSummarizeHistory = useCallback(
    async (history: ChatMessage[]) => {
      if (summaryInFlightRef.current) {
        return
      }
      const nonSystemCount = history.filter(entry => entry.role !== 'system').length
      if (nonSystemCount < SUMMARY_INTERVAL) {
        return
      }
      summaryInFlightRef.current = true
      try {
        const summary = await summarizeScene(history)
        if (!summary) {
          return
        }
        setSceneSummary(summary)
        const tail = history.slice(-SUMMARY_KEEP_LATEST)
        const summarizedHistory: ChatMessage[] = [
          { role: 'system', content: `Scene summary:\n${summary}` },
          ...tail
        ]
        setChatHistory(summarizedHistory)
        updateStoredProfile(prev => ({
          ...prev,
          sceneId: (prev.sceneId ?? 1) + 1
        }))
      } catch (error) {
        console.error('Failed to summarize scene:', error)
      } finally {
        summaryInFlightRef.current = false
      }
    },
    []
  )

  const handleQuestTag = useCallback(
    (attrText: string, body: string) => {
      const attributes = parseAttributes(attrText)
      let xpAwarded = 0
      let newQuestTitle: string | null = null

      updateStoredProfile(prev => {
        if (!prev) return prev

        const questsClone = [...(prev.quests || [])]
        const questId =
          attributes.id ||
          (attributes.title ? attributes.title.toLowerCase().replace(/\s+/g, '-') : `quest-${Date.now()}`)
        const statusToken = attributes.status?.toLowerCase() || 'offer'
        const xpValue = Number(attributes.xp) || 0
        const trimmedBody = body?.trim() || ''
      const objectives = attributes.objectives
        ? attributes.objectives.split('|').map(item => item.trim()).filter(Boolean)
        : undefined
      const completedObjectives = attributes.complete
        ? attributes.complete.split(',').map(item => Number(item.trim())).filter(Number.isFinite)
        : []

        const existingIndex = questsClone.findIndex(quest => quest.id === questId)
        const prevQuest = existingIndex >= 0 ? questsClone[existingIndex] : undefined

        const quest: Quest = prevQuest
          ? { ...prevQuest }
          : {
              id: questId,
              title: attributes.title || `Quest ${questsClone.length + 1}`,
              description: trimmedBody || attributes.summary || 'An opportunity unfolds.',
              xp: xpValue || 150,
              status: 'active',
              progress: trimmedBody,
              objectives: objectives || [],
              log: trimmedBody ? [trimmedBody] : []
            }

        if (!prevQuest) {
          newQuestTitle = quest.title
        }

        if (attributes.title) {
          quest.title = attributes.title
        }

        if (trimmedBody) {
          quest.description = quest.description || trimmedBody
          quest.progress = trimmedBody
          quest.log = [...(quest.log || []), trimmedBody]
        }

        if (objectives) {
          quest.objectives = objectives
          if (!quest.objectiveStatus || quest.objectiveStatus.length !== objectives.length) {
            quest.objectiveStatus = objectives.map(() => false)
          }
        }

        if (xpValue) {
          quest.xp = xpValue
        }

        const wasCompleted = prevQuest?.status === 'completed'

        if (statusToken === 'complete') {
          quest.status = 'completed'
          if (!wasCompleted) {
            xpAwarded = quest.xp || xpValue || 0
          }
          if (quest.objectives?.length) {
            quest.objectiveStatus = quest.objectives.map(() => true)
          }
        } else if (statusToken === 'fail') {
          quest.status = 'failed'
        } else {
          quest.status = 'active'
        }

        if (completedObjectives.length && quest.objectiveStatus) {
          completedObjectives.forEach(index => {
            if (index >= 0 && index < quest.objectiveStatus!.length) {
              quest.objectiveStatus![index] = true
            }
          })
        }

        if (existingIndex >= 0) {
          questsClone[existingIndex] = quest
        } else {
          questsClone.push(quest)
        }

        let updatedXP = prev.xp ?? 0
        if (xpAwarded > 0) {
          updatedXP += xpAwarded
        }

        return {
          ...prev,
          quests: questsClone,
          xp: updatedXP,
          level: getLevelFromXP(updatedXP)
        }
      })

      if (newQuestTitle) {
        pushSystemMessage(`Quest tracked: ${newQuestTitle}`)
      }

      if (xpAwarded > 0) {
        pushSystemMessage(`Quest complete! You gained ${xpAwarded} XP.`)
      }
    },
    [updateStoredProfile, pushSystemMessage]
  )

  const toggleQuestObjective = useCallback(
    (questId: string, index: number) => {
      updateStoredProfile(prev => {
        if (!prev) return prev
        const questsClone = [...(prev.quests || [])]
        const questIndex = questsClone.findIndex(quest => quest.id === questId)
        if (questIndex === -1) return prev
        const quest = { ...questsClone[questIndex] }
        const objectives = quest.objectives || []
        const status = quest.objectiveStatus || objectives.map(() => false)
        if (index < 0 || index >= objectives.length) return prev
        status[index] = !status[index]
        quest.objectiveStatus = status
        questsClone[questIndex] = quest
        return { ...prev, quests: questsClone }
      })
    },
    [updateStoredProfile]
  )

  const handleRumorTag = useCallback(
    (attrText: string, body: string) => {
      const attributes = parseAttributes(attrText)
      const title = attributes.title || 'Unconfirmed lead'
      const rumorId = attributes.id || title.toLowerCase().replace(/\s+/g, '-')
      const detail = (body || attributes.detail || '').trim()

      updateStoredProfile(prev => {
        if (!prev) return prev
        const rumorsClone = [...(prev.rumors || [])]
        const existingIndex = rumorsClone.findIndex(rumor => rumor.id === rumorId)

        const rumor: Rumor = existingIndex >= 0
          ? { ...rumorsClone[existingIndex] }
          : {
              id: rumorId,
              title,
              detail: detail || attributes.detail || 'An unfinished whisper lingers.',
              log: []
            }

        if (title) {
          rumor.title = title
        }
        if (detail) {
          rumor.detail = rumor.detail || detail
          rumor.log = [...(rumor.log || []), detail]
        }

        if (existingIndex >= 0) {
          rumorsClone[existingIndex] = rumor
        } else {
          rumorsClone.push(rumor)
        }

        return { ...prev, rumors: rumorsClone }
      })
    },
    [updateStoredProfile]
  )

  const handleRelationTag = useCallback(
    (attrText: string, body: string) => {
      const attributes = parseAttributes(attrText)
      const name = attributes.name || attributes.npc || 'Unknown'
      const affinityDelta = Number(attributes.affinity || 0)
      const note = (body || attributes.note || '').trim()

      updateStoredProfile(prev => {
        if (!prev) return prev
        const relations = [...(prev.npcRelations || [])]
        const normalized = normalizeNpcName(name)
        const existingIndex = relations.findIndex(rel => normalizeNpcName(rel.name) === normalized)
        const base = existingIndex >= 0 ? relations[existingIndex] : {
          id: normalized || name.toLowerCase().replace(/\s+/g, '-'),
          name,
          affinity: 0,
          notes: []
        }

        const updated: NPCRelation = {
          ...base,
          affinity: base.affinity + (Number.isFinite(affinityDelta) ? affinityDelta : 0),
          notes: note ? [...base.notes, note] : base.notes
        }

        if (existingIndex >= 0) {
          relations[existingIndex] = updated
        } else {
          relations.push(updated)
        }

        return { ...prev, npcRelations: relations }
      })
    },
    [updateStoredProfile]
  )

  const handleBattleTag = useCallback(
    (attrText: string, body: string) => {
      if (!battleUiEnabled) {
        return
      }
      const attributes = parseAttributes(attrText)
      const action = (attributes.action || 'update').toLowerCase()
      const trimmedBody = body?.trim()

      if (action === 'start') {
        battleStateCheckEnabledRef.current = true
        const enemies = parseEnemies(attributes.enemies)
        const playerEntity = {
          id: 'player',
          name: characterProfile?.name || 'Player',
          hp: resources.hp,
          hp_max: resources.hp,
          mp: resources.mp,
          mp_max: resources.mp
        }
        startBattle({
          campaignId: campaignId || 'local',
          player: playerEntity,
          enemies: enemies.map((enemy, index) => ({
            id: `enemy-${index}`,
            name: enemy.name,
            hp: enemy.hp
          }))
        })
          .then(response => {
            setBattleState(response.battle)
            setCombatEvents(response.events || [])
            if (trimmedBody) {
              pushSystemMessage(trimmedBody)
            }
          })
          .catch(error => {
            console.error('Failed to start battle:', error)
            pushSystemMessage('The clash refuses to take shape. Try again.')
          })
        return
      }

      if (action === 'end') {
        setBattleState(prev => (prev ? { ...prev, phase: 'ended' } : prev))
        if (trimmedBody) {
          pushSystemMessage(trimmedBody)
        }
      }
    },
    [battleUiEnabled, campaignId, characterProfile, pushSystemMessage, resources.hp, resources.mp]
  )

  const handleEffectTag = useCallback(
    (attrText: string) => {
      const attributes = parseAttributes(attrText)
      const hpMatch = attrText.match(/hp\s*=\s*([+-]?\d+)/i)
      const mpMatch = attrText.match(/mp\s*=\s*([+-]?\d+)/i)
      const hpDelta = hpMatch ? Number(hpMatch[1]) : 0
      const mpDelta = mpMatch ? Number(mpMatch[1]) : 0
      updateStoredProfile(prev => {
        if (!prev) return prev

        const baseResources = prev.resources ?? computeResourcesFromProfile(prev)
        const nextHp = Math.max(0, baseResources.hp + (Number.isFinite(hpDelta) ? hpDelta : 0))
        const nextMp = Math.max(0, baseResources.mp + (Number.isFinite(mpDelta) ? mpDelta : 0))
        return {
          ...prev,
          resources: {
            hp: nextHp,
            mp: nextMp
          }
        }
      })

      if (Number.isFinite(hpDelta) && hpDelta !== 0) {
        pushSystemMessage(`HP ${hpDelta > 0 ? '+' : ''}${hpDelta}`)
      }
      if (Number.isFinite(mpDelta) && mpDelta !== 0) {
        pushSystemMessage(`MP ${mpDelta > 0 ? '+' : ''}${mpDelta}`)
      }
    },
    [pushSystemMessage, updateStoredProfile]
  )

  const stripStructuredTags = useCallback(
    (content: string) => {
      if (!content) return ''
      let processed = content

      processed = processed.replace(QUEST_TAG_REGEX, (_match, attrs, body) => {
        handleQuestTag(attrs, body || '')
        return body || ''
      })

      processed = processed.replace(RUMOR_TAG_REGEX, (_match, attrs, body) => {
        handleRumorTag(attrs, body || '')
        return body || ''
      })

      processed = processed.replace(RELATION_TAG_REGEX, (_match, attrs, body) => {
        handleRelationTag(attrs, body || '')
        return body || ''
      })

      processed = processed.replace(BATTLE_TAG_REGEX, (_match, attrs, body) => {
        handleBattleTag(attrs, body || '')
        return body || ''
      })

      processed = processed.replace(EFFECT_TAG_REGEX, (_match, attrs) => {
        handleEffectTag(attrs || '')
        return ''
      })

      return processed.trim()
    },
    [handleQuestTag, handleRumorTag, handleRelationTag, handleBattleTag, handleEffectTag]
  )

  const extractSkillCheckRequest = useCallback(
    (dmResponse: DMResponse): { request: SkillCheckRequest; pendingCheckId?: string } | null => {
      if (dmResponse.pending_check?.stat) {
        const dcValue = Number(dmResponse.pending_check.difficulty)
        return {
          request: {
            stat: dmResponse.pending_check.stat.toUpperCase() as Stat,
            label: dmResponse.pending_check.context || 'Check',
            dc: Number.isFinite(dcValue) ? dcValue : undefined,
            kind: dmResponse.pending_check.type
          },
          pendingCheckId: dmResponse.pending_check.id
        }
      }

    if (dmResponse.checkRequest?.stat) {
      const dcValue = Number(dmResponse.checkRequest.difficulty)
      return {
        request: {
          stat: dmResponse.checkRequest.stat.toUpperCase() as Stat,
          label: dmResponse.checkRequest.context || 'Check',
          dc: Number.isFinite(dcValue) ? dcValue : undefined,
          kind: dmResponse.checkRequest.type
        },
        pendingCheckId: dmResponse.checkRequest.id
      }
    }

      return null
    },
    []
  )

  const handleDMResponseOutput = useCallback(
    (dmResponse: DMResponse) => {
      if (dmResponse.npcRegistry?.length) {
        const registryMap = dmResponse.npcRegistry.reduce<Record<string, NPCRegistryEntry>>(
          (acc, entry) => {
            acc[entry.id] = entry
            return acc
          },
          {}
        )
        setNpcRegistryById(registryMap)
      }
      if (dmResponse.npcPalette?.length) {
        const paletteMap = dmResponse.npcPalette.reduce<Record<string, NPCPaletteEntry>>(
          (acc, entry) => {
            acc[entry.id] = entry
            return acc
          },
          {}
        )
        setNpcPaletteById(paletteMap)
        setNpcPaletteList(dmResponse.npcPalette)
      }

      const cleanedContent = stripNumberedParagraphs(
        stripStructuredTags(dmResponse.response || '')
      )
      const { header, body } = extractSceneHeader(cleanedContent)
      if (header) {
        lastSceneHeaderRef.current = header
      }

      if (body) {
        const dmMessage: Message = {
          id: createMessageId(),
          type: 'dm',
          content: body,
          sceneHeader: header || undefined,
          timestamp: new Date(),
          diceRoll: dmResponse.diceRolls?.[0]
        }
        setMessages(prev => [...prev, dmMessage])
      }

      const skillCheck = extractSkillCheckRequest(dmResponse)
      if (skillCheck && lastPlayerMessageIdRef.current) {
        const messageId = lastPlayerMessageIdRef.current
        if (skillCheck.pendingCheckId) {
          pendingCheckByMessageRef.current.set(messageId, skillCheck.pendingCheckId)
        }
        startInlineRollRef.current?.(messageId, skillCheck.request)
      }
    },
    [extractSkillCheckRequest, stripStructuredTags]
  )

  const buildStatusStateInput = useCallback(
    (): StatusStateInput => ({
      active_statuses: statusEffects
    }),
    [statusEffects]
  )

  const applyStatusUpdate = useCallback(
    (payload: StatusUpdatePayload) => {
      if (!payload) {
        return
      }
      updateStoredProfile(prev => {
        if (!prev) return prev
        const currentStatuses = prev.statusEffects || []
        const statusById = new Map(currentStatuses.map(status => [status.id, status]))

        payload.remove?.forEach(removal => {
          if (removal?.id && statusById.has(removal.id)) {
            statusById.delete(removal.id)
          }
        })

        payload.update?.forEach(update => {
          if (!update?.id) return
          const existing = statusById.get(update.id)
          if (existing) {
            statusById.set(update.id, { ...existing, ...update })
          }
        })

        const applying = payload.apply?.length ? payload.apply.slice(0, 1) : []
        applying.forEach(apply => {
          if (!apply?.id || !apply?.name) return
          if (statusById.has(apply.id)) return
          if ([...statusById.values()].some(status => status.name === apply.name)) return
          statusById.set(apply.id, apply)
        })

        const nextStatuses = Array.from(statusById.values())

        return {
          ...prev,
          statusEffects: nextStatuses
        }
      })
    },
    [updateStoredProfile]
  )

  const maybeUpdateStatusEffects = useCallback(
    async (history: ChatMessage[]) => {
      if (statusUpdateInFlightRef.current) {
        return
      }
      statusUpdateInFlightRef.current = true
      try {
        const payload = await getStatusUpdate(history, buildStatusStateInput())
        applyStatusUpdate(payload)
      } catch (error) {
        console.error('Failed to update status effects:', error)
      } finally {
        statusUpdateInFlightRef.current = false
      }
    },
    [applyStatusUpdate, buildStatusStateInput]
  )

  useEffect(() => {
    if (!campaignId || !characterProfile || openingGeneratedRef.current) {
      return
    }
    openingGeneratedRef.current = true
    setIsLoading(true)

    const openingPrompt =
      'Generate the opening scene of the campaign. Use the canonical starting location and time. ' +
      'Inject 1-2 backstory hooks through NPC reaction, tension, or anomalies. ' +
      'Follow the DM output format exactly: Dungeon Master line, scene header line, then three unnumbered paragraphs. ' +
      'No bullets, no questions, no meta.'

    getDMResponse(
      openingPrompt,
      {
        name: characterProfile?.name,
        class: characterProfile?.class,
        appearance: characterProfile?.appearance,
        backstory: characterProfile?.backstory,
        backstorySummary: characterProfile?.backstorySummary,
        stats,
        quests
      },
      buildGameContext(),
      [],
      { campaignId, playerSnapshot: { hp: resources.hp, mp: resources.mp } }
    )
      .then(dmResponse => {
        const updatedHistory: ChatMessage[] = [{ role: 'assistant', content: dmResponse.response }]
        setChatHistory(updatedHistory)
        void maybeSummarizeHistory(updatedHistory)
        void maybeUpdateStatusEffects(updatedHistory)
        clearSystemNotices()
        handleDMResponseOutput(dmResponse)
      })
      .catch(error => {
        openingGeneratedRef.current = false
        console.error('Failed to generate opening scene:', error)
        pushSystemMessage(error?.message || 'The opening scene could not be generated. Try again.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [
    buildGameContext,
    campaignId,
    characterProfile,
    clearSystemNotices,
    handleDMResponseOutput,
    maybeSummarizeHistory,
    pushSystemMessage,
    quests,
    resources.hp,
    resources.mp,
    stats
  ])

  const continueStoryAfterRoll = useCallback(
    async (payload: {
      messageId: string
      request: SkillCheckRequest
      d20: number
      bonus: number
      total: number
      success: boolean
    }) => {
      setIsLoading(true)
      tickCooldowns()
      try {
        const pendingCheckId = pendingCheckByMessageRef.current.get(payload.messageId)
        const followUp = `Outcome data for ${payload.request.label}: d20 ${payload.d20} + ${payload.bonus} = ${
          payload.total
        } (OUTCOME=${payload.success ? 'SUCCESS' : 'FAIL'}). Prior intent: ${
          lastPlayerActionRef.current || 'follow-up to DM prompt'
        }. Start from the outcome and world reaction. Describe ONLY the new consequences of this result. Do NOT restate the player's prior action or any preparation. Stay strictly diegetic. Do NOT mention rolls, numbers, or mechanics in narration.`

        const historyWithRoll: ChatMessage[] = [
          ...chatHistory,
          {
            role: 'user',
            content: followUp
          }
        ]
        setChatHistory(historyWithRoll)

        const dmResponse = await getDMResponse(
          followUp,
          {
            name: characterProfile?.name,
            class: characterProfile?.class,
            appearance: characterProfile?.appearance,
            backstory: characterProfile?.backstory,
            backstorySummary: characterProfile?.backstorySummary,
            stats,
            quests
          },
          buildGameContext(),
          historyWithRoll,
          {
            campaignId,
            rollResult: {
              total: payload.total,
              success: payload.success,
              d20: payload.d20,
              bonus: payload.bonus,
              stat: payload.request.stat,
              label: payload.request.label,
              dc: payload.request.dc
            },
            pendingCheckId,
            playerSnapshot: { hp: resources.hp, mp: resources.mp }
          }
        )

        pendingCheckByMessageRef.current.delete(payload.messageId)

        const updatedHistory: ChatMessage[] = [
          ...historyWithRoll,
          {
            role: 'assistant',
            content: dmResponse.response
          }
        ]
        setChatHistory(updatedHistory)
        void maybeSummarizeHistory(updatedHistory)
        void maybeUpdateStatusEffects(updatedHistory)
        clearSystemNotices()
        handleDMResponseOutput(dmResponse)
      } catch (error: any) {
        console.error('Failed to continue story after roll:', error)
        pushSystemMessage(error?.message || 'The DM hesitates, try again in a moment.')
      } finally {
        setIsLoading(false)
      }
    },
    [
      buildGameContext,
      characterProfile,
      chatHistory,
      clearSystemNotices,
      handleDMResponseOutput,
      maybeSummarizeHistory,
      maybeUpdateStatusEffects,
      pushSystemMessage,
      quests,
      resources.hp,
      resources.mp,
      stats,
      tickCooldowns
    ]
  )

  const startInlineRoll = useCallback(
    (messageId: string, request: SkillCheckRequest) => {
      if (rollStartedRef.current.has(messageId)) {
        return
      }
      rollStartedRef.current.add(messageId)

      const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const startedAt = Date.now()

      updateMessageRoll(messageId, {
        status: 'rolling',
        request,
        seed,
        startedAt
      })

      const modifierInfo = getModifierFromLabel(request.label, request.stat)
      const statBonus = modifierInfo?.modifier ?? 0
      const proficiencyBonus = shouldApplyProficiency(request)
        ? getProficiencyBonus(level)
        : 0
      const bonus = statBonus + proficiencyBonus
      const rollDuration = 850 + Math.floor(Math.random() * 350)

      const rollPromise = rollD20(bonus).catch(() => {
        const fallback = Math.floor(Math.random() * 20) + 1
        return {
          result: fallback,
          rolls: [fallback],
          total: fallback + bonus
        }
      })

      window.setTimeout(() => {
        void rollPromise.then(resolved => {
          const d20 = resolved.rolls?.[0] ?? resolved.result ?? Math.floor(Math.random() * 20) + 1
          const total = typeof resolved.total === 'number' ? resolved.total : d20 + bonus
          const success =
            typeof request.dc === 'number'
              ? total >= request.dc
              : total >= MIN_SUCCESS_THRESHOLD

          updateMessageRoll(messageId, {
            status: 'done',
            request,
            d20,
            bonus,
            statBonus,
            proficiencyBonus,
            total,
            success,
            resolvedAt: Date.now()
          })
          void continueStoryAfterRoll({
            messageId,
            request,
            d20,
            bonus,
            total,
            success
          })
        })
      }, rollDuration)
    },
    [
      continueStoryAfterRoll,
      getModifierFromLabel,
      getProficiencyBonus,
      level,
      shouldApplyProficiency,
      updateMessageRoll
    ]
  )
  startInlineRollRef.current = startInlineRoll

  const renderGlowInline = useCallback((text: string, keyPrefix: string): ReactNode[] => {
    if (!text) return []
    const segments: ReactNode[] = []
    let lastIndex = 0
    const combinedRegex =
      /<glow([^>]*)>([\s\S]*?)<\/glow>|<span\s+class="([^"]*\bhl\b[^"]*)"\s*>([\s\S]*?)<\/span>/gi
    let match: RegExpExecArray | null
    while ((match = combinedRegex.exec(text)) !== null) {
      const [fullMatch, glowAttrs, glowBody, hlClass, hlBody] = match
      const startIndex = match.index ?? 0
      if (startIndex > lastIndex) {
        segments.push(text.slice(lastIndex, startIndex))
      }

      if (hlClass && hlBody !== undefined) {
        const safeClasses = hlClass
          .split(/\s+/)
          .map(token => token.trim())
          .filter(token => token === 'hl' || token.startsWith('hl-'))
          .join(' ')
        segments.push(
          <span key={`${keyPrefix}-hl-${startIndex}`} className={`hl ${safeClasses}`.trim()}>
            {hlBody}
          </span>
        )
      } else if (glowBody !== undefined) {
        const attrs = parseGlowAttributes(glowAttrs || '')
        const type = attrs.type ? attrs.type.toLowerCase().replace(/[^a-z0-9_-]/g, '') : ''
        const typeClass = type ? `glow-${type}` : ''
        segments.push(
          <span key={`${keyPrefix}-glow-${startIndex}`} className={`glow-text ${typeClass}`.trim()}>
            {glowBody}
          </span>
        )
      }
      lastIndex = startIndex + fullMatch.length
    }
    if (lastIndex < text.length) {
      segments.push(text.slice(lastIndex))
    }
    if (!segments.length) {
      segments.push(text)
    }
    GLOW_TAG_REGEX.lastIndex = 0
    HIGHLIGHT_TAG_REGEX.lastIndex = 0
    return segments
  }, [])

  const renderQuotedLine = useCallback((line: string, keyPrefix: string): ReactNode[] => {
    const segments: ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    const quoteRegex = /["“]([^"”]+)["”]/g
    while ((match = quoteRegex.exec(line)) !== null) {
      const startIndex = match.index ?? 0
      if (startIndex > lastIndex) {
        segments.push(renderGlowInline(line.slice(lastIndex, startIndex), `${keyPrefix}-text`))
      }
      const quoted = match[0]
      segments.push(
        <span key={`${keyPrefix}-quote-${startIndex}`} className="npc-dialogue npc-dialogue-fallback">
          {quoted}
        </span>
      )
      lastIndex = startIndex + quoted.length
    }
    if (lastIndex < line.length) {
      segments.push(renderGlowInline(line.slice(lastIndex), `${keyPrefix}-tail`))
    }
    return segments.length ? segments : [renderGlowInline(line, `${keyPrefix}-plain`)]
  }, [renderGlowInline])

  const renderPlainTextSegment = useCallback(
    (text: string, key: string): ReactNode => {
      if (!text) return null
      const cleanedText = text
        .replace(/<npc\s+id="[^"]+"[^>]*>/gi, '')
        .replace(/<\/npc>/gi, '')
      const lines = cleanedText
        .split('\n')
        .map(line =>
          line
            .replace(/^\s*[*•]\s+/, '')
            .replace(/\*\"/g, '"')
            .replace(/\"\*/g, '"')
            .replace(/^\s*\*\s*/, '')
            .replace(/\s*\*\s*$/, '')
        )
      return (
        <span key={key} className="message-text">
          {lines.map((line, index) => (
            <span key={`${key}-${index}`}>
              {renderQuotedLine(line, `${key}-${index}`)}
              {index < lines.length - 1 && <br />}
            </span>
          ))}
        </span>
      )
    },
    [renderQuotedLine]
  )

  /*
  const DiceRollHeader = ({ roll }: { roll: RollState }) => {
    const [displayValue, setDisplayValue] = useState<number>(() => {
      if (roll.status === 'done') {
        return roll.d20
      }
      return Math.floor(Math.random() * 20) + 1
    })
    const [showBonus, setShowBonus] = useState(false)
    const [showResult, setShowResult] = useState(false)

    useEffect(() => {
      if (roll.status !== 'rolling') {
        return
      }
      setShowBonus(false)
      setShowResult(false)
      const interval = window.setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 20) + 1)
      }, 60)
      return () => window.clearInterval(interval)
    }, [roll.status, 'startedAt' in roll ? roll.startedAt : 0])

    useEffect(() => {
      if (roll.status !== 'done') {
        return
      }
      setDisplayValue(roll.d20)
      setShowBonus(false)
      setShowResult(false)
      const bonusTimer = window.setTimeout(() => setShowBonus(true), 200)
      const resultTimer = window.setTimeout(() => setShowResult(true), 500)
      return () => {
        window.clearTimeout(bonusTimer)
        window.clearTimeout(resultTimer)
      }
    }, [roll.status, 'resolvedAt' in roll ? roll.resolvedAt : 0, 'd20' in roll ? roll.d20 : 0])

    if (roll.status === 'idle') {
      return null
    }

    const title = `${roll.request.stat} • ${roll.request.label}`
    const badge =
      roll.status === 'rolling' || roll.status === 'pending'
        ? `Rolling... ${displayValue}`
        : roll.request.dc
        ? `${roll.success ? 'SUCCESS' : 'FAIL'} • ${roll.total}/${roll.request.dc}`
        : `Total: ${roll.total}`

    return (
      <div className="roll-header">
        <div className="roll-header-title">{title}</div>
        <div className={`roll-header-badge ${roll.status}`}>
          {badge}
        </div>
        {roll.status === 'done' && (
          <div className="roll-header-details">
            <span className={`roll-header-bonus ${showBonus ? 'show' : ''}`}>
              {roll.bonus >= 0 ? '+' : ''}{roll.bonus}
            </span>
            <span className={`roll-header-total ${showBonus ? 'show' : ''}`}>
              Total {roll.total}
            </span>
            <span className={`roll-header-result ${showResult ? 'show' : ''} ${roll.success ? 'success' : 'fail'}`}>
              {roll.success ? 'SUCCESS' : 'FAIL'}
            </span>
          </div>
        )}
      </div>
    )
  }

  */

  const DiceRollHeader = ({ roll }: { roll: RollState }) => {
    const [displayValue, setDisplayValue] = useState<number>(() => {
      if (roll.status === 'done') {
        return roll.d20
      }
      return Math.floor(Math.random() * 20) + 1
    })
    const [showStatBonus, setShowStatBonus] = useState(false)
    const [showProfBonus, setShowProfBonus] = useState(false)
    const [showTotal, setShowTotal] = useState(false)
    const [showResult, setShowResult] = useState(false)

    useEffect(() => {
      if (roll.status !== 'rolling') {
        return
      }
      setShowStatBonus(false)
      setShowProfBonus(false)
      setShowTotal(false)
      setShowResult(false)
      const interval = window.setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 20) + 1)
      }, 50)
      return () => window.clearInterval(interval)
    }, [roll.status, 'startedAt' in roll ? roll.startedAt : 0])

    useEffect(() => {
      if (roll.status !== 'done') {
        return
      }
      setDisplayValue(roll.d20)
      setShowStatBonus(false)
      setShowProfBonus(false)
      setShowTotal(false)
      setShowResult(false)
      const statTimer = window.setTimeout(() => setShowStatBonus(true), 120)
      const profTimer = window.setTimeout(() => setShowProfBonus(true), 320)
      const totalTimer = window.setTimeout(() => setShowTotal(true), 520)
      const resultTimer = window.setTimeout(() => setShowResult(true), 720)
      return () => {
        window.clearTimeout(statTimer)
        window.clearTimeout(profTimer)
        window.clearTimeout(totalTimer)
        window.clearTimeout(resultTimer)
      }
    }, [roll.status, 'resolvedAt' in roll ? roll.resolvedAt : 0, 'd20' in roll ? roll.d20 : 0])

    if (roll.status === 'idle') {
      return null
    }

    const dcLabel = roll.request.dc ? `DC ${roll.request.dc}` : 'DC ?'
    const statLine =
      roll.status === 'done'
        ? `${roll.statBonus >= 0 ? '+' : ''}${roll.statBonus} ${roll.request.stat}`
        : ''
    const profLine =
      roll.status === 'done'
        ? `${roll.proficiencyBonus >= 0 ? '+' : ''}${roll.proficiencyBonus} Proficiency`
        : ''

    return (
      <div className={`roll-inline ${roll.status}`}>
        <div className="roll-inline-header">
          <div className="roll-inline-title">{roll.request.label}</div>
          <div className="roll-inline-meta">
            <span>{roll.request.stat}</span>
            <span className="roll-inline-dot">·</span>
            <span>{dcLabel}</span>
          </div>
        </div>
        <div className="roll-inline-number">
          <span className={`roll-inline-value ${roll.status === 'rolling' ? 'flicker' : ''}`}>
            {displayValue}
          </span>
        </div>
        {roll.status === 'done' && (
          <>
            <div className="roll-inline-breakdown">
              <span className={`roll-inline-line ${showStatBonus ? 'show' : ''}`}>
                {statLine}
              </span>
              <span className={`roll-inline-line ${showProfBonus ? 'show' : ''}`}>
                {profLine}
              </span>
              <span className={`roll-inline-line ${showTotal ? 'show' : ''}`}>
                Total {roll.total}
              </span>
            </div>
            <div
              className={`roll-inline-result ${showResult ? 'show' : ''} ${
                roll.success ? 'success' : 'fail'
              }`}
            >
              {roll.success ? 'SUCCESS' : 'FAIL'}
            </div>
          </>
        )}
      </div>
    )
  }

  const resolvePaletteEntry = useCallback(
    (paletteId: string | undefined, keySeed: string): NPCPaletteEntry => {
      if (paletteId && npcPaletteById[paletteId]) {
        return npcPaletteById[paletteId]
      }
      const list = npcPaletteList.length ? npcPaletteList : DEFAULT_NPC_PALETTE
      const index = hashString(keySeed) % list.length
      return list[index] || DEFAULT_NPC_PALETTE[0]
    },
    [npcPaletteById, npcPaletteList]
  )

  const npcRegistryByName = useMemo(() => {
    const entries = Object.values(npcRegistryById)
    return entries.reduce<Record<string, NPCRegistryEntry>>((acc, entry) => {
      const normalized = normalizeNpcName(entry.name)
      if (normalized && !acc[normalized]) {
        acc[normalized] = entry
      }
      return acc
    }, {})
  }, [npcRegistryById])

  const renderCharacterSegment = useCallback(
    (name: string, _color: string, text: string, key: string): ReactNode => {
      const normalized = normalizeNpcName(name)
      const registryEntry = normalized ? npcRegistryByName[normalized] : undefined
      const paletteEntry = resolvePaletteEntry(
        registryEntry?.dialogueColorId,
        registryEntry?.id || normalized || name
      )
      const style = {
        '--npc-dialogue-color': paletteEntry.color,
        '--npc-dialogue-glow': paletteEntry.glow || 'none'
      } as CSSProperties
      return (
        <span key={key} className="character-line dm-dialogue npcDialogue" style={style}>
          {renderPlainTextSegment(text, `${key}-segment`)}
        </span>
      )
    },
    [npcRegistryByName, renderPlainTextSegment, resolvePaletteEntry]
  )

  const renderNpcDialogueSegment = useCallback(
    (npcId: string, text: string, key: string): ReactNode => {
      const entry = npcRegistryById[npcId]
      const paletteEntry = resolvePaletteEntry(entry?.dialogueColorId, npcId)
      const style: CSSProperties = {
        '--npc-dialogue-color': paletteEntry.color,
        '--npc-dialogue-glow': paletteEntry.glow || 'none'
      } as CSSProperties
      return (
        <span key={key} className="npc-dialogue" style={style}>
          {renderPlainTextSegment(text, `${key}-segment`)}
        </span>
      )
    },
    [npcRegistryById, renderPlainTextSegment, resolvePaletteEntry]
  )

  const renderMessageContent = useCallback(
    (content: string) => {
      if (!content) return null
      const normalizedContent = content
        .replace(/<\s*npc/gi, '<npc')
        .replace(/<\/\s*npc\s*>/gi, '</npc>')
      const npcMatches = Array.from(normalizedContent.matchAll(NPC_TAG_REGEX))
      if (npcMatches.length) {
        const segments: ReactNode[] = []
        let lastIndex = 0

        npcMatches.forEach((match, idx) => {
          const [fullMatch, npcId, body] = match
          const startIndex = match.index ?? 0

          if (startIndex > lastIndex) {
            segments.push(
              renderPlainTextSegment(content.slice(lastIndex, startIndex), `npc-text-${lastIndex}-${idx}`)
            )
          }

          segments.push(
            renderNpcDialogueSegment(npcId, body, `npc-${idx}-${startIndex}`)
          )
          lastIndex = startIndex + fullMatch.length
        })

        if (lastIndex < normalizedContent.length) {
          segments.push(renderPlainTextSegment(normalizedContent.slice(lastIndex), `npc-tail-${lastIndex}`))
        }

        return segments
      }

      const matches = Array.from(normalizedContent.matchAll(CHARACTER_TAG_REGEX))
      if (!matches.length) {
        return renderPlainTextSegment(normalizedContent, `plain-${normalizedContent.length}`)
      }

      const segments: ReactNode[] = []
      let lastIndex = 0

      matches.forEach((match, idx) => {
        const [fullMatch, name, color, body] = match
        const startIndex = match.index ?? 0

        if (startIndex > lastIndex) {
          segments.push(
            renderPlainTextSegment(normalizedContent.slice(lastIndex, startIndex), `text-${lastIndex}-${idx}`)
          )
        }

        segments.push(renderCharacterSegment(name, color, body, `character-${idx}-${startIndex}`))
        lastIndex = startIndex + fullMatch.length
      })

      if (lastIndex < normalizedContent.length) {
        segments.push(renderPlainTextSegment(normalizedContent.slice(lastIndex), `tail-${lastIndex}`))
      }

      return segments
    },
    [renderPlainTextSegment, renderCharacterSegment, renderNpcDialogueSegment]
  )

  const handleSendMessage = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault()
      const trimmedInput = inputValue.trim()
      if (!trimmedInput || isLoading) {
        return
      }
      tickCooldowns()

      lastPlayerActionRef.current = trimmedInput
      setInputValue('')

      const playerMessage: Message = {
        id: createMessageId(),
        type: 'player',
        content: trimmedInput,
        timestamp: new Date(),
        roll: { status: 'idle' }
      }

      lastPlayerMessageIdRef.current = playerMessage.id
      setMessages(prev => [...prev, playerMessage])
      setIsLoading(true)

      try {
        const historyWithPlayer: ChatMessage[] = [
          ...chatHistory,
          { role: 'user', content: trimmedInput }
        ]
        setChatHistory(historyWithPlayer)

        const dmResponse = await getDMResponse(
          trimmedInput,
          {
            name: characterProfile?.name,
            class: characterProfile?.class,
            appearance: characterProfile?.appearance,
            backstory: characterProfile?.backstory,
            backstorySummary: characterProfile?.backstorySummary,
            stats,
            quests
          },
          buildGameContext(),
          historyWithPlayer,
          { campaignId, playerSnapshot: { hp: resources.hp, mp: resources.mp } }
        )

        const updatedHistory: ChatMessage[] = [
          ...historyWithPlayer,
          { role: 'assistant', content: dmResponse.response }
        ]
        setChatHistory(updatedHistory)
        void maybeSummarizeHistory(updatedHistory)
        void maybeUpdateStatusEffects(updatedHistory)
        clearSystemNotices()
        handleDMResponseOutput(dmResponse)
      } catch (error: any) {
        console.error('Failed to reach DM:', error)
        pushSystemMessage(error?.message || 'The weave is silent. Please try again.')
      } finally {
        setIsLoading(false)
      }
    },
    [
      inputValue,
      isLoading,
      characterProfile,
      stats,
      quests,
      buildGameContext,
      handleDMResponseOutput,
      chatHistory,
      maybeSummarizeHistory,
      maybeUpdateStatusEffects,
      clearSystemNotices,
      pushSystemMessage,
      tickCooldowns,
      resources.hp,
      resources.mp
    ]
  )

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        void handleSendMessage()
      }
    },
    [handleSendMessage]
  )
  const renderSidebarContent = () => {
    switch (activeSidebar) {
      case 'quests':
        return (
          <>
            <h3>Quest Log</h3>
            <div className="quest-list">
              {quests.length ? (
                quests.map(quest => (
                  <div
                    key={quest.id}
                    className={`quest-card expandable ${expandedQuestIds.has(quest.id) ? 'open' : ''} ${quest.status === 'completed' ? 'completed' : quest.status === 'failed' ? 'failed' : ''}`}
                  >
                    <button
                      type="button"
                      className="expandable-header"
                      onClick={() => toggleExpanded(setExpandedQuestIds, quest.id)}
                    >
                      <div>
                        <h4>{quest.title}</h4>
                        <span className="quest-status">
                          {quest.status.charAt(0).toUpperCase() + quest.status.slice(1)}
                        </span>
                      </div>
                      <span className="quest-xp">{quest.xp} XP</span>
                    </button>
                    {expandedQuestIds.has(quest.id) && (
                      <div className="expandable-body">
                        <p className="quest-description">{quest.description}</p>
                        {quest.objectives?.length ? (
                          <ul className="quest-objectives">
                            {(() => {
                              const status = quest.objectiveStatus || quest.objectives!.map(() => false)
                              const firstIncomplete = status.findIndex(done => !done)
                              const lastVisible = firstIncomplete === -1 ? status.length - 1 : firstIncomplete
                              return quest.objectives!
                                .slice(0, lastVisible + 1)
                                .map((objective, index) => (
                                  <li key={`${quest.id}-obj-${index}`}>
                                    <div className="objective-item">
                                      <span className={`objective-indicator ${status[index] ? 'done' : ''}`} />
                                      <span>{objective}</span>
                                    </div>
                                  </li>
                                ))
                            })()}
                          </ul>
                        ) : null}
                        {quest.log?.length ? (
                          <div className="quest-log">
                            {quest.log.map((entry, idx) => (
                              <p key={`${quest.id}-log-${idx}`}>{entry}</p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="empty-text">No quests recorded yet.</p>
              )}
            </div>
          </>
        )
      case 'rumors':
        return (
          <>
            <h3>Rumors</h3>
            <div className="quest-list">
              {rumors.length ? (
                rumors.map(rumor => (
                  <div
                    key={rumor.id}
                    className={`quest-card expandable ${expandedRumorIds.has(rumor.id) ? 'open' : ''}`}
                  >
                    <button
                      type="button"
                      className="expandable-header"
                      onClick={() => toggleExpanded(setExpandedRumorIds, rumor.id)}
                    >
                      <h4>{rumor.title}</h4>
                      <span className="quest-xp">Unverified</span>
                    </button>
                    {expandedRumorIds.has(rumor.id) && (
                      <div className="expandable-body">
                        <p className="quest-description">{rumor.detail}</p>
                        {rumor.log?.length ? (
                          <div className="quest-log">
                            {rumor.log.map((entry, idx) => (
                              <p key={`${rumor.id}-log-${idx}`}>{entry}</p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="empty-text">No rumors collected.</p>
              )}
            </div>
          </>
        )
      case 'stats':
        return (
          <>
            <h3>Character Stats</h3>
            <div className="stats-grid">
              {Object.entries(stats).map(([stat, value]) => (
                <div className="stat-item" key={stat}>
                  <span className="stat-label">{stat.slice(0, 3).toUpperCase()}</span>
                  <span className="stat-value">{value}</span>
                </div>
              ))}
            </div>
            <div className="stats-other">
              <div className="inventory-item">
                <div>
                  <strong>Level</strong>
                  <p>{level}</p>
                </div>
                <div>
                  <strong>XP</strong>
                  <p>
                    {xp} / {nextThreshold}
                  </p>
                </div>
              </div>
              <div className="inventory-item status-card">
                <div>
                  <strong>Status</strong>
                  <p>{statusEffects.length ? 'Active' : 'None'}</p>
                </div>
                {statusEffects.length ? (
                  <div className="effects-list">
                    {statusEffects.map(effect => (
                      <button
                        key={effect.id}
                        type="button"
                        className="effect-tag"
                        onClick={() =>
                          setActiveStatusName(prev => (prev === effect.id ? null : effect.id))
                        }
                      >
                        {effect.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className={`status-detail${activeStatusName ? ' active' : ''}`}>
                  {(() => {
                    if (!activeStatusName) {
                      return null
                    }
                    const match = statusEffects.find(effect => effect.id === activeStatusName)
                    if (!match) {
                      return null
                    }
                    const severityLabel =
                      match.severity && match.id === 'exhaustion'
                        ? `Level: ${match.severity}`
                        : match.severity && match.id === 'corruption'
                        ? `Tier: ${match.severity}`
                        : match.severity
                        ? `Severity: ${match.severity}`
                        : ''
                    const formatModifiers = (modifiers?: StatusEffect['modifiers']) => {
                      if (!modifiers) return ''
                      const parts = Object.entries(modifiers)
                        .filter(([, value]) => value)
                        .map(([key, value]) => `${key}: ${value}`)
                      return parts.length ? `Modifiers: ${parts.join(', ')}` : ''
                    }

                    const formatRestrictions = (restrictions?: StatusEffect['restrictions']) => {
                      if (!restrictions) return ''
                      const parts = Object.entries(restrictions)
                        .filter(([, value]) => value !== undefined)
                        .map(([key, value]) => `${key}: ${value}`)
                      return parts.length ? `Restrictions: ${parts.join(', ')}` : ''
                    }

                    const cues =
                      match.narrationCues && match.narrationCues.length
                        ? `Cues: ${match.narrationCues.join(', ')}`
                        : ''

                    const detailParts = [
                      severityLabel,
                      match.mechanics ? `Mechanics: ${match.mechanics}` : '',
                      match.trigger ? `Trigger: ${match.trigger}` : '',
                      formatModifiers(match.modifiers),
                      formatRestrictions(match.restrictions),
                      cues,
                      match.duration
                        ? `Duration: ${match.duration.type}${match.duration.value ? ` ${match.duration.value}` : ''}`
                        : '',
                      match.source ? `Source: ${match.source}` : '',
                      match.cure ? `Cure: ${match.cure}` : ''
                    ].filter(Boolean)
                    return detailParts.join(' ')
                  })()}
                </div>
              </div>
            </div>
          </>
        )
      case 'inventory':
        return (
          <>
            <h3>Inventory</h3>
            {inventoryItems.length ? (
              <div className="inventory-list">
                {inventoryItems.map(item => (
                  <button
                    type="button"
                    key={item.id}
                    className={`inventory-item expandable ${selectedItemId === item.id ? 'open' : ''}`}
                    onClick={() => setSelectedItemId(prev => (prev === item.id ? null : item.id))}
                  >
                    <div>
                      <strong>{item.name}</strong>
                      <p className="item-tags">{item.tags.join(', ')}</p>
                    </div>
                    <span className="item-count">{item.consumable ? 'Use' : 'Inspect'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty-text">No equipment recorded.</p>
            )}
            {selectedItemId && (
              <div className="details-panel">
                {(() => {
                  const item = inventoryItems.find(entry => entry.id === selectedItemId)
                  if (!item) return null
                  return (
                    <>
                      <h4>{item.name}</h4>
                      <p>{item.description}</p>
                      <div className="item-tags">
                        {item.tags.map(tag => (
                          <span key={`${item.id}-${tag}`} className="effect-tag">{tag}</span>
                        ))}
                      </div>
                      {item.consumable && (
                        <button type="button" className="roll-btn optional" onClick={() => useItem(item.id)}>
                          Use item
                        </button>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </>
        )
      case 'npcs':
        return (
          <>
            <h3>NPC Relationships</h3>
            {mergedNpcRelations.length ? (
              <div className="npc-list">
                {mergedNpcRelations.map(npc => (
                  <div key={npc.id} className={`inventory-item npc-card expandable ${expandedNpcIds.has(npc.id) ? 'open' : ''}`}>
                    <button
                      type="button"
                      className="expandable-header npc-header"
                      onClick={() => toggleExpanded(setExpandedNpcIds, npc.id)}
                    >
                      <span>{npc.name}</span>
                    </button>
                    {expandedNpcIds.has(npc.id) && (
                      <div className="expandable-body">
                        <div className="relation-bar">
                          <span className={`relation-fill tier-${getAffinityTierIndex(npc.affinity)}`} />
                          <span className="relation-label">{getAffinityBadge(npc.affinity)}</span>
                        </div>
                        {npc.notes.length ? (
                          npc.notes.map((note, index) => (
                            <p key={`${npc.id}-note-${index}`}>{note}</p>
                          ))
                        ) : (
                          <p className="empty-text">No notable exchanges yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-text">No relationships tracked yet.</p>
            )}
          </>
        )
      case 'spells':
        return (
          <>
            <h3>Spellbook &amp; Skills</h3>
            {unlockedSkills.length ? (
              <>
                <h4>Techniques</h4>
                <div className="spell-list">
                  {unlockedSkills.map(skill => (
                    <div className={`spell-item expandable ${expandedSpellIds.has(skill.id) ? 'open' : ''}`} key={skill.id}>
                      <button
                        type="button"
                        className="expandable-header"
                        onClick={() => toggleExpanded(setExpandedSpellIds, skill.id)}
                      >
                        <strong>{skill.name}</strong>
                        <span className="item-count">Ready</span>
                      </button>
                      {expandedSpellIds.has(skill.id) && (
                        <div className="expandable-body">
                          <p>{skill.description}</p>
                          <button
                            type="button"
                            className="roll-btn optional"
                            onClick={() => {
                              pushSystemMessage(`${skill.name} used.`)
                              addSystemNotice(`${skill.name} used.`)
                            }}
                          >
                            Use technique
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="empty-text">No combat techniques unlocked yet.</p>
            )}

            {unlockedSpells.length ? (
              <>
                <h4>Spells</h4>
                <div className="spell-list">
                  {unlockedSpells.map(spell => (
                    <div className={`spell-item expandable ${expandedSpellIds.has(spell.id) ? 'open' : ''} ${activeSpellId === spell.id ? 'casting' : ''}`} key={spell.id}>
                      <button
                        type="button"
                        className="expandable-header"
                        onClick={() => toggleExpanded(setExpandedSpellIds, spell.id)}
                      >
                        <strong>{spell.name}</strong>
                        <span className="item-count">
                          {spellCooldowns[spell.id] ? `CD ${spellCooldowns[spell.id]}` : 'Ready'}
                        </span>
                      </button>
                      {expandedSpellIds.has(spell.id) && (
                        <div className="expandable-body">
                          <p>{spell.description}</p>
                          <button type="button" className="roll-btn optional" onClick={() => useSpell(spell)}>
                            Cast spell
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="empty-text">No spells prepared.</p>
            )}
          </>
        )
      case 'boons':
        return (
          <>
            <h3>Artifacts &amp; Boons</h3>
            {artifacts.length ? (
              <div className="boon-list">
                {artifacts.map((artifact, index) => (
                  <div className="inventory-item" key={`${artifact}-${index}`}>
                    <span>{artifact}</span>
                    <span className="item-count">Bound</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-text">No artifacts have attuned to you yet.</p>
            )}
          </>
        )
      default:
        return null
    }
  }

  const sidebarButtons = [
    { section: 'quests' as SidebarSection, icon: BookOpen, label: 'Quests' },
    { section: 'rumors' as SidebarSection, icon: MessageCircle, label: 'Rumors' },
    { section: 'stats' as SidebarSection, icon: User, label: 'Stats' },
    { section: 'inventory' as SidebarSection, icon: Package, label: 'Inventory' },
    { section: 'npcs' as SidebarSection, icon: Users, label: 'NPCs' },
    { section: 'spells' as SidebarSection, icon: Book, label: 'Spellbook' },
    { section: 'boons' as SidebarSection, icon: Sparkles, label: 'Boons' }
  ]

  return (
    <div className="game-session">
      <aside className="left-sidebar">
        <div className="sidebar-buttons">
          {sidebarButtons.map(button => (
            <button
              key={button.section}
              className={`sidebar-btn ${activeSidebar === button.section ? 'active' : ''}`}
              onClick={() => setActiveSidebar(button.section)}
              title={button.label}
              type="button"
            >
              <button.icon size={20} />
            </button>
          ))}
        </div>
        <div className="sidebar-panel">
          <div className="sidebar-content">{renderSidebarContent()}</div>
        </div>
      </aside>

      <section className="main-content">
        {battleUiEnabled && battleState && battleState.phase !== 'ended' && (
          <div className="battle-panel">
            <div className="battle-header">
              <h4>Combat Mode - Round {battleState.round}</h4>
              <span>{battleState.phase.replace('_', ' ')}</span>
            </div>
            <div className="battle-enemies">
              {battleState.entities
                .filter(entity => entity.type === 'enemy')
                .map(enemy => (
                  <div className="battle-enemy" key={enemy.id}>
                    <strong>{enemy.name}</strong>
                    <span>{enemy.hp} / {enemy.hp_max} HP</span>
                  </div>
                ))}
            </div>
            <div className="battle-log">
              {combatEvents.slice(-4).map((event, index) => (
                <p key={`${event.type}-${index}`}>{event.type}</p>
              ))}
            </div>
          </div>
        )}

        <div className="chat-header">
          <h2>The Gilded Griffin</h2>
          <p>Campaign {campaignId || 'Solo Tale'} - Level {level} {characterProfile?.class || 'Adventurer'}</p>
        </div>

        {battleUiEnabled && battleState && battleState.phase !== 'ended' && (
          <div className="battle-panel">
            <div className="battle-header">
              <h4>Combat Mode - Round {battleState.round}</h4>
              <span>{battleState.phase.replace('_', ' ')}</span>
            </div>
            <div className="battle-enemies">
              {battleState.entities
                .filter(entity => entity.type === 'enemy')
                .map(enemy => (
                  <div className="battle-enemy" key={enemy.id}>
                    <strong>{enemy.name}</strong>
                    <span>{enemy.hp} / {enemy.hp_max} HP</span>
                  </div>
                ))}
            </div>
            <div className="battle-log">
              {combatEvents.slice(-4).map((event, index) => (
                <p key={`${event.type}-${index}`}>{event.type}</p>
              ))}
            </div>
            <div className="combat-actions">
              <button type="button" className="roll-btn optional" onClick={() => setCombatAction({ action: 'attack' })}>Attack</button>
              <button type="button" className="roll-btn optional" onClick={() => sendCombatIntent({ action: 'defend', actor: 'player' })}>Defend</button>
              <button type="button" className="roll-btn optional" onClick={() => setCombatAction({ action: 'move' })}>Move</button>
              <button type="button" className="roll-btn optional" onClick={() => setCombatAction({ action: 'item' })}>Item</button>
              <button type="button" className="roll-btn optional" onClick={() => setCombatAction({ action: 'spell' })}>Spell</button>
              <button type="button" className="roll-btn optional" onClick={() => setCombatAction({ action: 'attempt' })}>Attempt</button>
            </div>

            {combatAction.action === 'attack' && (
              <div className="combat-panel">
                <p>Choose a target:</p>
                <div className="combat-targets">
                  {getEnemyTargets().map(enemy => (
                    <button
                      key={enemy.id}
                      type="button"
                      className="roll-btn required"
                      onClick={() => sendCombatIntent({ action: 'attack', actor: 'player', target: enemy.id })}
                    >
                      {enemy.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {combatAction.action === 'move' && (
              <div className="combat-panel">
                <p>Choose movement:</p>
                <div className="combat-targets">
                  {['closer', 'farther', 'cover'].map(option => (
                    <button
                      key={option}
                      type="button"
                      className="roll-btn required"
                      onClick={() => sendCombatIntent({ action: 'move', actor: 'player', params: { move_type: option } })}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {combatAction.action === 'item' && (
              <div className="combat-panel">
                <p>Select an item:</p>
                <div className="combat-targets">
                  {inventoryItems.filter(item => item.consumable).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className="roll-btn required"
                      onClick={() => {
                        useItem(item.id)
                        sendCombatIntent({ action: 'item', actor: 'player', params: { item_id: item.id } })
                      }}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {combatAction.action === 'spell' && (
              <div className="combat-panel">
                <p>Select a spell:</p>
                <div className="combat-targets">
                  {unlockedSpells.map(spell => (
                    <button
                      key={spell.id}
                      type="button"
                      className="roll-btn required"
                      onClick={() => {
                        useSpell(spell)
                        sendCombatIntent({ action: 'spell', actor: 'player', params: { spell_id: spell.id } })
                      }}
                    >
                      {spell.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {combatAction.action === 'attempt' && (
              <div className="combat-panel">
                <p>Describe your attempt:</p>
                <textarea
                  className="combat-attempt-input"
                  rows={2}
                  value={attemptText}
                  onChange={event => setAttemptText(event.target.value)}
                />
                <div className="combat-targets">
                  {getEnemyTargets().map(enemy => (
                    <button
                      key={enemy.id}
                      type="button"
                      className="roll-btn required"
                      onClick={() =>
                        sendCombatIntent({
                          action: 'attempt',
                          actor: 'player',
                          target: enemy.id,
                          free_text: attemptText || 'attempt'
                        })
                      }
                    >
                      {enemy.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="chat-messages">
          <div className="chat-messages-inner">
            {messages.map(message => (
              <div key={message.id} className={`message ${message.type}`}>
                <div className="message-header">
                  <span className="message-type">
                    {message.type === 'dm'
                      ? 'AI Dungeon Master'
                      : message.type === 'player'
                      ? characterProfile?.name || 'You'
                      : 'System'}
                  </span>
                  <span className="message-time">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {message.type === 'dm' && message.sceneHeader && (
                  <div className="scene-header-inline">{message.sceneHeader}</div>
                )}
                <div
                  className={`message-content ${message.type === 'dm' ? 'dm-bubble dmBubble' : ''}`}
                >
                  {message.type === 'player' && message.roll && message.roll.status !== 'idle' && (
                    <DiceRollHeader roll={message.roll} />
                  )}
                  {message.type === 'dm'
                    ? renderMessageContent(message.content)
                    : renderPlainTextSegment(message.content, `${message.id}-content`)}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <form className="chat-input-container" onSubmit={handleSendMessage}>
          <textarea
            ref={inputRef}
            className="chat-input"
            rows={3}
            placeholder="Describe your action..."
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={isLoading}
          />
          <div className="input-actions">
            <button
              type="submit"
              className="send-btn"
              disabled={!inputValue.trim() || isLoading}
              aria-label="Send action"
            >
              {isLoading ? <span className="loading-spinner" /> : <Send size={18} />}
            </button>
          </div>
        </form>
      </section>

      <aside className="right-sidebar">
        <div className="player-info">
          <h3>Adventurer</h3>
            <div className="player-card">
              <div className="player-avatar">
                {resolvedAvatarUrl ? (
                  <img src={resolvedAvatarUrl} alt={`${characterProfile?.name || 'Player'} avatar`} />
                ) : (
                  <span>{characterProfile?.name?.charAt(0) || '?'}</span>
                )}
              </div>
            <div className="player-details">
              <h4>{characterProfile?.name || 'Unnamed Hero'}</h4>
              <p>{characterProfile?.class || 'Wanderer'}</p>
            </div>
            <div className="player-stats">
              <div className="stat-bar">
                <span className="stat-label">HP</span>
                <div className="bar-container">
                  <div className="bar hp-bar" style={{ width: '100%' }} />
                </div>
                <span className="stat-value">{resources.hp}</span>
              </div>
              <div className="stat-bar">
                <span className="stat-label">MP</span>
                <div className="bar-container">
                  <div className="bar mp-bar" style={{ width: '100%' }} />
                </div>
                <span className="stat-value">{resources.mp}</span>
              </div>
              <div className="stat-bar">
                <span className="stat-label">XP</span>
                <div className="bar-container">
                  <div className="bar xp-bar" style={{ width: `${xpProgress}%` }} />
                </div>
                <span className="stat-value">
                  {xp} / {nextThreshold}
                </span>
              </div>
            </div>
            <div className="status-effects">
              <span className="status-label">Unlocked Abilities</span>
              <div className="effects-list">
                {unlockedAbilities.length ? (
                  unlockedAbilities.slice(0, 4).map(ability => (
                    <span className="effect-tag" key={ability.id}>
                      {ability.name}
                    </span>
                  ))
                ) : (
                  <span className="effect-tag">None yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

export default GameSession
