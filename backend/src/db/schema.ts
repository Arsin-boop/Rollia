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
