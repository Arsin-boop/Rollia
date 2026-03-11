import { eq } from 'drizzle-orm'
import { db } from '../db/db.js'
import { sessions } from '../db/schema.js'

export type SessionHistoryMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type PersistedSessionPayload = {
  worldState?: unknown
  storyMemory?: unknown
  gameState?: unknown
}

export type SessionRecord = {
  id: string
  characterId?: string | null
  history: SessionHistoryMessage[]
  payload: PersistedSessionPayload
  updatedAt: number
}

const safeParse = <T>(raw: string | null | undefined, fallback: T): T => {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const getSession = (id: string): SessionRecord | null => {
  const row = db.select().from(sessions).where(eq(sessions.id, id)).get()
  if (!row) return null

  const history = safeParse<SessionHistoryMessage[]>(row.history, [])
  const payload = safeParse<PersistedSessionPayload>(row.worldState, {})

  return {
    id: row.id,
    characterId: row.characterId ?? null,
    history: Array.isArray(history) ? history : [],
    payload: payload && typeof payload === 'object' ? payload : {},
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : Date.now()
  }
}

export const upsertSession = (input: {
  id: string
  characterId?: string | null
  history: SessionHistoryMessage[]
  payload: PersistedSessionPayload
}): SessionRecord => {
  const now = Date.now()
  db.insert(sessions)
    .values({
      id: input.id,
      characterId: input.characterId ?? null,
      history: JSON.stringify(input.history),
      worldState: JSON.stringify(input.payload),
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: sessions.id,
      set: {
        characterId: input.characterId ?? null,
        history: JSON.stringify(input.history),
        worldState: JSON.stringify(input.payload),
        updatedAt: now
      }
    })
    .run()

  return {
    id: input.id,
    characterId: input.characterId ?? null,
    history: input.history,
    payload: input.payload,
    updatedAt: now
  }
}
