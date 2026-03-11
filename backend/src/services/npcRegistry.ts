export interface NPCProfile {
  id: string
  name: string
  dialogueColorId: string
  age: string
  occupation: string
  firstImpression: string
  innerCharacter: string
  primaryMotivation: string
  secondaryMotivation: string
  secret: string
  voice: string
  behaviorQuirks: string
  relationshipToLocation: string
  potentialHook: string
  location?: string
  contextSnippet?: string
}

// Per-campaign NPC store — key is campaignKey, value is name->profile map
const campaignNpcStores = new Map<string, Map<string, NPCProfile>>()

const getStore = (campaignKey: string): Map<string, NPCProfile> => {
  if (!campaignNpcStores.has(campaignKey)) {
    campaignNpcStores.set(campaignKey, new Map())
  }
  return campaignNpcStores.get(campaignKey)!
}

export function clearNPCRegistry(campaignKey: string): void {
  campaignNpcStores.delete(campaignKey)
}

export type NPCDialoguePaletteEntry = {
  id: string
  color: string
  glow?: string
}

const NPC_DIALOGUE_PALETTE: NPCDialoguePaletteEntry[] = [
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

const assignDialogueColorId = (npcId: string): string => {
  const safeId = npcId || `${Date.now()}`
  const index = hashString(safeId) % NPC_DIALOGUE_PALETTE.length
  return NPC_DIALOGUE_PALETTE[index]?.id || 'ember1'
}

const corinProfile: NPCProfile = {
  id: 'corin-blackbriar',
  name: 'Corin the Barkeep',
  dialogueColorId: 'ember1',
  age: 'middle-aged',
  occupation: 'proprietor of The Gilded Griffin',
  firstImpression: 'broad-shouldered barkeep polishing a comet-blue cloth, eyes measuring everyone',
  innerCharacter: 'warm, pragmatic, quietly watchful',
  primaryMotivation: 'keep peace inside the tavern walls',
  secondaryMotivation: 'guard and trade valuable rumors',
  secret: 'knows hidden tunnels beneath Everlume and owes a debt to a shadow guild',
  voice: 'grounded, short sentences with teasing undertones',
  behaviorQuirks: 'constantly polishing glassware, gaze flicks to exits',
  relationshipToLocation: 'anchors The Gilded Griffin as guardian and host',
  potentialHook: 'can guide trusted patrons through secret tunnels or broker introductions',
  location: 'The Gilded Griffin',
  contextSnippet: 'Default barkeep NPC anchoring the campaign opener'
}


export function listNPCDialoguePalette(): NPCDialoguePaletteEntry[] {
  return NPC_DIALOGUE_PALETTE.slice()
}

export function listNPCProfiles(campaignKey = 'default'): NPCProfile[] {
  const store = getStore(campaignKey)
  const deduped = new Map<string, NPCProfile>()
  for (const profile of store.values()) {
    const key = (profile.id || profile.name || '').trim().toLowerCase()
    if (!key || deduped.has(key)) continue
    deduped.set(key, profile)
  }
  return Array.from(deduped.values())
}

export function getNPCProfile(name: string, campaignKey = 'default'): NPCProfile | undefined {
  return getStore(campaignKey).get(name.trim())
}

export function getNPCProfileById(id: string, campaignKey = 'default'): NPCProfile | undefined {
  const normalizedId = id.trim().toLowerCase()
  return Array.from(getStore(campaignKey).values()).find(profile => profile.id === normalizedId)
}

export function registerNPCProfile(profile: Omit<NPCProfile, 'id'> & { id?: string }, campaignKey = 'default'): NPCProfile {
  const store = getStore(campaignKey)
  const normalizedName = canonicalizeNpcName(profile.name.trim())
  const existing = store.get(normalizedName)
  if (existing) {
    return existing
  }

  const incomingId = (profile.id || '').trim().toLowerCase()
  const id = incomingId || slugify(normalizedName)
  const existingById = getNPCProfileById(id, campaignKey)
  if (existingById) {
    store.set(normalizedName, existingById)
    return existingById
  }

  // Corin is no longer a global default — only register if explicitly created
  if (isCorinAlias(normalizedName) || id === corinProfile.id) {
    store.set(corinProfile.name, corinProfile)
    store.set(normalizedName, corinProfile)
    return corinProfile
  }

  const dialogueColorId = profile.dialogueColorId || assignDialogueColorId(id)
  const stored: NPCProfile = { ...profile, name: normalizedName, id, dialogueColorId }
  store.set(normalizedName, stored)
  return stored
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const RU_EXACT_NAME_MAP: Record<string, string> = {
  'corin the barkeep': 'Корин, трактирщик',
  corin: 'Корин'
}

const hasCyrillic = (value: string): boolean => /[А-Яа-яЁё]/.test(value)

const transliterateLatinToCyrillic = (value: string): string => {
  const source = value
  const pairs: Array<[RegExp, string]> = [
    [/shch/gi, 'щ'],
    [/sch/gi, 'щ'],
    [/yo/gi, 'ё'],
    [/yu/gi, 'ю'],
    [/ya/gi, 'я'],
    [/zh/gi, 'ж'],
    [/ch/gi, 'ч'],
    [/sh/gi, 'ш'],
    [/kh/gi, 'х'],
    [/ts/gi, 'ц'],
    [/th/gi, 'т'],
    [/a/gi, 'а'],
    [/b/gi, 'б'],
    [/c/gi, 'к'],
    [/d/gi, 'д'],
    [/e/gi, 'е'],
    [/f/gi, 'ф'],
    [/g/gi, 'г'],
    [/h/gi, 'х'],
    [/i/gi, 'и'],
    [/j/gi, 'й'],
    [/k/gi, 'к'],
    [/l/gi, 'л'],
    [/m/gi, 'м'],
    [/n/gi, 'н'],
    [/o/gi, 'о'],
    [/p/gi, 'п'],
    [/q/gi, 'к'],
    [/r/gi, 'р'],
    [/s/gi, 'с'],
    [/t/gi, 'т'],
    [/u/gi, 'у'],
    [/v/gi, 'в'],
    [/w/gi, 'в'],
    [/x/gi, 'кс'],
    [/y/gi, 'и'],
    [/z/gi, 'з']
  ]

  let out = source
  for (const [pattern, replacement] of pairs) {
    out = out.replace(pattern, replacement)
  }
  return out
}

const capitalizeCyrWord = (value: string): string => {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function localizeNpcName(name: string, language: 'en' | 'ru' = 'en'): string {
  const safeName = String(name || '').trim()
  if (!safeName) return safeName
  if (language !== 'ru') return safeName
  if (hasCyrillic(safeName)) return safeName

  const exact = RU_EXACT_NAME_MAP[safeName.toLowerCase()]
  if (exact) return exact

  const translated = safeName
    .split(/\s+/)
    .filter(Boolean)
    .map(token => {
      const lower = token.toLowerCase()
      if (lower === 'the') return ''
      if (lower === 'barkeep') return 'трактирщик'
      if (lower === 'guard') return 'стражник'
      if (lower === 'merchant') return 'купец'
      if (lower === 'innkeeper') return 'хозяин таверны'
      return capitalizeCyrWord(transliterateLatinToCyrillic(token.toLowerCase()))
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return translated || safeName
}

const isCorinAlias = (value: string): boolean => {
  const lowered = value.toLowerCase()
  if (/\bcorin\b/.test(lowered)) return true
  if (lowered.includes('корин')) return true
  return false
}

const canonicalizeNpcName = (rawName: string): string => {
  const trimmed = String(rawName || '').trim()
  if (!trimmed) return trimmed
  if (isCorinAlias(trimmed)) {
    return corinProfile.name
  }
  return trimmed
}

const displayNameFromNpcId = (npcId: string): string => {
  const stripped = npcId.replace(/^npc[-_]/i, '').replace(/[_-]+/g, ' ').trim()
  if (!stripped) return 'Unknown'
  return stripped
    .split(' ')
    .map(word => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ')
}

export function ensureNPCProfileById(
  npcId: string,
  campaignKey = 'default',
  options?: { location?: string; contextSnippet?: string }
): NPCProfile {
  const store = getStore(campaignKey)
  const normalizedId = String(npcId || '').trim().toLowerCase()
  if (!normalizedId) {
    // No longer fall back to Corin — create a generic unknown NPC
    return registerNPCProfile({
      id: `unknown-${Date.now()}`,
      name: 'Unknown',
      age: 'unknown', occupation: 'unknown', firstImpression: '',
      innerCharacter: '', primaryMotivation: '', secondaryMotivation: '',
      secret: '', voice: '', behaviorQuirks: '', relationshipToLocation: 'unknown',
      potentialHook: '', location: options?.location, contextSnippet: options?.contextSnippet
    }, campaignKey)
  }
  const existing = getNPCProfileById(normalizedId, campaignKey)
  if (existing) {
    return existing
  }
  if (normalizedId === corinProfile.id) {
    store.set(corinProfile.name, corinProfile)
    return corinProfile
  }

  const fallbackName = displayNameFromNpcId(normalizedId)
  return registerNPCProfile({
    id: normalizedId,
    name: fallbackName,
    dialogueColorId: assignDialogueColorId(normalizedId),
    age: 'unknown', occupation: 'unknown', firstImpression: '',
    innerCharacter: '', primaryMotivation: '', secondaryMotivation: '',
    secret: '', voice: '', behaviorQuirks: '', relationshipToLocation: options?.location || 'unknown',
    potentialHook: '', location: options?.location, contextSnippet: options?.contextSnippet
  }, campaignKey)
}
