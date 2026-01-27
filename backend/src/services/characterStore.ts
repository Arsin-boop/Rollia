import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export type CharacterRecord = {
  id: string
  name?: string
  class?: string
  classDescription?: string
  backstory?: string
  appearance?: string | Record<string, any>
  appearanceDescription?: string
  appearanceSpec?: Record<string, any>
  appearanceSpecMeta?: { confidence: number; warnings: string[] }
  derivedAvatarClassTags?: string[]
  avatarPrompt?: { prompt: string; negativePrompt?: string }
  avatarUrl?: string | null
  avatarHash?: string | null
  avatarStatus?: 'pending' | 'ready' | 'failed'
  avatarError?: string | null
  createdAt: string
  updatedAt: string
}

const storeDir = path.join(process.cwd(), 'data')
const storePath = path.join(storeDir, 'characters.json')
const characters = new Map<string, CharacterRecord>()

const ensureStoreDir = () => {
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true })
  }
}

const loadStore = () => {
  try {
    if (!fs.existsSync(storePath)) {
      return
    }
    const raw = fs.readFileSync(storePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      parsed.forEach(entry => {
        if (entry?.id) {
          characters.set(entry.id, entry)
        }
      })
    }
  } catch (error) {
    console.error('Failed to load character store:', error)
  }
}

const persistStore = () => {
  try {
    ensureStoreDir()
    const payload = Array.from(characters.values())
    fs.writeFileSync(storePath, JSON.stringify(payload, null, 2), 'utf8')
  } catch (error) {
    console.error('Failed to persist character store:', error)
  }
}

export const createCharacterId = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return crypto.randomBytes(16).toString('hex')
}

export const getCharacter = (id: string): CharacterRecord | null => {
  return characters.get(id) || null
}

export const saveCharacter = (record: CharacterRecord): CharacterRecord => {
  characters.set(record.id, record)
  persistStore()
  return record
}

export const upsertCharacter = (id: string, updates: Partial<CharacterRecord>): CharacterRecord => {
  const now = new Date().toISOString()
  const existing = characters.get(id)
  const record: CharacterRecord = existing
    ? { ...existing, ...updates, updatedAt: now }
    : {
        id,
        createdAt: now,
        updatedAt: now,
        avatarStatus: 'pending',
        avatarUrl: null,
        avatarHash: null,
        ...updates
      }
  characters.set(id, record)
  persistStore()
  return record
}

export const updateCharacter = (id: string, updates: Partial<CharacterRecord>): CharacterRecord | null => {
  if (!characters.has(id)) {
    return null
  }
  return upsertCharacter(id, updates)
}

loadStore()
