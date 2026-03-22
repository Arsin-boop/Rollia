
import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Check,
  Shield,
  User,
  Package,
  Users,
  X,
} from 'lucide-react'
import {
  API_ORIGIN,
  resetSession,
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
import { useEmberCanvas } from '../hooks/useEmberCanvas'
import { useStreamingDM, type StreamingMeta } from '../hooks/useStreamingDM'
import { useAmbientAudio } from '../hooks/useAmbientAudio'
import { CombatTracker } from '../components/game/CombatTracker'
import { useI18n } from '../i18n'
import type { CharacterStats, InventoryItem } from '../types/character'

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

type SidebarSection = 'journal' | 'stats' | 'loadout' | 'social'
type LoadoutTab = 'inventory' | 'spells'

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

type PersistedCampaignState = {
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

const DEFAULT_STATS: CharacterStats = {
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
const TEMPLATE_CHARACTER_STORAGE_KEY = 'character'
const ACTIVE_CAMPAIGN_KEY = 'activeCampaignId'
const CAMPAIGN_STATE_KEY_PREFIX = 'campaign_state_'
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

const sanitizeLogText = (value: string): string => {
  if (!value) return ''
  return value
    .replace(/<npc\s+id="[^"]+"[^>]*>/gi, '')
    .replace(/<\/npc>/gi, '')
    .replace(/<glow[^>]*>/gi, '')
    .replace(/<\/glow>/gi, '')
    .replace(/<\/?span[^>]*>/gi, '')
    .replace(/\[\/?(?:QUEST|RUMOR|RELATION|BATTLE)[^\]]*\]/gi, '')
    .replace(/\[EFFECT[^\]]*\]/gi, '')
    .replace(/\r/g, '')
    .trim()
}

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
const DM_DISPLAY_NAME = 'Dungeon Master'
const TYPING_DOT_FRAMES = ['', '.', '..', '...', '..', '.'] as const
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

// Map verbose time strings (EN + RU) to short labels
const SHORT_TIME_MAP: Array<[RegExp, string]> = [
  [/рассвет|восход|первый\s*свет/i, 'Рассвет'],
  [/утр/i, 'Утро'],
  [/полдень|полуден/i, 'Полдень'],
  [/день|днём|дневн/i, 'День'],
  [/закат|сумерк|вечерн.*свет/i, 'Закат'],
  [/вечер/i, 'Вечер'],
  [/ночь|ночн|полночь|полуноч/i, 'Ночь'],
  [/dawn|sunrise|first\s*light|early\s*morn/i, 'Dawn'],
  [/morn/i, 'Morning'],
  [/noon|midday|mid-?day/i, 'Noon'],
  [/after/i, 'Afternoon'],
  [/dusk|sunset|twilight|gloaming/i, 'Dusk'],
  [/even/i, 'Evening'],
  [/night|midnight|witching|dark\s*hour/i, 'Night'],
]
const shortenTime = (time: string): string => {
  for (const [pattern, label] of SHORT_TIME_MAP) {
    if (pattern.test(time)) return label
  }
  return time.trim().split(/\s+/)[0] ?? time
}

// Returns true if a location string looks like a system ID rather than a real place
const isSystemId = (loc: string) =>
  /^campaign\s*[:：]/i.test(loc) || /^\d{6,}$/.test(loc.trim())

const extractSceneHeader = (content: string) => {
  if (!content) {
    return { header: '', body: '' }
  }
  const normalized = content.replace(/\\u00B7/gi, '·')
  const lines = normalized.split('\n')
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
  const hasHeaderSeparator =
    headerCandidate.includes('·') ||
    headerCandidate.includes('•') ||
    headerCandidate.includes('|') ||
    /\s-\s/.test(headerCandidate)
  if (!headerCandidate || !hasHeaderSeparator) {
    return { header: '', body: normalized.trim() }
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

const toItemSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

const buildGeneratedLoadoutItems = (classData?: CustomClassResponse | null): InventoryItem[] => {
  if (!classData) return []

  const items: InventoryItem[] = []
  if (classData.startingWeapon?.name) {
    items.push({
      id: `weapon-${toItemSlug(classData.startingWeapon.name) || 'starter-weapon'}`,
      name: classData.startingWeapon.name,
      description:
        classData.startingWeapon.description || 'A starting weapon tailored to your class.',
      tags:
        Array.isArray(classData.startingWeapon.tags) && classData.startingWeapon.tags.length
          ? classData.startingWeapon.tags
          : ['equipment', 'weapon'],
      damage: classData.startingWeapon.damage || '1d6',
      slot: 'weapon',
      equipped: true
    })
  }
  if (classData.startingArmor?.name) {
    items.push({
      id: `armor-${toItemSlug(classData.startingArmor.name) || 'starter-armor'}`,
      name: classData.startingArmor.name,
      description:
        classData.startingArmor.description || 'A starting armor set tailored to your class.',
      tags:
        Array.isArray(classData.startingArmor.tags) && classData.startingArmor.tags.length
          ? classData.startingArmor.tags
          : ['equipment', 'armor'],
      armorClass: Number.isFinite(classData.startingArmor.armorClass)
        ? classData.startingArmor.armorClass
        : 12,
      slot: 'armor',
      equipped: true
    })
  }
  return items
}

const mergeUniqueInventoryItems = (
  baseItems: InventoryItem[],
  extraItems: InventoryItem[]
): InventoryItem[] => {
  if (!extraItems.length) return baseItems
  const merged = [...baseItems]
  const existing = new Set(
    baseItems.map(item => `${item.name || ''}`.trim().toLowerCase()).filter(Boolean)
  )
  extraItems.forEach(item => {
    const key = (item.name || '').trim().toLowerCase()
    if (!key || existing.has(key)) return
    existing.add(key)
    merged.push(item)
  })
  return merged
}

const mergeUniqueEquipment = (baseEquipment: string[], items: InventoryItem[]): string[] => {
  const names = items.map(item => item.name).filter(Boolean)
  if (!names.length) return baseEquipment
  const existing = new Set(baseEquipment.map(item => item.trim().toLowerCase()).filter(Boolean))
  const merged = [...baseEquipment]
  names.forEach(name => {
    const key = name.trim().toLowerCase()
    if (!key || existing.has(key)) return
    existing.add(key)
    merged.push(name)
  })
  return merged
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
  if (!name) return ''
  const lowered = name.toLowerCase()
  if (/\bcorin\b/.test(lowered) || lowered.includes('корин')) {
    return 'corin'
  }
  return name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s]/g, '')
    .replace(/\bthe\b/g, '')
    .replace(/\b(barkeep|bartender|innkeeper)\b/g, '')
    .replace(/\b(трактирщик|бармен|хозяин таверны)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const canonicalNpcId = (id?: string, name?: string): string => {
  const safeId = (id || '').trim().toLowerCase()
  const safeName = (name || '').trim().toLowerCase()
  if (
    safeId === 'corin-blackbriar' ||
    /\bcorin\b/.test(safeName) ||
    safeName.includes('корин')
  ) {
    return 'corin-blackbriar'
  }
  return safeId || normalizeNpcName(name || '') || 'unknown-npc'
}


const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const parseStoredProfile = (raw: string | null): StoredCharacterProfile | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as StoredCharacterProfile
  } catch {
    return null
  }
}

const parseCampaignState = (raw: string | null): PersistedCampaignState | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as PersistedCampaignState
  } catch {
    return null
  }
}

const toTimestamp = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

const pickFreshestProfile = (
  legacyProfile: StoredCharacterProfile | null,
  templateProfile: StoredCharacterProfile | null
): StoredCharacterProfile | null => {
  if (!legacyProfile && !templateProfile) return null
  if (!legacyProfile) return templateProfile
  if (!templateProfile) return legacyProfile

  const legacyStamp = toTimestamp((legacyProfile as any).updatedAt)
  const templateStamp = toTimestamp((templateProfile as any).updatedAt)

  if (templateStamp > legacyStamp) return templateProfile
  if (legacyStamp > templateStamp) return legacyProfile

  // If timestamps are absent/equal, prefer template payload when identity differs.
  const legacyName = (legacyProfile.name || '').trim().toLowerCase()
  const templateName = (templateProfile.name || '').trim().toLowerCase()
  const legacyClass = (legacyProfile.class || '').trim().toLowerCase()
  const templateClass = (templateProfile.class || '').trim().toLowerCase()

  if (templateName && templateClass && (templateName !== legacyName || templateClass !== legacyClass)) {
    return templateProfile
  }

  return legacyProfile
}

const DiceRollHeader = ({
  roll,
  t
}: {
  roll: RollState
  t: (key: string) => string
}) => {
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
    const raf1 = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setShowResult(true))
    })
    return () => {
      window.clearTimeout(statTimer)
      window.clearTimeout(profTimer)
      window.clearTimeout(totalTimer)
      window.cancelAnimationFrame(raf1)
    }
  }, [roll.status, 'resolvedAt' in roll ? roll.resolvedAt : 0, 'd20' in roll ? roll.d20 : 0])

  if (roll.status === 'idle') {
    return null
  }

  const dcLabel = roll.request.dc ? `DC ${roll.request.dc}` : t('gameSession.dice.dcUnknown')
  const statLine =
    roll.status === 'done'
      ? `${roll.statBonus >= 0 ? '+' : ''}${roll.statBonus} ${roll.request.stat}`
      : ''
  const profLine =
    roll.status === 'done'
      ? `${roll.proficiencyBonus >= 0 ? '+' : ''}${roll.proficiencyBonus} ${t('gameSession.dice.proficiency')}`
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
              {t('gameSession.dice.total')} {roll.total}
            </span>
          </div>
          <div
            className={`roll-inline-result ${showResult ? 'show' : ''} ${roll.success ? 'success' : 'fail'
              }`}
          >
            {roll.success ? t('gameSession.dice.success') : t('gameSession.dice.fail')}
          </div>
        </>
      )}
    </div>
  )
}

