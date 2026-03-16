import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  name: text('name'),
  class: text('class'),
  backstory: text('backstory'),
  stats: text('stats'),
  payload: text('payload').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  characterId: text('character_id').references(() => characters.id),
  history: text('history'),
  worldState: text('world_state'),
  updatedAt: integer('updated_at')
})

export const backstoryArcs = sqliteTable('backstory_arcs', {
  characterKey: text('character_key').primaryKey(),
  profileJson: text('profile_json').notNull(),
  planJson: text('plan_json').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const quests = sqliteTable('quests', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id).notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull(), // 'active', 'completed', 'failed'
  objectives: text('objectives').notNull(), // JSON array of objectives
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const npcRelationships = sqliteTable('npc_relationships', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id).notNull(),
  npcId: text('npc_id').notNull(),
  npcName: text('npc_name').notNull(),
  affinity: integer('affinity').notNull(), // scale e.g. 0 to 100, or -50 to +50
  notes: text('notes'),
  updatedAt: integer('updated_at').notNull()
})

