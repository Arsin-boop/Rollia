import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { eq } from 'drizzle-orm'
import { db } from '../db/db.js'
import { characters } from '../db/schema.js'

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

const toMs = (isoLike: string | undefined): number => {
  if (!isoLike) return Date.now()
  const parsed = Date.parse(isoLike)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString()
  }
  return new Date().toISOString()
}

const decodeRow = (row: { payload: string; createdAt: number | string; updatedAt: number | string }): CharacterRecord | null => {
  try {
    const parsed = JSON.parse(row.payload || '{}') as Partial<CharacterRecord>
    if (!parsed?.id) return null
    return {
      ...(parsed as CharacterRecord),
      createdAt: parsed.createdAt || toIso(row.createdAt),
      updatedAt: parsed.updatedAt || toIso(row.updatedAt)
    }
  } catch {
    return null
  }
}

export const createCharacterId = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return crypto.randomBytes(16).toString('hex')
}

export const getCharacter = (id: string): CharacterRecord | null => {
  const rows = db.select().from(characters).where(eq(characters.id, id)).all()
  if (!rows.length) return null
  return decodeRow(rows[0] as any)
}

export const saveCharacter = (record: CharacterRecord): CharacterRecord => {
  const createdAtMs = toMs(record.createdAt)
  const updatedAtMs = toMs(record.updatedAt)

  db.insert(characters)
    .values({
      id: record.id,
      name: record.name || null,
      class: record.class || null,
      backstory: record.backstory || null,
      stats: null,
      payload: JSON.stringify(record),
      createdAt: createdAtMs,
      updatedAt: updatedAtMs
    })
    .onConflictDoUpdate({
      target: characters.id,
      set: {
        name: record.name || null,
        class: record.class || null,
        backstory: record.backstory || null,
        payload: JSON.stringify(record),
        updatedAt: updatedAtMs
      }
    })
    .run()

  return record
}

export const upsertCharacter = (id: string, updates: Partial<CharacterRecord>): CharacterRecord => {
  const now = new Date().toISOString()
  const existing = getCharacter(id)
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

  saveCharacter(record)
  return record
}

export const updateCharacter = (id: string, updates: Partial<CharacterRecord>): CharacterRecord | null => {
  const existing = getCharacter(id)
  if (!existing) {
    return null
  }
  return upsertCharacter(id, updates)
}

const migrateLegacyCharacterJson = () => {
  try {
    const legacyPath = path.join(process.cwd(), 'data', 'characters.json')
    if (!fs.existsSync(legacyPath)) return
    const raw = fs.readFileSync(legacyPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    parsed.forEach((entry: any) => {
      if (!entry?.id) return
      if (getCharacter(entry.id)) return
      const nowIso = new Date().toISOString()
      const record: CharacterRecord = {
        ...entry,
        id: entry.id,
        createdAt: entry.createdAt || nowIso,
        updatedAt: entry.updatedAt || nowIso
      }
      saveCharacter(record)
    })
  } catch (error) {
    console.error('Failed to migrate legacy characters.json:', error)
  }
}

migrateLegacyCharacterJson()
