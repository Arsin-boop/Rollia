import { db } from '../db/db.js'
import { npcRelationships } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'

export interface NPCRelationshipData {
  id: string
  sessionId: string
  npcId: string
  npcName: string
  affinity: number
  notes: string | null
}

export const syncNPCRelationship = async (
  sessionId: string,
  npcId: string,
  npcName: string,
  affinityDelta: number,
  notes: string | null = null
): Promise<NPCRelationshipData> => {
  const existing = await db
    .select()
    .from(npcRelationships)
    .where(and(eq(npcRelationships.sessionId, sessionId), eq(npcRelationships.npcId, npcId)))
    .limit(1)

  const now = Date.now()

  if (existing.length > 0) {
    const current = existing[0]
    const newAffinity = Math.max(-100, Math.min(100, current.affinity + affinityDelta))
    const updatedNotes = notes ? (current.notes ? `${current.notes}\n${notes}` : notes) : current.notes
    
    await db.update(npcRelationships).set({
      npcName, // in case it changed
      affinity: newAffinity,
      notes: updatedNotes,
      updatedAt: now
    }).where(eq(npcRelationships.id, current.id))
    
    return {
      id: current.id,
      sessionId,
      npcId,
      npcName,
      affinity: newAffinity,
      notes: updatedNotes
    }
  } else {
    const newId = `rel_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const initialAffinity = Math.max(-100, Math.min(100, affinityDelta)) // base 0 + delta
    
    await db.insert(npcRelationships).values({
      id: newId,
      sessionId,
      npcId,
      npcName,
      affinity: initialAffinity,
      notes,
      updatedAt: now
    })
    
    return {
      id: newId,
      sessionId,
      npcId,
      npcName,
      affinity: initialAffinity,
      notes
    }
  }
}

export const getNPCRelationshipsForSession = async (sessionId: string): Promise<NPCRelationshipData[]> => {
  const results = await db.select().from(npcRelationships).where(eq(npcRelationships.sessionId, sessionId))
  return results.map(row => ({
    id: row.id,
    sessionId: row.sessionId,
    npcId: row.npcId,
    npcName: row.npcName,
    affinity: row.affinity,
    notes: row.notes
  }))
}

export const getNPCRelationshipSummaryText = async (sessionId: string): Promise<string> => {
  const relationships = await getNPCRelationshipsForSession(sessionId)
  if (relationships.length === 0) return ''
  
  const summaries = relationships.map(rel => {
    let standing = 'neutral'
    if (rel.affinity > 50) standing = 'devoted'
    else if (rel.affinity > 20) standing = 'friendly'
    else if (rel.affinity < -50) standing = 'hostile'
    else if (rel.affinity < -20) standing = 'unfriendly'
    
    return `${rel.npcName} (${standing}, affinity: ${rel.affinity})${rel.notes ? `: ${rel.notes}` : ''}`
  })
  
  return `KNOWN NPC RELATIONSHIPS:\n${summaries.join('\n')}`
}
