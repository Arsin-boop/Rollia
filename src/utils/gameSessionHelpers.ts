import type { CharacterStats, InventoryItem } from '../types/character'
import type {
  NPCPaletteEntry,
  StoredCharacterProfile,
  PersistedCampaignState,
  CharacterAbility,
} from '../types/gameSession'
import type { CustomClassResponse, ActionIntent } from './api'

// ── Constants ────────────────────────────────────────────────────────

export const DEFAULT_STATS: CharacterStats = {
  strength: 10,
  dexterity: 14,
  constitution: 12,
  intelligence: 13,
  wisdom: 15,
  charisma: 11
}

export const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500,
  14000, 23000, 34000, 48000,
  64000, 85000, 100000, 120000,
  140000, 165000, 195000, 225000,
  265000, 305000, 355000
]

export const CHARACTER_STORAGE_KEY = 'dnd-ai-character'
export const TEMPLATE_CHARACTER_STORAGE_KEY = 'character'
export const ACTIVE_CAMPAIGN_KEY = 'activeCampaignId'
export const CAMPAIGN_STATE_KEY_PREFIX = 'campaign_state_'

export const MIN_SUCCESS_THRESHOLD = 12
export const SUMMARY_INTERVAL = 12
export const SUMMARY_KEEP_LATEST = 2
export const MIN_BACKSTORY_LENGTH = 200
export const MIN_MESSAGES_FOR_BACKSTORY = 6
export const DM_DISPLAY_NAME = 'Dungeon Master'
export const TYPING_DOT_FRAMES = ['', '.', '..', '...', '..', '.'] as const

// ── Regex Patterns ───────────────────────────────────────────────────

export const CHARACTER_TAG_REGEX =
  /\[CHARACTER\s+name="([^"]+)"(?:\s+color="([^"]+)")?\s*\](.*?)\[\/CHARACTER\]/gis
export const NPC_TAG_REGEX = /<npc\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/npc>/gi
export const QUEST_TAG_REGEX = /\[QUEST([^\]]*)\]([\s\S]*?)\[\/QUEST\]/gi
export const RUMOR_TAG_REGEX = /\[RUMOR([^\]]*)\]([\s\S]*?)\[\/RUMOR\]/gi
export const RELATION_TAG_REGEX = /\[RELATION([^\]]*)\]([\s\S]*?)\[\/RELATION\]/gi
export const BATTLE_TAG_REGEX = /\[BATTLE([^\]]*)\]([\s\S]*?)\[\/BATTLE\]/gi
export const EFFECT_TAG_REGEX = /\[EFFECT([^\]]*)\]/gi
export const GLOW_TAG_REGEX = /<glow([^>]*)>([\s\S]*?)<\/glow>/gi
export const HIGHLIGHT_TAG_REGEX =
  /<span\s+class="([^"]*\bhl\b[^"]*)"\s*>([\s\S]*?)<\/span>/gi
export const GLOW_ATTR_REGEX = /(\w+)="([^"]+)"/gi
export const ATTRIBUTE_REGEX = /(\w+)="([^"]+)"/gi

// ── NPC Palette ──────────────────────────────────────────────────────

export const DEFAULT_NPC_PALETTE: NPCPaletteEntry[] = [
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

export const AFFINITY_TIERS = ['Hostile', 'Wary', 'Neutral', 'Friendly', 'Allied'] as const

// ── Pure Helper Functions ────────────────────────────────────────────

export const sanitizeLogText = (value: string): string => {
  if (!value) return ''
  return value
    .replace(/<npc\s+id="[^"]+\"[^>]*>/gi, '')
    .replace(/<\/npc>/gi, '')
    .replace(/<glow[^>]*>/gi, '')
    .replace(/<\/glow>/gi, '')
    .replace(/<\/?span[^>]*>/gi, '')
    .replace(/\[\/?(?:QUEST|RUMOR|RELATION|BATTLE)[^\]]*\]/gi, '')
    .replace(/\[EFFECT[^\]]*\]/gi, '')
    .replace(/\r/g, '')
    .trim()
}

