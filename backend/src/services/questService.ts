import { db } from '../db/db.js'
import { quests } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'

export interface QuestData {
  id: string
  sessionId: string
  title: string
  description: string
  status: 'active' | 'completed' | 'failed'
  objectives: string[]
}

const serializeObjectives = (objectives: string[]): string => JSON.stringify(objectives)
const parseObjectives = (objectivesJson: string): string[] => JSON.parse(objectivesJson)

export const createQuest = async (quest: Omit<QuestData, 'id'> & { id?: string }): Promise<QuestData> => {
  const id = quest.id || `quest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const now = Date.now()
  
  await db.insert(quests).values({
    id,
    sessionId: quest.sessionId,
    title: quest.title,
    description: quest.description,
    status: quest.status,
    objectives: serializeObjectives(quest.objectives),
    createdAt: now,
    updatedAt: now
  })
  
  return { ...quest, id }
}

export const getQuestsForSession = async (sessionId: string): Promise<QuestData[]> => {
  const results = await db.select().from(quests).where(eq(quests.sessionId, sessionId))
  return results.map(row => ({
    id: row.id,
    sessionId: row.sessionId,
    title: row.title,
    description: row.description,
    status: row.status as 'active' | 'completed' | 'failed',
    objectives: parseObjectives(row.objectives)
  }))
}

export const updateQuest = async (id: string, updates: Partial<Omit<QuestData, 'id' | 'sessionId'>>): Promise<void> => {
  const values: any = { updatedAt: Date.now() }
  if (updates.title !== undefined) values.title = updates.title
  if (updates.description !== undefined) values.description = updates.description
  if (updates.status !== undefined) values.status = updates.status
  if (updates.objectives !== undefined) values.objectives = serializeObjectives(updates.objectives)
  
  await db.update(quests).set(values).where(eq(quests.id, id))
}
