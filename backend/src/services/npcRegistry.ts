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

const npcStore = new Map<string, NPCProfile>()

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

npcStore.set(corinProfile.name, corinProfile)

export function listNPCDialoguePalette(): NPCDialoguePaletteEntry[] {
  return NPC_DIALOGUE_PALETTE.slice()
}

export function listNPCProfiles(): NPCProfile[] {
  return Array.from(npcStore.values())
}

export function getNPCProfile(name: string): NPCProfile | undefined {
  return npcStore.get(name.trim())
}

export function getNPCProfileById(id: string): NPCProfile | undefined {
  const normalizedId = id.trim().toLowerCase()
  return Array.from(npcStore.values()).find(profile => profile.id === normalizedId)
}

export function registerNPCProfile(profile: Omit<NPCProfile, 'id'> & { id?: string }): NPCProfile {
  const normalizedName = profile.name.trim()
  const existing = npcStore.get(normalizedName)
  if (existing) {
    return existing
  }

  const id = profile.id || slugify(normalizedName)
  const dialogueColorId = profile.dialogueColorId || assignDialogueColorId(id)
  const stored: NPCProfile = { ...profile, id, dialogueColorId }
  npcStore.set(normalizedName, stored)
  return stored
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
