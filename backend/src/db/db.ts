import fs from 'fs'
import path from 'path'
import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

// On Railway, process.cwd() is the persistent volume root — data/ is auto-created here on first run.
const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbFilePath = path.join(dataDir, 'rollia.db')
const sqlite = new Database(dbFilePath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

sqlite.exec(`
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT,
  class TEXT,
  backstory TEXT,
  stats TEXT,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  character_id TEXT,
  history TEXT,
  world_state TEXT,
  updated_at INTEGER,
  FOREIGN KEY (character_id) REFERENCES characters(id)
);

CREATE TABLE IF NOT EXISTS backstory_arcs (
  character_key TEXT PRIMARY KEY,
  profile_json TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS quests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  objectives TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS npc_relationships (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  npc_id TEXT NOT NULL,
  npc_name TEXT NOT NULL,
  affinity INTEGER NOT NULL,
  notes TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
`)

export const rawDb: DatabaseType = sqlite
export const db = drizzle(sqlite)