const GameSession = () => {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const [messages, setMessages] = useState<Message[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [activeSidebar, setActiveSidebar] = useState<SidebarSection>('stats')
  const [activeLoadoutTab, setActiveLoadoutTab] = useState<LoadoutTab>('inventory')
  const [isLoading, setIsLoading] = useState(false)
  const [audioMuted, setAudioMuted] = useState(false)
  const [typingFrame, setTypingFrame] = useState(0)
  const [, setCharacterColors] = useState<Record<string, string>>({})
  const [npcRegistryById, setNpcRegistryById] = useState<Record<string, NPCRegistryEntry>>({})
  const [npcPaletteById, setNpcPaletteById] = useState<Record<string, NPCPaletteEntry>>(() => {
    return DEFAULT_NPC_PALETTE.reduce<Record<string, NPCPaletteEntry>>((acc, entry) => {
      acc[entry.id] = entry
      return acc
    }, {})
  })
  const [npcPaletteList, setNpcPaletteList] = useState<NPCPaletteEntry[]>(DEFAULT_NPC_PALETTE)
  const [battleState, setBattleState] = useState<CombatState | null>(null)
  const [, setCombatEvents] = useState<CombatEvent[]>([])
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
  const [expandedEquipmentItem, setExpandedEquipmentItem] = useState<string | null>(null)
  const [activeSpellId, setActiveSpellId] = useState<string | null>(null)
  const [campaignStateLoaded, setCampaignStateLoaded] = useState(false)
  const [currentLocation, setCurrentLocation] = useState('')
  const [currentTime, setCurrentTime] = useState('')
  const [openingSeed, setOpeningSeed] = useState(0)
  const battleUiEnabled = false
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fogCanvasRef = useEmberCanvas({ count: 55, spawnYFactor: 0.95 })
  const { streamDMResponse } = useStreamingDM()
  const { updateAmbience, toggleMute } = useAmbientAudio()
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
  const statusDetailLabel = useCallback(
    (kind: 'level' | 'tier' | 'severity' | 'modifiers' | 'restrictions' | 'cues' | 'mechanics' | 'trigger' | 'duration' | 'source' | 'cure') => {
      const keyByKind = {
        level: 'gameSession.statusDetail.level',
        tier: 'gameSession.statusDetail.tier',
        severity: 'gameSession.statusDetail.severity',
        modifiers: 'gameSession.statusDetail.modifiers',
        restrictions: 'gameSession.statusDetail.restrictions',
        cues: 'gameSession.statusDetail.cues',
        mechanics: 'gameSession.statusDetail.mechanics',
        trigger: 'gameSession.statusDetail.trigger',
        duration: 'gameSession.statusDetail.duration',
        source: 'gameSession.statusDetail.source',
        cure: 'gameSession.statusDetail.cure'
      } as const
      return t(keyByKind[kind])
    },
    [t]
  )

  const getQuestStatusLabel = useCallback(
    (status: QuestStatus) => t(`gameSession.questStatus.${status}`),
    [t]
  )

  const getAffinityLabel = useCallback(
    (affinity: number) => {
      const badge = getAffinityBadge(affinity)
      switch (badge) {
        case 'Hostile':
          return t('gameSession.affinity.hostile')
        case 'Wary':
          return t('gameSession.affinity.wary')
        case 'Friendly':
          return t('gameSession.affinity.friendly')
        case 'Allied':
          return t('gameSession.affinity.allied')
        default:
          return t('gameSession.affinity.neutral')
      }
    },
    [t]
  )

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
      localStorage.setItem(TEMPLATE_CHARACTER_STORAGE_KEY, JSON.stringify(profile))
      if (profile.activeCampaignId) {
        localStorage.setItem(ACTIVE_CAMPAIGN_KEY, profile.activeCampaignId)
      }
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
      const legacy = parseStoredProfile(localStorage.getItem(CHARACTER_STORAGE_KEY))
      const template = parseStoredProfile(localStorage.getItem(TEMPLATE_CHARACTER_STORAGE_KEY))
      const freshest = pickFreshestProfile(legacy, template)
      if (freshest) {
        setCharacterProfile(freshest)
        localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(freshest))
        localStorage.setItem(TEMPLATE_CHARACTER_STORAGE_KEY, JSON.stringify(freshest))
      }
    } catch (error) {
      console.error('Failed to load stored character profile:', error)
    }
  }, [])

  useEffect(() => {
    if (!campaignId) return
    localStorage.setItem(ACTIVE_CAMPAIGN_KEY, campaignId)
    const sessionKey = `session_${campaignId}`
    if (!localStorage.getItem(sessionKey)) {
      localStorage.setItem(
        sessionKey,
        JSON.stringify({
          id: campaignId,
          name: `Campaign ${campaignId}`,
          description: '',
          createdAt: new Date().toISOString()
        })
      )
    }
  }, [campaignId])

  useEffect(() => {
    if (!campaignId) return
    setCampaignStateLoaded(false)
    const storageKey = `${CAMPAIGN_STATE_KEY_PREFIX}${campaignId}`
    const stored = parseCampaignState(localStorage.getItem(storageKey))

    // If session has a characterId, make sure the loaded profile matches.
    // This catches the case where the user navigates directly via URL
    // and localStorage still holds a different character.
    const sessionMeta = (() => {
      try { return JSON.parse(localStorage.getItem(`session_${campaignId}`) || 'null') } catch { return null }
    })()
    const sessionCharacterId: string | undefined = sessionMeta?.characterId
    if (sessionCharacterId) {
      const collectionRaw = localStorage.getItem('rollia_characters_v1')
      const collection: any[] = (() => { try { return JSON.parse(collectionRaw || '[]') } catch { return [] } })()
      const linked = collection.find((c: any) => c.id === sessionCharacterId)
      if (linked) {
        const currentId = (() => { try { return JSON.parse(localStorage.getItem('character') || 'null')?.id } catch { return null } })()
        if (currentId !== sessionCharacterId) {
          // Swap to the correct character for this session
          localStorage.setItem('character', JSON.stringify(linked))
          localStorage.setItem('dnd-ai-character', JSON.stringify(linked))
          setCharacterProfile(linked)
        }
      }
    }

    if (!stored) {
      setMessages([])
      setChatHistory([])
      setSceneSummary('')
      lastSceneHeaderRef.current = ''
      openingGeneratedRef.current = false
      setCampaignStateLoaded(true)
      return
    }

    const restoredMessages: Message[] = Array.isArray(stored.messages)
      ? stored.messages.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      }))
      : []
    const restoredHistory: ChatMessage[] = Array.isArray(stored.chatHistory) ? stored.chatHistory : []
    const restoredSummary = typeof stored.sceneSummary === 'string' ? stored.sceneSummary : ''

    setMessages(restoredMessages)
    setChatHistory(restoredHistory)
    setSceneSummary(restoredSummary)
    const lastHeader = [...restoredMessages]
      .reverse()
      .find(message => message.type === 'dm' && message.sceneHeader)?.sceneHeader
    lastSceneHeaderRef.current = lastHeader || ''
    if (lastHeader) {
      setCurrentLocation(lastHeader.split('·')[0].trim())
      setCurrentTime((lastHeader.split('·')[1] || '').trim())
    }
    if (restoredMessages.length || restoredHistory.length) {
      openingGeneratedRef.current = true
    }
    setCampaignStateLoaded(true)
  }, [campaignId])

  useEffect(() => {
    if (!campaignId) return
    if (!campaignStateLoaded) return
    const storageKey = `${CAMPAIGN_STATE_KEY_PREFIX}${campaignId}`
    const payload: PersistedCampaignState = {
      messages: messages.map(message => ({
        ...message,
        timestamp: message.timestamp.toISOString()
      })),
      chatHistory,
      sceneSummary
    }
    localStorage.setItem(storageKey, JSON.stringify(payload))
  }, [campaignId, messages, chatHistory, sceneSummary, campaignStateLoaded])

  const transcriptText = useMemo(() => {
    const campaignLabel = campaignId || t('gameSession.default.soloTale')
    const lines: string[] = [
      `${t('gameSession.campaign')}: ${campaignLabel}`,
      `${t('gameSession.exportedAt')}: ${new Date().toISOString()}`,
      ''
    ]

    for (const message of messages) {
      const timeLabel = message.timestamp.toLocaleString()
      const actorLabel =
        message.type === 'dm'
          ? DM_DISPLAY_NAME
          : message.type === 'player'
            ? characterProfile?.name || t('gameSession.you')
            : t('gameSession.system')
      const content = sanitizeLogText(message.content)
      const block: string[] = [`[${timeLabel}] ${actorLabel}`]

      if (message.type === 'dm' && message.sceneHeader) {
        block.push(`${t('gameSession.scene')}: ${message.sceneHeader}`)
      }

      if (message.type === 'player' && message.roll?.status === 'done') {
        block.push(
          `${t('gameSession.check')}: ${message.roll.request.label} | ${message.roll.success ? t('gameSession.dice.success') : t('gameSession.dice.fail')
          } | ${t('gameSession.dice.total')} ${message.roll.total}`
        )
      }

      if (content) {
        block.push(content)
      }

      lines.push(block.join('\n'))
      lines.push('')
    }

    return lines.join('\n').trim()
  }, [campaignId, messages, characterProfile?.name, t])

  const handleExportTranscript = useCallback(() => {
    const campaignKey = (campaignId || 'solo').replace(/[^a-zA-Z0-9_-]+/g, '_')
    const timestamp = new Date().toISOString().replace(/[:]/g, '-')
    const fileName = `campaign-${campaignKey}-log-${timestamp}.txt`
    const blob = new Blob([transcriptText], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(url)
  }, [campaignId, transcriptText])

  useEffect(() => {
    const handleGlobalExport = () => {
      if (!messages.length) return
      handleExportTranscript()
    }
    window.addEventListener('rollia:export-log', handleGlobalExport as EventListener)
    return () => {
      window.removeEventListener('rollia:export-log', handleGlobalExport as EventListener)
    }
  }, [handleExportTranscript, messages.length])

  useEffect(() => {
    if (!campaignId || !characterProfile) return
    if (characterProfile.activeCampaignId === campaignId) return
    updateStoredProfile(prev => ({
      ...prev,
      activeCampaignId: campaignId,
      updatedAt: new Date().toISOString()
    }))
  }, [campaignId, characterProfile, updateStoredProfile])

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
          const key = canonicalNpcId(rel.id, rel.name)
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
    const generatedLoadout = buildGeneratedLoadoutItems(characterProfile.customClassData)
    const existingEquipment = characterProfile.equipment || []
    const shouldBackfillEquipment = characterProfile.equipment === undefined
    const mergedEquipment = shouldBackfillEquipment
      ? mergeUniqueEquipment(existingEquipment, generatedLoadout)
      : existingEquipment
    const shouldUpdateEquipment =
      shouldBackfillEquipment && mergedEquipment.length !== existingEquipment.length

    if (!characterProfile.inventoryItems) {
      const converted = existingEquipment.length
        ? existingEquipment.map((name, index) => ({
          id: `${name.toLowerCase().replace(/\s+/g, '-')}-${index}`,
          name,
          description: 'A trusted item from your pack.',
          tags: ['equipment']
        }))
        : []
      const mergedInventory = mergeUniqueInventoryItems(converted, generatedLoadout)
      updateStoredProfile(prev => ({
        ...prev,
        inventoryItems: mergedInventory,
        equipment: mergedEquipment
      }))
    } else {
      const mergedInventory = mergeUniqueInventoryItems(characterProfile.inventoryItems, generatedLoadout)
      const shouldUpdateInventory = mergedInventory.length !== characterProfile.inventoryItems.length
      if (shouldUpdateInventory || shouldUpdateEquipment) {
        updateStoredProfile(prev => ({
          ...prev,
          inventoryItems: mergedInventory,
          equipment: mergedEquipment
        }))
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
      .catch(() => { })
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
    summarizeBackstory(characterProfile.backstory, language)
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
  }, [characterProfile, messages.length, updateStoredProfile, language])

  useEffect(() => {
    if (!characterProfile) return
    if ((characterProfile.quests?.length || 0) > 0) return
    if (!characterProfile.backstory || questInitRef.current) return

    questInitRef.current = true
    generateQuestFromBackstory(
      characterProfile.backstory,
      characterProfile.name || t('gameSession.default.hero'),
      characterProfile.class || t('gameSession.default.adventurer'),
      language
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
  }, [characterProfile, updateStoredProfile, t, language])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (!isLoading) {
      setTypingFrame(0)
      return
    }
    const intervalId = window.setInterval(() => {
      setTypingFrame(prev => (prev + 1) % TYPING_DOT_FRAMES.length)
    }, 260)
    return () => window.clearInterval(intervalId)
  }, [isLoading])

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
      const key = canonicalNpcId(relation.id, relation.name)
      if (!base.has(key)) {
        base.set(key, { ...relation, id: key })
      }
    })
    Object.values(npcRegistryById).forEach(npc => {
      const key = canonicalNpcId(npc.id, npc.name)
      const existing = base.get(key)
      if (!existing) {
        base.set(key, {
          id: key,
          name: npc.name,
          affinity: 0,
          notes: []
        })
      } else if (npc.name && existing.name !== npc.name) {
        // Prefer the latest backend-localized NPC name for current UI language.
        base.set(key, { ...existing, name: npc.name })
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
        const key = canonicalNpcId(npc.id, npc.name)
        if (!relations.some(entry => canonicalNpcId(entry.id, entry.name) === key)) {
          relations.push({
            id: key,
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

  const handleResetCampaignText = useCallback(async () => {
    if (isLoading) return
    const confirmMessage =
      language === 'ru'
        ? 'Сбросить историю этой сессии и начать заново?'
        : 'Reset this session history and start from the beginning?'
    if (!window.confirm(confirmMessage)) {
      return
    }

    setIsLoading(true)
    try {
      const characterId = characterProfile?.id
      if (campaignId) {
        await resetSession(campaignId, characterId)
        localStorage.removeItem(`${CAMPAIGN_STATE_KEY_PREFIX}${campaignId}`)
      }
      setMessages([])
      setChatHistory([])
      setSceneSummary('')
      setInputValue('')
      setCurrentLocation('')
      setCurrentTime('')
      lastSceneHeaderRef.current = ''
      openingGeneratedRef.current = false
      setOpeningSeed(prev => prev + 1)
    } catch (error: any) {
      console.error('Failed to reset campaign:', error)
      pushSystemMessage(
        error?.message || (language === 'ru' ? 'Не удалось сбросить сессию.' : 'Failed to reset session.')
      )
    } finally {
      setIsLoading(false)
    }
  }, [campaignId, characterProfile, isLoading, language, pushSystemMessage])

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

        const notice = `${item.name} ${t('gameSession.notice.itemUsed')} (${item.effects?.hp ? `${item.effects.hp > 0 ? '+' : ''}${item.effects.hp} HP` : ''}${item.effects?.mp ? `${item.effects?.hp ? ', ' : ''}${item.effects.mp > 0 ? '+' : ''}${item.effects.mp} MP` : ''})`
        pushSystemMessage(notice)
        addSystemNotice(notice)
      }
    },
    [addSystemNotice, inventoryItems, pushSystemMessage, updateStoredProfile]
  )

  const useSpell = useCallback(
    (spell: CharacterAbility) => {
      const meta = getSpellMeta(spell)
      const cooldownRemaining = spellCooldowns[spell.id] || 0
      if (cooldownRemaining > 0) {
        pushSystemMessage(`${spell.name} ${t('gameSession.notice.spellRecovering')} (${cooldownRemaining} ${t('gameSession.turns')}).`)
        return
      }
      if (resources.mp < meta.cost) {
        pushSystemMessage(`${t('gameSession.notice.notEnoughMp')} ${spell.name}.`)
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

      const notice = `${spell.name}: ${meta.isHealing ? '+4 HP' : t('gameSession.notice.cast')} (${meta.cost} MP)`
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
        pushSystemMessage(`${t('gameSession.notice.youTakeDamage')} ${playerDamage}.`)
      }
    },
    [pushSystemMessage, updateStoredProfile]
  )

  const getEnemyTargets = useCallback(() => {
    if (!battleState) return []
    return battleState.entities.filter(entity => entity.type === 'enemy' && entity.hp > 0)
  }, [battleState])

  const buildGameContext = useCallback(
    () => {
      try {
        const segments: string[] = []
        // Location MUST be first so extractLocationFromContext() on the backend reads it correctly
        if (currentLocation) {
          segments.push(`Location: ${currentLocation}`)
        }
        if (currentTime) {
          segments.push(`Time: ${currentTime}`)
        }
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
      } catch (error) {
        console.error('buildGameContext error:', error)
        return ''
      }
    },
    [campaignId, currentLocation, currentTime, sceneSummary, statusEffects, systemNotices, characterProfile?.backstorySummary]
  )

  const sendCombatIntent = useCallback(
    async (intent: ActionIntent) => {
      if (!battleState) return
      try {
        const response = await actBattle({
          campaignId: campaignId || 'local',
          intent,
          context: buildGameContext(),
          playerSnapshot: { hp: resources.hp, mp: resources.mp },
          language
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
        pushSystemMessage(error?.message || t('gameSession.error.clashStutters'))
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
      pushSystemMessage,
      language
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
        const summary = await summarizeScene(history, language)
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
    [language]
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
        pushSystemMessage(`${t('gameSession.notice.questTracked')}: ${newQuestTitle}`)
      }

      if (xpAwarded > 0) {
        pushSystemMessage(`${t('gameSession.notice.questComplete')} ${xpAwarded} XP.`)
      }
    },
    [updateStoredProfile, pushSystemMessage]
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
        const key = canonicalNpcId(attributes.id, name)
        const existingIndex = relations.findIndex(rel => canonicalNpcId(rel.id, rel.name) === key)
        const base = existingIndex >= 0 ? relations[existingIndex] : {
          id: key,
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
          hp_max: maxResources.hp,
          mp: resources.mp,
          mp_max: maxResources.mp
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
            pushSystemMessage(t('gameSession.error.clashRefuses'))
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
            label: dmResponse.pending_check.context || t('gameSession.check'),
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
            label: dmResponse.checkRequest.context || t('gameSession.check'),
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
        const payload = await getStatusUpdate(history, buildStatusStateInput(), language)
        applyStatusUpdate(payload)
      } catch (error) {
        console.error('Failed to update status effects:', error)
      } finally {
        statusUpdateInFlightRef.current = false
      }
    },
    [applyStatusUpdate, buildStatusStateInput, language]
  )

  // Applies streaming 'done' event metadata to an existing placeholder DM message
  const applyStreamingDone = useCallback(
    (meta: StreamingMeta, dmMsgId: string, historyWithAction: ChatMessage[]) => {
      if (meta.npcRegistry?.length) {
        const registryMap = meta.npcRegistry.reduce<Record<string, NPCRegistryEntry>>((acc, entry) => {
          const key = canonicalNpcId(entry.id, entry.name)
          if (!acc[key]) acc[key] = { ...entry, id: key, dialogueColorId: entry.dialogueColorId ?? '' }
          return acc
        }, {})
        setNpcRegistryById(registryMap)
      }
      if (meta.npcPalette?.length) {
        const paletteMap = meta.npcPalette.reduce<Record<string, NPCPaletteEntry>>((acc, entry) => {
          acc[entry.id] = entry
          return acc
        }, {})
        setNpcPaletteById(paletteMap)
        setNpcPaletteList(meta.npcPalette)
      }
      setMessages(prev => prev.map(m => {
        if (m.id !== dmMsgId) return m
        const cleaned = stripNumberedParagraphs(stripStructuredTags(m.content))
        const { header: extractedHeader, body } = extractSceneHeader(cleaned)
        const sceneHeaderFromMeta =
          meta.scene?.location && meta.scene?.time
            ? `${meta.scene.location} · ${meta.scene.time}`
            : meta.scene?.location || ''
        const finalHeader = sceneHeaderFromMeta || extractedHeader
        if (finalHeader) {
          lastSceneHeaderRef.current = finalHeader
          setCurrentLocation(finalHeader.split('·')[0].trim())
          setCurrentTime((finalHeader.split('·')[1] || '').trim())
        }
        return { ...m, content: body || cleaned || m.content, sceneHeader: finalHeader || undefined }
      }))
      const updatedHistory: ChatMessage[] = [
        ...historyWithAction,
        { role: 'assistant', content: meta.narration || '' }
      ]
      setChatHistory(updatedHistory)
      void maybeSummarizeHistory(updatedHistory)
      void maybeUpdateStatusEffects(updatedHistory)
      clearSystemNotices()
      // Update ambient audio based on new scene
      updateAmbience(
        meta.scene?.location || lastSceneHeaderRef.current || '',
        meta.narration || ''
      )
      const fakeResponse = { pending_check: meta.pending_check, checkRequest: meta.checkRequest } as DMResponse
      const skillCheck = extractSkillCheckRequest(fakeResponse)
      if (skillCheck && lastPlayerMessageIdRef.current) {
        const msgId = lastPlayerMessageIdRef.current
        if (skillCheck.pendingCheckId) pendingCheckByMessageRef.current.set(msgId, skillCheck.pendingCheckId)
        startInlineRollRef.current?.(msgId, skillCheck.request)
      }
    },
    [extractSkillCheckRequest, stripStructuredTags, maybeSummarizeHistory, maybeUpdateStatusEffects, clearSystemNotices]
  )

  // Handles streaming 'pending' event (check needed before narrative)
  const applyStreamingPending = useCallback(
    (_pendingCheck: any, checkRequest: any, dmMsgId: string) => {
      setMessages(prev => prev.filter(m => m.id !== dmMsgId))
      if (checkRequest && lastPlayerMessageIdRef.current) {
        const msgId = lastPlayerMessageIdRef.current
        if (checkRequest.id) pendingCheckByMessageRef.current.set(msgId, checkRequest.id)
        const dcNum = Number(checkRequest.difficulty)
        const request: SkillCheckRequest = {
          stat: (checkRequest.stat || 'STR').toUpperCase() as Stat,
          label: checkRequest.context || t('gameSession.check'),
          dc: Number.isFinite(dcNum) ? dcNum : undefined,
          kind: checkRequest.type
        }
        startInlineRollRef.current?.(msgId, request)
      }
    },
    [t]
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

    const dmMsgId = createMessageId()
    setMessages(prev => [...prev, { id: dmMsgId, type: 'dm', content: '', timestamp: new Date(), roll: { status: 'idle' } }])

    streamDMResponse(
      {
        playerAction: openingPrompt,
        characterInfo: {
          name: characterProfile?.name,
          class: characterProfile?.class,
          appearance: characterProfile?.appearance,
          backstory: characterProfile?.backstory,
          backstorySummary: characterProfile?.backstorySummary,
          stats,
          quests
        },
        gameContext: buildGameContext(),
        history: [],
        campaignId,
        playerSnapshot: { hp: resources.hp, mp: resources.mp },
        language,
        worldState: null, npcState: null, sceneParticipants: [], selectedTarget: null
      },
      (chunk) => {
        setMessages(prev => prev.map(m =>
          m.id === dmMsgId ? { ...m, content: m.content + chunk } : m
        ))
      },
      (meta) => applyStreamingDone(meta, dmMsgId, []),
      (_pc, _cr) => { setMessages(prev => prev.filter(m => m.id !== dmMsgId)) }
    )
      .catch(error => {
        openingGeneratedRef.current = false
        console.error('Failed to generate opening scene:', error)
        setMessages(prev => prev.filter(m => m.id !== dmMsgId))
        pushSystemMessage(error?.message || t('gameSession.error.openingScene'))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [
    buildGameContext,
    campaignId,
    characterProfile,
    applyStreamingDone,
    streamDMResponse,
    pushSystemMessage,
    quests,
    resources.hp,
    resources.mp,
    stats,
    language,
    openingSeed,
    t
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
        const followUp = `Outcome data for ${payload.request.label}: d20 ${payload.d20} + ${payload.bonus} = ${payload.total
          } (OUTCOME=${payload.success ? 'SUCCESS' : 'FAIL'}). Prior intent: ${lastPlayerActionRef.current || 'follow-up to DM prompt'
          }. Start from the outcome and world reaction. Describe ONLY the new consequences of this result. Do NOT restate the player's prior action or any preparation. Stay strictly diegetic. Do NOT mention rolls, numbers, or mechanics in narration.`

        const historyWithRoll: ChatMessage[] = [
          ...chatHistory,
          {
            role: 'user',
            content: followUp
          }
        ]
        setChatHistory(historyWithRoll)

        pendingCheckByMessageRef.current.delete(payload.messageId)

        const dmMsgId = createMessageId()
        setMessages(prev => [...prev, { id: dmMsgId, type: 'dm', content: '', timestamp: new Date(), roll: { status: 'idle' } }])

        await streamDMResponse(
          {
            playerAction: followUp,
            characterInfo: {
              name: characterProfile?.name,
              class: characterProfile?.class,
              appearance: characterProfile?.appearance,
              backstory: characterProfile?.backstory,
              backstorySummary: characterProfile?.backstorySummary,
              stats,
              quests
            },
            gameContext: buildGameContext(),
            history: historyWithRoll,
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
            playerSnapshot: { hp: resources.hp, mp: resources.mp },
            language,
            worldState: null, npcState: null, sceneParticipants: [], selectedTarget: null
          },
          (chunk) => {
            setMessages(prev => prev.map(m =>
              m.id === dmMsgId ? { ...m, content: m.content + chunk } : m
            ))
          },
          (meta) => applyStreamingDone(meta, dmMsgId, historyWithRoll),
          (pc, cr) => applyStreamingPending(pc, cr, dmMsgId)
        )
      } catch (error: any) {
        console.error('Failed to continue story after roll:', error)
        pushSystemMessage(error?.message || t('gameSession.error.dmHesitates'))
      } finally {
        setIsLoading(false)
      }
    },
    [
      buildGameContext,
      characterProfile,
      chatHistory,
      applyStreamingDone,
      applyStreamingPending,
      streamDMResponse,
      pushSystemMessage,
      quests,
      resources.hp,
      resources.mp,
      stats,
      tickCooldowns,
      language,
      campaignId,
      t
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
      if (!trimmedInput || isLoading) return
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

      const historyWithPlayer: ChatMessage[] = [
        ...chatHistory,
        { role: 'user', content: trimmedInput }
      ]
      setChatHistory(historyWithPlayer)

      const dmMsgId = createMessageId()
      setMessages(prev => [...prev, { id: dmMsgId, type: 'dm', content: '', timestamp: new Date(), roll: { status: 'idle' } }])

      try {
        await streamDMResponse(
          {
            playerAction: trimmedInput,
            characterInfo: {
              name: characterProfile?.name,
              class: characterProfile?.class,
              appearance: characterProfile?.appearance,
              backstory: characterProfile?.backstory,
              backstorySummary: characterProfile?.backstorySummary,
              stats,
              quests
            },
            gameContext: buildGameContext(),
            history: historyWithPlayer,
            campaignId,
            playerSnapshot: { hp: resources.hp, mp: resources.mp },
            language,
            worldState: null, npcState: null, sceneParticipants: [], selectedTarget: null
          },
          (chunk) => {
            setMessages(prev => prev.map(m =>
              m.id === dmMsgId ? { ...m, content: m.content + chunk } : m
            ))
          },
          (meta) => applyStreamingDone(meta, dmMsgId, historyWithPlayer),
          (pc, cr) => applyStreamingPending(pc, cr, dmMsgId)
        )
      } catch (error: any) {
        console.error('handleSendMessage error:', error)
        setMessages(prev => prev.filter(m => m.id !== dmMsgId))
        pushSystemMessage(error?.message || t('gameSession.error.weaveSilent'))
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
      applyStreamingDone,
      applyStreamingPending,
      chatHistory,
      streamDMResponse,
      pushSystemMessage,
      tickCooldowns,
      resources.hp,
      resources.mp,
      language,
      campaignId,
      t
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
    const slotLabel = (slot: 'head' | 'leftHand' | 'rightHand' | 'body' | 'arms' | 'legs' | 'accessory') => {
      const labels =
        language === 'ru'
          ? {
            head: 'Голова',
            leftHand: 'Левая рука',
            rightHand: 'Правая рука',
            body: 'Тело',
            arms: 'Руки',
            legs: 'Ноги',
            accessory: 'Аксессуар'
          }
          : {
            head: 'Head',
            leftHand: 'Left Hand',
            rightHand: 'Right Hand',
            body: 'Body',
            arms: 'Arms',
            legs: 'Legs',
            accessory: 'Accessory'
          }
      return labels[slot]
    }
    const emptySlotText = language === 'ru' ? 'Пусто' : 'Empty'
    const equipmentTitle = language === 'ru' ? 'Снаряжение' : 'Equipment'
    const equipActionLabel = language === 'ru' ? 'Одеть' : 'Equip'
    const unequipActionLabel = language === 'ru' ? 'Снять' : 'Unequip'
    const damageLabel = language === 'ru' ? 'Урон' : 'DMG'
    const armorLabel = 'AC'
    const chargesLabel = language === 'ru' ? 'Заряды' : 'Charges'
    const hpLabel = 'HP'
    const mpLabel = 'MP'
    const allItemNames = [
      ...inventoryItems.map(item => item.name).filter(Boolean),
      ...equipment.filter(Boolean)
    ]
    const equipmentPool = Array.from(new Set(allItemNames))
    const equippedItemNames = Array.from(new Set(equipment.filter(Boolean)))
    const firstByKeywords = (keywords: string[], source: string[]) =>
      source.find(name => keywords.some(keyword => name.toLowerCase().includes(keyword))) || null
    const weaponName =
      inventoryItems.find(item => item.slot === 'weapon' || item.tags.some(tag => tag.toLowerCase() === 'weapon'))
        ?.name && equipment.includes(
          inventoryItems.find(item => item.slot === 'weapon' || item.tags.some(tag => tag.toLowerCase() === 'weapon'))
            ?.name || ''
        )
        ? inventoryItems.find(item => item.slot === 'weapon' || item.tags.some(tag => tag.toLowerCase() === 'weapon'))
          ?.name || null
        : firstByKeywords(['sword', 'blade', 'axe', 'mace', 'staff', 'bow', 'dagger', 'weapon', 'меч', 'клин', 'топор', 'булава', 'посох', 'лук', 'кинжал', 'оруж'], equippedItemNames)
    const armorName =
      inventoryItems.find(item => item.slot === 'armor' || item.tags.some(tag => tag.toLowerCase() === 'armor'))
        ?.name && equipment.includes(
          inventoryItems.find(item => item.slot === 'armor' || item.tags.some(tag => tag.toLowerCase() === 'armor'))
            ?.name || ''
        )
        ? inventoryItems.find(item => item.slot === 'armor' || item.tags.some(tag => tag.toLowerCase() === 'armor'))
          ?.name || null
        : firstByKeywords(['armor', 'mail', 'plate', 'robe', 'leather', 'брон', 'доспех', 'латы', 'роб'], equippedItemNames)
    const leftHandName = firstByKeywords(['shield', 'buckler', 'щит'], equippedItemNames)
    const headName = firstByKeywords(['hood', 'helm', 'helmet', 'hat', 'cap', 'шлем', 'капюш', 'шап'], equippedItemNames)
    const armsName = firstByKeywords(['gauntlet', 'glove', 'bracer', 'перчат', 'наруч'], equippedItemNames)
    const legsName = firstByKeywords(['boot', 'greaves', 'pants', 'leggings', 'сапог', 'понож', 'штаны'], equippedItemNames)
    const accessoryName = firstByKeywords(['ring', 'amulet', 'charm', 'bracelet', 'кольц', 'амулет', 'талисман', 'браслет'], equippedItemNames)
    const slotValues = {
      head: headName || emptySlotText,
      leftHand: leftHandName || emptySlotText,
      rightHand: weaponName || emptySlotText,
      body: armorName || emptySlotText,
      arms: armsName || emptySlotText,
      legs: legsName || emptySlotText,
      accessory: accessoryName || emptySlotText
    }
    const isEmptyValue = (value: string) => value === emptySlotText
    const findItemMeta = (name: string) =>
      inventoryItems.find(item => item.name.trim().toLowerCase() === name.trim().toLowerCase()) || null
    const formatItemStats = (item: InventoryItem | null): string => {
      if (!item) return ''
      const parts: string[] = []
      if (item.armorClass !== undefined) parts.push(`${armorLabel} ${item.armorClass}`)
      if (item.damage) parts.push(`${damageLabel} ${item.damage}`)
      if (item.charges !== undefined) parts.push(`${chargesLabel} ${item.charges}`)
      if (item.effects?.hp) parts.push(`${hpLabel} ${item.effects.hp > 0 ? '+' : ''}${item.effects.hp}`)
      if (item.effects?.mp) parts.push(`${mpLabel} ${item.effects.mp > 0 ? '+' : ''}${item.effects.mp}`)
      return parts.join(' · ')
    }
    const slotStats = {
      head: isEmptyValue(slotValues.head) ? '' : formatItemStats(findItemMeta(slotValues.head)),
      leftHand: isEmptyValue(slotValues.leftHand) ? '' : formatItemStats(findItemMeta(slotValues.leftHand)),
      rightHand: isEmptyValue(slotValues.rightHand) ? '' : formatItemStats(findItemMeta(slotValues.rightHand)),
      body: isEmptyValue(slotValues.body) ? '' : formatItemStats(findItemMeta(slotValues.body)),
      arms: isEmptyValue(slotValues.arms) ? '' : formatItemStats(findItemMeta(slotValues.arms)),
      legs: isEmptyValue(slotValues.legs) ? '' : formatItemStats(findItemMeta(slotValues.legs)),
      accessory: isEmptyValue(slotValues.accessory) ? '' : formatItemStats(findItemMeta(slotValues.accessory))
    }

    switch (activeSidebar) {
      case 'journal':
        return (
          <>
            <h3>{t('gameSession.questLog')}</h3>
            <div className="quest-list">
              {quests.length ? (
                quests.map(quest => (
                  <div
                    key={quest.id}
                    className={`quest-card expandable ${expandedQuestIds.has(quest.id) ? 'open' : ''} ${quest.status === 'completed' ? 'completed' : quest.status === 'failed' ? 'failed' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpanded(setExpandedQuestIds, quest.id)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 0', fontFamily: 'var(--g-font-title)', color: 'var(--g-parch-dim)', textAlign: 'left' }}
                    >
                      <div>
                        <h4>{quest.title}</h4>
                        <span className="quest-status">
                          {getQuestStatusLabel(quest.status)}
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
                <p className="empty-text">{t('gameSession.empty.noQuests')}</p>
              )}
            </div>
            <h3 className="sidebar-subheading">{t('gameSession.rumors')}</h3>
            <div className="quest-list">
              {rumors.length ? (
                rumors.map(rumor => (
                  <div
                    key={rumor.id}
                    className={`quest-card expandable ${expandedRumorIds.has(rumor.id) ? 'open' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpanded(setExpandedRumorIds, rumor.id)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 0', fontFamily: 'var(--g-font-title)', color: 'var(--g-parch-dim)', textAlign: 'left' }}
                    >
                      <h4>{rumor.title}</h4>
                      <span className="quest-xp">{t('gameSession.unverified')}</span>
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
                <p className="empty-text">{t('gameSession.empty.noRumors')}</p>
              )}
            </div>
          </>
        )
      case 'stats':
        return (
          <>
            <h3>{t('gameSession.characterStats')}</h3>
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
                  <strong>{t('gameSession.level')}</strong>
                  <p>{level}</p>
                </div>
                <div>
                  <strong>{t('gameSession.xp')}</strong>
                  <p>
                    {xp} / {nextThreshold}
                  </p>
                </div>
              </div>
              <div className="inventory-item status-card">
                <div>
                  <strong>{t('gameSession.status')}</strong>
                  <p>{statusEffects.length ? t('gameSession.active') : t('gameSession.none')}</p>
                </div>
                {statusEffects.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                    {statusEffects.map(effect => (
                      <button
                        key={effect.id}
                        type="button"
                        onClick={() =>
                          setActiveStatusName(prev => (prev === effect.id ? null : effect.id))
                        }
                        style={{ fontFamily: 'var(--g-font-title)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', border: '1px solid', borderColor: activeStatusName === effect.id ? 'var(--g-gold)' : 'var(--g-border)', color: activeStatusName === effect.id ? 'var(--g-gold)' : 'var(--g-parch-dim)', background: 'transparent', padding: '3px 10px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))' }}
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
                        ? `${statusDetailLabel('level')}: ${match.severity}`
                        : match.severity && match.id === 'corruption'
                          ? `${statusDetailLabel('tier')}: ${match.severity}`
                          : match.severity
                            ? `${statusDetailLabel('severity')}: ${match.severity}`
                            : ''
                    const formatModifiers = (modifiers?: StatusEffect['modifiers']) => {
                      if (!modifiers) return ''
                      const parts = Object.entries(modifiers)
                        .filter(([, value]) => value)
                        .map(([key, value]) => `${key}: ${value}`)
                      return parts.length ? `${statusDetailLabel('modifiers')}: ${parts.join(', ')}` : ''
                    }

                    const formatRestrictions = (restrictions?: StatusEffect['restrictions']) => {
                      if (!restrictions) return ''
                      const parts = Object.entries(restrictions)
                        .filter(([, value]) => value !== undefined)
                        .map(([key, value]) => `${key}: ${value}`)
                      return parts.length ? `${statusDetailLabel('restrictions')}: ${parts.join(', ')}` : ''
                    }

                    const cues =
                      match.narrationCues && match.narrationCues.length
                        ? `${statusDetailLabel('cues')}: ${match.narrationCues.join(', ')}`
                        : ''

                    const detailParts = [
                      severityLabel,
                      match.mechanics ? `${statusDetailLabel('mechanics')}: ${match.mechanics}` : '',
                      match.trigger ? `${statusDetailLabel('trigger')}: ${match.trigger}` : '',
                      formatModifiers(match.modifiers),
                      formatRestrictions(match.restrictions),
                      cues,
                      match.duration
                        ? `${statusDetailLabel('duration')}: ${match.duration.type}${match.duration.value ? ` ${match.duration.value}` : ''}`
                        : '',
                      match.source ? `${statusDetailLabel('source')}: ${match.source}` : '',
                      match.cure ? `${statusDetailLabel('cure')}: ${match.cure}` : ''
                    ].filter(Boolean)
                    return detailParts.join(' ')
                  })()}
                </div>
              </div>
            </div>
          </>
        )
      case 'loadout':
        return (
          <>
            <h3>{t('gameSession.loadout')}</h3>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setActiveLoadoutTab('inventory')}
                style={{ fontFamily: 'var(--g-font-title)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', border: '1px solid', borderColor: activeLoadoutTab === 'inventory' ? 'var(--g-gold)' : 'var(--g-border)', color: activeLoadoutTab === 'inventory' ? 'var(--g-gold)' : 'var(--g-parch-dim)', background: 'transparent', padding: '4px 12px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))' }}
              >
                {t('gameSession.inventory')}
              </button>
              <button
                type="button"
                onClick={() => setActiveLoadoutTab('spells')}
                style={{ fontFamily: 'var(--g-font-title)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', border: '1px solid', borderColor: activeLoadoutTab === 'spells' ? 'var(--g-gold)' : 'var(--g-border)', color: activeLoadoutTab === 'spells' ? 'var(--g-gold)' : 'var(--g-parch-dim)', background: 'transparent', padding: '4px 12px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))' }}
              >
                {t('gameSession.spells')}
              </button>
            </div>

            {activeLoadoutTab === 'inventory' ? (
              <>
                {/* Equipment Box */}
                <div style={{ border: '1px solid var(--g-border)', background: 'rgba(7,5,10,0.6)', clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))', padding: '10px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Shield size={11} style={{ color: 'var(--g-gold-dim)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 9, letterSpacing: '0.24em', color: 'var(--g-gold-dim)', textTransform: 'uppercase' }}>{equipmentTitle}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {([
                      { slot: 'head' as const, span: 2 },
                      { slot: 'leftHand' as const, span: 1 },
                      { slot: 'rightHand' as const, span: 1 },
                      { slot: 'body' as const, span: 2 },
                      { slot: 'arms' as const, span: 1 },
                      { slot: 'legs' as const, span: 1 },
                      { slot: 'accessory' as const, span: 2 },
                    ]).map(({ slot, span }) => {
                      const isEmpty = isEmptyValue(slotValues[slot])
                      const isAccessory = slot === 'accessory'
                      return (
                        <div key={slot} style={{ gridColumn: `span ${span}`, padding: '6px 8px', background: 'rgba(200,165,74,0.02)', border: '1px solid', borderColor: isAccessory && !isEmpty ? 'rgba(200,165,74,0.2)' : 'rgba(255,255,255,0.05)', clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                            <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 8, letterSpacing: '0.14em', color: 'var(--g-parch-faint)', textTransform: 'uppercase', flexShrink: 0 }}>{slotLabel(slot)}</span>
                            <span style={{ fontFamily: 'var(--g-font-body)', fontSize: 10, color: isEmpty ? 'rgba(255,255,255,0.12)' : isAccessory ? 'var(--g-gold-dim)' : 'var(--g-parch-dim)', textAlign: 'right' }}>{slotValues[slot]}</span>
                          </div>
                          {slotStats[slot] ? <p style={{ fontFamily: 'var(--g-font-title)', fontSize: 8, letterSpacing: '0.1em', color: 'var(--g-gold-dim)', opacity: 0.7, margin: '3px 0 0' }}>{slotStats[slot]}</p> : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : (
              <>
                {unlockedSkills.length ? (
                  <>
                    <h4 className="sidebar-subheading">{t('gameSession.techniques')}</h4>
                    <div className="spell-list">
                      {unlockedSkills.map(skill => (
                        <div className={`spell-item expandable ${expandedSpellIds.has(skill.id) ? 'open' : ''}`} key={skill.id}>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(setExpandedSpellIds, skill.id)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 0', fontFamily: 'var(--g-font-title)', color: 'var(--g-parch-dim)', textAlign: 'left' }}
                          >
                            <strong>{skill.name}</strong>
                            <span className="item-count">{t('gameSession.ready')}</span>
                          </button>
                          {expandedSpellIds.has(skill.id) && (
                            <div className="expandable-body">
                              <p>{skill.description}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  pushSystemMessage(`${skill.name} ${t('gameSession.notice.skillUsed')}`)
                                  addSystemNotice(`${skill.name} ${t('gameSession.notice.skillUsed')}`)
                                }}
                                style={{ fontFamily: 'var(--g-font-title)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', border: '1px solid var(--g-border)', color: 'var(--g-parch-dim)', background: 'transparent', padding: '4px 12px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))' }}
                              >
                                {t('gameSession.useTechnique')}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="empty-text">{t('gameSession.empty.noTechniques')}</p>
                )}

                {unlockedSpells.length ? (
                  <>
                    <h4 className="sidebar-subheading">{t('gameSession.spells')}</h4>
                    <div className="spell-list">
                      {unlockedSpells.map(spell => (
                        <div className={`spell-item expandable ${expandedSpellIds.has(spell.id) ? 'open' : ''} ${activeSpellId === spell.id ? 'casting' : ''}`} key={spell.id}>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(setExpandedSpellIds, spell.id)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 0', fontFamily: 'var(--g-font-title)', color: 'var(--g-parch-dim)', textAlign: 'left' }}
                          >
                            <strong>{spell.name}</strong>
                            <span className="item-count">
                              {spellCooldowns[spell.id] ? `CD ${spellCooldowns[spell.id]}` : t('gameSession.ready')}
                            </span>
                          </button>
                          {expandedSpellIds.has(spell.id) && (
                            <div className="expandable-body">
                              <p>{spell.description}</p>
                              <button
                                type="button"
                                onClick={() => useSpell(spell)}
                                style={{ fontFamily: 'var(--g-font-title)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', border: '1px solid var(--g-border)', color: 'var(--g-parch-dim)', background: 'transparent', padding: '4px 12px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))' }}
                              >
                                {t('gameSession.castSpell')}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="empty-text">{t('gameSession.empty.noSpells')}</p>
                )}
              </>
            )}

            <h4 className="sidebar-subheading">{t('gameSession.equipped')}</h4>
            {equipmentPool.length ? (
              <div className="boon-list">
                {equipmentPool.map((entry, index) => {
                  const isEquipped = equipment.includes(entry)
                  const itemMeta = inventoryItems.find(item => item.name === entry)
                  const itemStats = formatItemStats(itemMeta || null)
                  const itemDescription =
                    itemMeta?.description ||
                    (language === 'ru'
                      ? 'Описание для этого предмета пока отсутствует.'
                      : 'No description is available for this item yet.')
                  const itemKey = `${entry}-${index}`
                  const isExpanded = expandedEquipmentItem === itemKey
                  return (
                    <div className={`inventory-item equipment-entry ${isExpanded ? 'expanded' : ''}`} key={itemKey}>
                      <div className="equipment-entry-main">
                        <button
                          type="button"
                          onClick={() => setExpandedEquipmentItem(prev => (prev === itemKey ? null : itemKey))}
                          style={{ fontFamily: 'var(--g-font-title)', fontSize: 11, letterSpacing: '0.1em', border: 'none', color: isExpanded ? 'var(--g-gold)' : 'var(--g-parch-dim)', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                        >
                          {entry}
                        </button>
                        {itemStats ? <span className="equipment-inline-stats">{itemStats}</span> : null}
                        <div className="equipment-actions">
                          {isEquipped ? (
                            <button
                              type="button"
                              title={unequipActionLabel}
                              aria-label={unequipActionLabel}
                              onClick={() =>
                                updateStoredProfile(prev => {
                                  if (!prev) return prev
                                  const next = (prev.equipment || []).filter(item => item !== entry)
                                  return { ...prev, equipment: next }
                                })
                              }
                              style={{ border: '1px solid var(--g-border)', color: 'var(--g-parch-dim)', background: 'transparent', padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <X size={12} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              title={equipActionLabel}
                              aria-label={equipActionLabel}
                              onClick={() =>
                                updateStoredProfile(prev => {
                                  if (!prev) return prev
                                  const current = prev.equipment || []
                                  if (current.includes(entry)) return prev
                                  return { ...prev, equipment: [...current, entry] }
                                })
                              }
                              style={{ border: '1px solid var(--g-gold-dim)', color: 'var(--g-gold-dim)', background: 'transparent', padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Check size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      {isExpanded && (
                        <>
                          <p className="equipment-description">{itemDescription}</p>
                          {itemStats ? <p className="equipment-description stats">{itemStats}</p> : null}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="empty-text">{t('gameSession.empty.noItemsEquipped')}</p>
            )}

            <h4 className="sidebar-subheading">{t('gameSession.artifactsAndBoons')}</h4>
            {artifacts.length ? (
              <div className="boon-list">
                {artifacts.map((artifact, index) => (
                  <div className="inventory-item" key={`${artifact}-${index}`}>
                    <span>{artifact}</span>
                    <span className="item-count">{t('gameSession.bound')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-text">{t('gameSession.empty.noArtifacts')}</p>
            )}
          </>
        )
      case 'social':
        return (
          <>
            <h3>{t('gameSession.npcRelationships')}</h3>
            {mergedNpcRelations.length ? (
              <div className="npc-list">
                {mergedNpcRelations.map(npc => (
                  <div key={npc.id} className={`inventory-item npc-card expandable ${expandedNpcIds.has(npc.id) ? 'open' : ''}`}>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(setExpandedNpcIds, npc.id)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 0', fontFamily: 'var(--g-font-title)', color: 'var(--g-parch-dim)', textAlign: 'left' }}
                    >
                      <span>{npc.name}</span>
                    </button>
                    {expandedNpcIds.has(npc.id) && (
                      <div className="expandable-body">
                        <div className="relation-bar">
                          <span className={`relation-fill tier-${getAffinityTierIndex(npc.affinity)}`} />
                          <span className="relation-label">{getAffinityLabel(npc.affinity)}</span>
                        </div>
                        {npc.notes.length ? (
                          npc.notes.map((note, index) => (
                            <p key={`${npc.id}-note-${index}`}>{note}</p>
                          ))
                        ) : (
                          <p className="empty-text">{t('gameSession.empty.noNpcNotes')}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-text">{t('gameSession.empty.noRelationships')}</p>
            )}
          </>
        )
      default:
        return null
    }
  }

  const sidebarButtons = [
    { section: 'journal' as SidebarSection, icon: BookOpen, label: t('gameSession.journal') },
    { section: 'stats' as SidebarSection, icon: User, label: t('gameSession.stats') },
    { section: 'loadout' as SidebarSection, icon: Package, label: t('gameSession.loadout') },
    { section: 'social' as SidebarSection, icon: Users, label: t('gameSession.npcs') }
  ]

  // ── Derived display values ──
  const maxResources = useMemo(() => {
    const profile = characterProfile
    if (!profile) return { hp: 24, mp: 16 }
    const s = profile.customClassData?.stats || DEFAULT_STATS
    const hitDie = Number(profile.customClassData?.hitDie?.replace('d', '')) || 8
    const maxHp = Math.max(1, hitDie + (s.constitution || DEFAULT_STATS.constitution))
    const maxMp = Math.max(8, Math.round(((s.intelligence || 10) + (s.wisdom || 10) + (s.charisma || 10)) / 3))
    return { hp: maxHp, mp: maxMp }
  }, [characterProfile])
  const hpMax = maxResources.hp
  const mpMax = maxResources.mp
  const hpPct = Math.round((resources.hp / hpMax) * 100)
  const mpPct = Math.round((resources.mp / mpMax) * 100)

  const classIconMap: Record<string, string> = {
    warrior: '⚔️', mage: '🧙', paladin: '🛡️', rogue: '🗡️',
    cleric: '✨', warlock: '📖', ranger: '🏹', druid: '🌿', bard: '🎭',
  }
  const charIcon = (() => {
    const c = (characterProfile?.class || '').toLowerCase()
    return Object.entries(classIconMap).find(([k]) => c.includes(k))?.[1] ?? '🎲'
  })()

  const activeConditions = statusEffects.map(e => ({
    name: e.name,
    type: e.type as 'buff' | 'debuff' | 'condition',
  }))

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', background: 'var(--g-ink)', display: 'grid', gridTemplateColumns: '300px 1fr 280px', gridTemplateRows: '58px 1fr 110px' }}>

      {/* ── FOG CANVAS ── */}
      <canvas ref={fogCanvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} />
      {/* Grain */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")` }} />
      {/* Vignette */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 50%, transparent 42%, rgba(3,2,6,0.72) 100%)' }} />

      {/* ════════════════════════════════════
          HEADER
      ════════════════════════════════════ */}
      <header style={{ gridColumn: '1/-1', position: 'relative', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', background: 'rgba(4,2,8,0.88)', borderBottom: '1px solid var(--g-border)', backdropFilter: 'blur(6px)' }}>
        {/* Left: logo + location */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span onClick={() => navigate('/')} style={{ fontFamily: 'var(--g-font-display)', fontSize: 19, fontWeight: 700, color: 'var(--g-gold)', letterSpacing: '0.1em', textShadow: '0 0 16px rgba(200,165,74,0.3)', animation: 'g-flicker 8s ease-in-out infinite', cursor: 'pointer' }}>
            Rol<span style={{ color: 'var(--g-blood2)' }}>l</span>ia
          </span>
          <div style={{ width: 1, height: 18, background: 'var(--g-border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--g-font-title)', fontSize: 11, letterSpacing: '0.2em', color: 'var(--g-parch-faint)', textTransform: 'uppercase' }}>
            <div style={{ width: 5, height: 5, background: 'var(--g-blood2)', borderRadius: '50%', boxShadow: '0 0 6px rgba(168,28,48,0.6)', animation: 'g-pulse-dot 2.4s ease-in-out infinite' }} />
            <span>{t('gameSession.default.soloTale')}</span>
          </div>
        </div>
        {/* Center: time + turn */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--g-font-italic)', fontSize: 11, fontStyle: 'italic', color: 'var(--g-parch-faint)' }}>
            Level {level} · {characterProfile?.class || t('gameSession.default.adventurer')}
          </span>
          <div style={{ fontFamily: 'var(--g-font-title)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--g-gold-dim)', border: '1px solid var(--g-border)', padding: '4px 13px', clipPath: 'polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))' }}>
            {xp} XP
          </div>
        </div>
        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {sidebarButtons.map(btn => (
            <button key={btn.section}
              onClick={() => setActiveSidebar(btn.section)}
              style={{ fontFamily: 'var(--g-font-title)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid', borderColor: activeSidebar === btn.section ? 'rgba(200,165,74,0.35)' : 'var(--g-border)', color: activeSidebar === btn.section ? 'var(--g-gold)' : 'var(--g-parch-faint)', background: activeSidebar === btn.section ? 'rgba(200,165,74,0.07)' : 'transparent', padding: '5px 13px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))', transition: 'all 0.2s' }}
            >
              {btn.label}
            </button>
          ))}
          <div style={{ width: 1, height: 18, background: 'var(--g-border)' }} />
          <button
            onClick={() => { const m = toggleMute(); setAudioMuted(m) }}
            title={audioMuted ? 'Unmute ambience' : 'Mute ambience'}
            style={{ fontFamily: 'var(--g-font-title)', fontSize: 14, border: '1px solid var(--g-border)', color: audioMuted ? 'rgba(168,28,48,0.6)' : 'var(--g-parch-faint)', background: 'transparent', padding: '4px 10px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))', transition: 'all 0.2s', lineHeight: 1 }}
          >
            {audioMuted ? '🔇' : '🔊'}
          </button>
          <div style={{ width: 1, height: 18, background: 'var(--g-border)' }} />
          <button style={{ fontFamily: 'var(--g-font-title)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid var(--g-border)', color: 'var(--g-parch-faint)', background: 'transparent', padding: '5px 13px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))', transition: 'all 0.2s' }}
            onClick={() => void handleResetCampaignText()} disabled={isLoading}
          >
            Reset
          </button>
          <button style={{ fontFamily: 'var(--g-font-title)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid rgba(200,165,74,0.3)', color: 'rgba(200,165,74,0.7)', background: 'transparent', padding: '5px 13px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))', transition: 'all 0.2s' }}
            onClick={handleExportTranscript} disabled={!messages.length}
          >
            Export Log
          </button>
        </div>
      </header>

      {/* ════════════════════════════════════
          LEFT — TAROT PANEL
      ════════════════════════════════════ */}
      <aside style={{ position: 'relative', zIndex: 10, borderRight: '1px solid var(--g-border)', background: 'rgba(7,5,10,0.72)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Tarot card portrait */}
        <div style={{ padding: '14px 14px 0', flexShrink: 0 }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '2.2/3.5', maxHeight: 185, background: 'linear-gradient(170deg,#1a0f20 0%,#0f0c18 45%,#1c0c10 100%)', clipPath: 'polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))', border: '1px solid rgba(200,165,74,0.22)', overflow: 'hidden' }}>
            {/* Bg glow */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 70%,rgba(107,17,34,0.3) 0%,transparent 65%)' }} />
            {/* Arcana label */}
            <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--g-font-title)', fontSize: 7, letterSpacing: '0.18em', color: 'rgba(200,165,74,0.35)', zIndex: 5, whiteSpace: 'nowrap' }}>
              {characterProfile?.class?.toUpperCase() || 'THE WANDERER'}
            </div>
            {/* Top ornament bar */}
            <div style={{ position: 'absolute', top: 18, left: 10, right: 10, height: 1, background: 'rgba(200,165,74,0.15)', zIndex: 4 }} />
            {/* Figure */}
            {resolvedAvatarUrl ? (
              <img src={resolvedAvatarUrl} alt={characterProfile?.name || ''} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 2, opacity: 0.85 }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 68, filter: 'drop-shadow(0 4px 14px rgba(200,165,74,0.2))', zIndex: 2 }}>
                {charIcon}
              </div>
            )}
            {/* Bottom ornament bar */}
            <div style={{ position: 'absolute', bottom: 18, left: 10, right: 10, height: 1, background: 'rgba(200,165,74,0.15)', zIndex: 4 }} />
            {/* Inner border */}
            <div style={{ position: 'absolute', inset: 4, border: '1px solid rgba(200,165,74,0.12)', clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))', pointerEvents: 'none', zIndex: 3 }} />
            {/* Corners */}
            <div className="g-corner g-corner-tl" /><div className="g-corner g-corner-tr" />
            <div className="g-corner g-corner-bl" /><div className="g-corner g-corner-br" />
          </div>
        </div>

        {/* Name + class */}
        <div style={{ padding: '8px 14px 4px', textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--g-font-title)', fontSize: 16, fontWeight: 600, color: 'var(--g-gold)', letterSpacing: '0.07em', textShadow: '0 0 10px rgba(200,165,74,0.22)' }}>
            {characterProfile?.name || t('gameSession.default.unnamedHero')}
          </div>
          <div style={{ fontFamily: 'var(--g-font-italic)', fontSize: 13, fontStyle: 'italic', color: 'var(--g-parch-faint)', marginTop: 3 }}>
            {characterProfile?.class || t('gameSession.default.wanderer')}
          </div>
        </div>

        {/* Scrollable stats area */}
        <div className="g-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 14px 14px' }}>

          {/* HP/MP/XP bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'Vitality', val: resources.hp, max: hpMax, pct: hpPct, cls: 'g-bar-hp' },
              { label: 'Arcane', val: resources.mp, max: mpMax, pct: mpPct, cls: 'g-bar-mp' },
              { label: 'Experience', val: xp, max: nextThreshold, pct: xpProgress, cls: 'g-bar-xp' },
            ].map(b => (
              <div key={b.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span className="g-label" style={{ fontSize: 9 }}>{b.label}</span>
                  <span style={{ fontFamily: 'var(--g-font-body)', fontSize: 13, color: 'var(--g-parch-dim)' }}>{b.val}</span>
                </div>
                <div className="g-bar"><div className={b.cls} style={{ width: `${b.pct}%` }} /></div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="g-divider" style={{ marginBottom: 8 }}><span className="g-divider-icon">✦</span></div>

          {/* Attributes grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginBottom: 10 }}>
            {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map(key => {
              const statKey = ({ STR: 'strength', DEX: 'dexterity', CON: 'constitution', INT: 'intelligence', WIS: 'wisdom', CHA: 'charisma' } as const)[key]
              const score = stats[statKey] ?? 10
              const mod = Math.floor((score - 10) / 2)
              return (
                <div key={key} className="g-attr" style={{ padding: '5px 3px' }}>
                  <span className="g-attr-value" style={{ fontSize: 17 }}>{score}</span>
                  <span className="g-attr-mod">{mod >= 0 ? '+' : ''}{mod}</span>
                  <span className="g-attr-label">{key}</span>
                </div>
              )
            })}
          </div>

          {/* Status conditions */}
          {activeConditions.length > 0 && (
            <>
              <div className="g-divider" style={{ marginBottom: 8 }}><span className="g-divider-icon">✦</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {activeConditions.map((c, i) => (
                  <span key={i} className={`g-tag ${c.type === 'buff' ? 'g-tag-buff' : 'g-tag-debuff'}`} style={{ fontSize: 9 }}>
                    {c.name}
                  </span>
                ))}
              </div>
            </>
          )}

        </div>

        {/* Combat Tracker */}
        {battleState && battleState.phase !== 'ended' && (
          <div style={{ padding: '0 14px 14px', flexShrink: 0 }}>
            <CombatTracker combatState={battleState} />
          </div>
        )}

      </aside>

      {/* ════════════════════════════════════
          CENTER — INK SCROLL NARRATIVE
      ════════════════════════════════════ */}
      <main style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', background: 'rgba(5,3,8,0.45)', overflow: 'hidden' }}>

        {/* Parchment overlay */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, background: 'radial-gradient(ellipse at 50% 0%,rgba(200,165,74,0.02) 0%,transparent 55%)' }} />

        {/* Scroll top rod */}
        <div style={{ position: 'relative', zIndex: 3, flexShrink: 0, padding: '8px 24px 0', display: 'flex', alignItems: 'center', gap: 0 }}>
          <div style={{ flex: 1, height: 8, background: 'linear-gradient(180deg,rgba(200,165,74,0.14) 0%,rgba(200,165,74,0.05) 50%,rgba(200,165,74,0.14) 100%)', borderTop: '1px solid rgba(200,165,74,0.15)', borderBottom: '1px solid rgba(200,165,74,0.07)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', background: 'radial-gradient(circle,rgba(200,165,74,0.4) 0%,rgba(200,165,74,0.08) 100%)', border: '1px solid rgba(200,165,74,0.25)' }} />
            <div style={{ position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', background: 'radial-gradient(circle,rgba(200,165,74,0.4) 0%,rgba(200,165,74,0.08) 100%)', border: '1px solid rgba(200,165,74,0.25)' }} />
          </div>
          <div style={{ padding: '0 14px', fontFamily: 'var(--g-font-title)', fontSize: 11, letterSpacing: '0.18em', color: 'var(--g-parch-faint)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            ⟨ {t('gameSession.default.soloTale')} ⟩
          </div>
          <div style={{ flex: 1, height: 8, background: 'linear-gradient(180deg,rgba(200,165,74,0.14) 0%,rgba(200,165,74,0.05) 50%,rgba(200,165,74,0.14) 100%)', borderTop: '1px solid rgba(200,165,74,0.15)', borderBottom: '1px solid rgba(200,165,74,0.07)' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', background: 'radial-gradient(circle,rgba(200,165,74,0.4) 0%,rgba(200,165,74,0.08) 100%)', border: '1px solid rgba(200,165,74,0.25)' }} />
            <div style={{ position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', background: 'radial-gradient(circle,rgba(200,165,74,0.4) 0%,rgba(200,165,74,0.08) 100%)', border: '1px solid rgba(200,165,74,0.25)' }} />
          </div>
        </div>

        {/* Combat banner */}
        {battleUiEnabled && battleState && battleState.phase !== 'ended' && (
          <div style={{ position: 'relative', zIndex: 3, flexShrink: 0, margin: '6px 16px 0', border: '1px solid rgba(168,28,48,0.4)', background: 'rgba(107,17,34,0.12)', clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--g-blood2)', textTransform: 'uppercase' }}>
                ⚔ {t('gameSession.combatModeRound')} {battleState.round}
              </span>
              <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 8, color: 'var(--g-parch-faint)', letterSpacing: '0.1em' }}>
                {battleState.phase.replace('_', ' ')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {battleState.entities.filter(e => e.type === 'enemy').map(enemy => (
                <div key={enemy.id} style={{ fontFamily: 'var(--g-font-title)', fontSize: 9, color: 'var(--g-parch-dim)', border: '1px solid var(--g-border)', padding: '2px 8px', clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))' }}>
                  {enemy.name} · {enemy.hp}/{enemy.hp_max} HP
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([
                { action: 'attack', label: t('gameSession.combat.attack') },
                { action: 'defend', label: t('gameSession.combat.defend') },
                { action: 'move', label: t('gameSession.combat.move') },
                { action: 'item', label: t('gameSession.combat.item') },
                { action: 'spell', label: t('gameSession.combat.spell') },
                { action: 'attempt', label: t('gameSession.combat.attempt') },
              ] as const).map(act => (
                <button key={act.action}
                  onClick={() => act.action === 'defend'
                    ? sendCombatIntent({ action: 'defend', actor: 'player' })
                    : setCombatAction({ action: act.action as ActionIntent['action'] })
                  }
                  style={{ fontFamily: 'var(--g-font-title)', fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', border: '1px solid', borderColor: combatAction.action === act.action ? 'var(--g-gold)' : 'var(--g-border)', color: combatAction.action === act.action ? 'var(--g-gold)' : 'var(--g-parch-faint)', background: combatAction.action === act.action ? 'rgba(200,165,74,0.07)' : 'transparent', padding: '4px 10px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))', transition: 'all 0.2s' }}
                >
                  {act.label}
                </button>
              ))}
            </div>
            {combatAction.action === 'attack' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: 'var(--g-font-italic)', fontSize: 12, fontStyle: 'italic', color: 'var(--g-parch-faint)', marginBottom: 5 }}>{t('gameSession.combat.chooseTarget')}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {getEnemyTargets().map(enemy => (
                    <button key={enemy.id} onClick={() => sendCombatIntent({ action: 'attack', actor: 'player', target: enemy.id })}
                      style={{ fontFamily: 'var(--g-font-title)', fontSize: 9, border: '1px solid var(--g-blood)', color: 'var(--g-blood2)', background: 'rgba(107,17,34,0.15)', padding: '4px 12px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))' }}
                    >{enemy.name}</button>
                  ))}
                </div>
              </div>
            )}
            {combatAction.action === 'move' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: 'var(--g-font-italic)', fontSize: 12, fontStyle: 'italic', color: 'var(--g-parch-faint)', marginBottom: 5 }}>{t('gameSession.combat.chooseMovement')}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ value: 'closer', label: t('gameSession.combat.moveCloser') }, { value: 'farther', label: t('gameSession.combat.moveFarther') }, { value: 'cover', label: t('gameSession.combat.moveCover') }].map(opt => (
                    <button key={opt.value} onClick={() => sendCombatIntent({ action: 'move', actor: 'player', params: { move_type: opt.value } })}
                      style={{ fontFamily: 'var(--g-font-title)', fontSize: 9, border: '1px solid var(--g-border)', color: 'var(--g-parch-dim)', background: 'transparent', padding: '4px 12px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))' }}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>
            )}
            {combatAction.action === 'item' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: 'var(--g-font-italic)', fontSize: 12, fontStyle: 'italic', color: 'var(--g-parch-faint)', marginBottom: 5 }}>{t('gameSession.combat.selectItem')}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {inventoryItems.filter(item => item.consumable).map(item => (
                    <button key={item.id} onClick={() => { useItem(item.id); sendCombatIntent({ action: 'item', actor: 'player', params: { item_id: item.id } }) }}
                      style={{ fontFamily: 'var(--g-font-title)', fontSize: 9, border: '1px solid var(--g-border)', color: 'var(--g-parch-dim)', background: 'transparent', padding: '4px 12px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))' }}
                    >{item.name}</button>
                  ))}
                </div>
              </div>
            )}
            {combatAction.action === 'spell' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: 'var(--g-font-italic)', fontSize: 12, fontStyle: 'italic', color: 'var(--g-parch-faint)', marginBottom: 5 }}>{t('gameSession.combat.selectSpell')}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {unlockedSpells.map(spell => (
                    <button key={spell.id} onClick={() => { useSpell(spell); sendCombatIntent({ action: 'spell', actor: 'player', params: { spell_id: spell.id } }) }}
                      style={{ fontFamily: 'var(--g-font-title)', fontSize: 9, border: '1px solid var(--g-border)', color: 'var(--g-parch-dim)', background: 'transparent', padding: '4px 12px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))' }}
                    >{spell.name}</button>
                  ))}
                </div>
              </div>
            )}
            {combatAction.action === 'attempt' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: 'var(--g-font-italic)', fontSize: 12, fontStyle: 'italic', color: 'var(--g-parch-faint)', marginBottom: 5 }}>{t('gameSession.combat.describeAttempt')}</div>
                <textarea rows={2} value={attemptText} onChange={e => setAttemptText(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--g-border)', color: 'var(--g-parch)', fontFamily: 'var(--g-font-mono)', fontSize: 12, padding: '6px 10px', outline: 'none', resize: 'none', marginBottom: 6, clipPath: 'polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))' }}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {getEnemyTargets().map(enemy => (
                    <button key={enemy.id} onClick={() => sendCombatIntent({ action: 'attempt', actor: 'player', target: enemy.id, free_text: attemptText || 'attempt' })}
                      style={{ fontFamily: 'var(--g-font-title)', fontSize: 9, border: '1px solid var(--g-blood)', color: 'var(--g-blood2)', background: 'rgba(107,17,34,0.15)', padding: '4px 12px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))' }}
                    >{enemy.name}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Message feed */}
        <div className="g-scroll" style={{ flex: 1, overflowY: 'auto', padding: '22px 32px 12px', position: 'relative', zIndex: 2 }}>
          {messages.map(message => (
            <div key={message.id} style={{ marginBottom: 24, animation: 'g-typing 0.4s ease forwards' }}>

              {/* DM message */}
              {message.type === 'dm' && (
                <div style={{
                  padding: '18px 22px 18px 28px', background: 'rgba(0,0,0,0.18)', borderLeft: '2px solid var(--g-blood)', position: 'relative',
                  // Ink reveal animation
                  animationName: 'inkReveal',
                  animationDuration: '0.6s',
                  animationTimingFunction: 'cubic-bezier(0.22,0.68,0,1.2)',
                  animationFillMode: 'forwards',
                }}>
                  <div style={{ position: 'absolute', top: 12, left: -10, color: 'var(--g-blood2)', fontSize: 13, background: 'rgba(5,3,8,0.95)', lineHeight: 1 }}>❧</div>
                  {message.sceneHeader && (() => {
                    const parts = message.sceneHeader.split('·')
                    const loc = parts[0].trim()
                    const time = parts[1] ? shortenTime(parts[1].trim()) : ''
                    if (isSystemId(loc) && !time) return null
                    const displayLoc = isSystemId(loc) ? '' : loc
                    return (
                      <div style={{ fontFamily: 'var(--g-font-title)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--g-gold-dim)', textTransform: 'uppercase', marginBottom: 8, opacity: 0.7 }}>
                        {displayLoc}{displayLoc && time ? ' · ' : ''}{time}
                      </div>
                    )
                  })()}
                  <div style={{ fontFamily: 'var(--g-font-body)', fontSize: 18, lineHeight: 1.78, color: 'var(--g-parch)', fontStyle: 'italic' }}>
                    {renderMessageContent(message.content)}
                  </div>
                </div>
              )}

              {/* Player message */}
              {message.type === 'player' && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingLeft: 6 }}>
                  <div style={{ width: 22, height: 22, flexShrink: 0, border: '1px solid var(--g-gold-dim)', background: 'rgba(200,165,74,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--g-gold-dim)', clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))' }}>
                    ⚔
                  </div>
                  <div style={{ paddingTop: 3 }}>
                    {message.roll && message.roll.status !== 'idle' && (
                      <DiceRollHeader roll={message.roll} t={t} />
                    )}
                    <div style={{ fontFamily: 'var(--g-font-mono)', fontSize: 15, lineHeight: 1.55, color: 'var(--g-parch-dim)' }}>
                      {renderPlainTextSegment(message.content, `${message.id}-content`)}
                    </div>
                  </div>
                </div>
              )}

              {/* System message */}
              {message.type === 'system' && (
                <div style={{ textAlign: 'center', padding: '4px' }}>
                  <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 11, letterSpacing: '0.25em', color: 'var(--g-gold-dim)', textTransform: 'uppercase', opacity: 0.5 }}>
                    {message.content}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div style={{ padding: '14px 18px 14px 22px', background: 'rgba(0,0,0,0.14)', borderLeft: '2px solid rgba(107,17,34,0.4)', marginBottom: 18 }}>
              <div style={{ position: 'absolute', left: -10, color: 'rgba(168,28,48,0.4)', fontSize: 13, background: 'rgba(5,3,8,0.95)' }}>❧</div>
              <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--g-parch-faint)', textTransform: 'uppercase' }}>
                {language === 'ru' ? 'Печатаем' : 'Typing'} {TYPING_DOT_FRAMES[typingFrame]}
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ════════════════════════════════════
          RIGHT — JOURNAL / SIDEBAR
      ════════════════════════════════════ */}
      <aside style={{ position: 'relative', zIndex: 10, borderLeft: '1px solid var(--g-border)', background: 'rgba(7,5,10,0.7)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="g-scroll" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '16px 16px 12px' }}>
            <div className="g-section-title">{sidebarButtons.find(b => b.section === activeSidebar)?.label || ''}</div>
          </div>
          <div className="gs-sidebar-body" style={{ padding: '0 13px 14px' }}>
            {renderSidebarContent()}
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════
          INPUT BAR
      ════════════════════════════════════ */}
      <div style={{ gridColumn: '1/-1', position: 'relative', zIndex: 50, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: 'rgba(4,2,8,0.9)', borderTop: '1px solid var(--g-border)', backdropFilter: 'blur(6px)' }}>
        <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 8, letterSpacing: '0.2em', color: 'var(--g-gold-dim)', textTransform: 'uppercase', whiteSpace: 'nowrap', opacity: 0.6 }}>
          {t('gameSession.your-action')}
        </span>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 12, color: 'var(--g-blood2)', fontSize: 15, pointerEvents: 'none', opacity: 0.7 }}>⟩</span>
          <textarea
            ref={inputRef}
            rows={2}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={isLoading}
            placeholder={t('gameSession.chatPlaceholder')}
            style={{ width: '100%', background: 'rgba(255,255,255,0.018)', border: '1px solid var(--g-border)', borderBottom: '1px solid rgba(200,165,74,0.28)', color: 'var(--g-parch)', fontFamily: 'var(--g-font-mono)', fontSize: 15, padding: '11px 14px 11px 34px', outline: 'none', resize: 'none', lineHeight: 1.5, clipPath: 'polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,9px 100%,0 calc(100% - 9px))', transition: 'border-color 0.2s,background 0.2s' }}
            onFocus={e => { e.target.style.borderBottomColor = 'var(--g-gold)'; e.target.style.background = 'rgba(200,165,74,0.022)' }}
            onBlur={e => { e.target.style.borderBottomColor = 'rgba(200,165,74,0.28)'; e.target.style.background = 'rgba(255,255,255,0.018)' }}
          />
        </div>
        <button
          onClick={e => { e.preventDefault(); void handleSendMessage(e as unknown as React.FormEvent) }}
          disabled={!inputValue.trim() || isLoading}
          style={{ background: 'transparent', border: '1px solid var(--g-blood)', color: 'var(--g-blood2)', fontFamily: 'var(--g-font-title)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '12px 22px', cursor: 'pointer', clipPath: 'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))', transition: 'all 0.2s', opacity: !inputValue.trim() || isLoading ? 0.4 : 1, whiteSpace: 'nowrap' }}
          onMouseEnter={e => { if (inputValue.trim() && !isLoading) { (e.target as HTMLElement).style.background = 'rgba(107,17,34,0.28)'; (e.target as HTMLElement).style.color = 'var(--g-parch)' } }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = 'var(--g-blood2)' }}
        >
          {isLoading ? '...' : 'Invoke ✦'}
        </button>
      </div>

    </div>
  )
}

export default GameSession