export const extractSceneHeader = (content: string) => {
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

export const stripNumberedParagraphs = (content: string) => {
  return content
    .split('\n')
    .map(line => line.replace(/^\s*\[\d+\]\s*/, ''))
    .join('\n')
    .trim()
}

export const getLevelFromXP = (xp: number): number => {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) {
      return i + 1
    }
  }
  return 1
}

export const parseAttributes = (input: string): Record<string, string> => {
  const attributes: Record<string, string> = {}
  let match: RegExpExecArray | null
  while ((match = ATTRIBUTE_REGEX.exec(input)) !== null) {
    attributes[match[1].toLowerCase()] = match[2]
  }
  ATTRIBUTE_REGEX.lastIndex = 0
  return attributes
}

export const parseGlowAttributes = (input: string): Record<string, string> => {
  const attributes: Record<string, string> = {}
  let match: RegExpExecArray | null
  while ((match = GLOW_ATTR_REGEX.exec(input)) !== null) {
    attributes[match[1].toLowerCase()] = match[2]
  }
  GLOW_ATTR_REGEX.lastIndex = 0
  return attributes
}

export const parseEnemies = (input?: string): Array<{ name: string; hp: number }> => {
  if (!input) return []
  return input.split('|').map(token => {
    const [name, hp] = token.split(':')
    return { name: name?.trim() || 'Foe', hp: hp ? Number(hp) : 10 }
  })
}

export const classifyCombatText = (text: string): ActionIntent => {
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

export const hashString = (value: string): number => {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export const isAbilityUnlocked = (
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

export const buildAbilitiesFromFeatures = (classData?: CustomClassResponse | null): CharacterAbility[] => {
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
      type: isSpell ? 'spell' as const : 'skill' as const,
      unlockLevel: index === 0 ? 1 : Math.min(1 + index * 2, 20)
    }
  })
}

export const buildAbilitiesFromProfile = (profile: StoredCharacterProfile | null): CharacterAbility[] => {
  if (!profile) return []
  if (profile.abilityDeck?.length) return profile.abilityDeck
  if (profile.abilities?.length) return profile.abilities
  return buildAbilitiesFromFeatures(profile.customClassData)
}

export const toItemSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

export const buildGeneratedLoadoutItems = (classData?: CustomClassResponse | null): InventoryItem[] => {
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

export const mergeUniqueInventoryItems = (
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

export const mergeUniqueEquipment = (baseEquipment: string[], items: InventoryItem[]): string[] => {
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

export const computeResourcesFromProfile = (profile: StoredCharacterProfile | null) => {
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

export const getAffinityTierIndex = (affinity: number): number => {
  if (affinity >= 40) return 4
  if (affinity >= 20) return 3
  if (affinity >= 5) return 2
  if (affinity <= -30) return 0
  if (affinity <= -10) return 1
  return 2
}

export const getAffinityBadge = (affinity: number): string => {
  return AFFINITY_TIERS[getAffinityTierIndex(affinity)] || 'Neutral'
}

export const normalizeNpcName = (name: string): string => {
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

export const canonicalNpcId = (id?: string, name?: string): string => {
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

export const colorFromName = (name: string): string => {
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
  if (hue < 60) { r = c; g = x }
  else if (hue < 120) { r = x; g = c }
  else if (hue < 180) { g = c; b = x }
  else if (hue < 240) { g = x; b = c }
  else if (hue < 300) { r = x; b = c }
  else { r = c; b = x }
  const toHex = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const parseStoredProfile = (raw: string | null): StoredCharacterProfile | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as StoredCharacterProfile
  } catch {
    return null
  }
}

export const parseCampaignState = (raw: string | null): PersistedCampaignState | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as PersistedCampaignState
  } catch {
    return null
  }
}

export const toTimestamp = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

export const pickFreshestProfile = (
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

  const legacyName = (legacyProfile.name || '').trim().toLowerCase()
  const templateName = (templateProfile.name || '').trim().toLowerCase()
  const legacyClass = (legacyProfile.class || '').trim().toLowerCase()
  const templateClass = (templateProfile.class || '').trim().toLowerCase()

  if (templateName && templateClass && (templateName !== legacyName || templateClass !== legacyClass)) {
    return templateProfile
  }

  return legacyProfile
}
