/**
 * Vector Memory Service
 * Stores and recalls session memories using Groq embeddings (nomic-embed-text-v1.5).
 * Embeddings are stored as JSON float arrays in SQLite; recall uses cosine similarity in JS.
 */

import OpenAI from 'openai'
import { rawDb } from '../db/db.js'

const EMBED_MODEL = 'nomic-embed-text-v1.5'
const MAX_MEMORIES_PER_SESSION = 200
const MAX_CONTENT_LENGTH = 800

const groqBaseUrl = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
const apiKey = process.env.GROQ_API_KEY_PRIMARY || process.env.GROQ_API_KEY || ''

let embedClient: OpenAI | null = null
try {
  if (apiKey) {
    embedClient = new OpenAI({ apiKey, baseURL: groqBaseUrl })
  }
} catch {
  // Embeddings will be skipped if client fails to initialize
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na > 0 && nb > 0 ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

async function embedText(text: string): Promise<number[] | null> {
  if (!embedClient) return null
  try {
    const truncated = text.slice(0, MAX_CONTENT_LENGTH)
    const resp = await embedClient.embeddings.create({ model: EMBED_MODEL, input: truncated })
    return resp.data[0]?.embedding ?? null
  } catch (err: any) {
    console.warn('[VectorMemory] Embed failed:', err?.message || err)
    return null
  }
}

function newId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Store a player action or DM narration as a memory for later recall.
 */
export async function addMemory(
  sessionId: string,
  role: 'player' | 'assistant',
  content: string
): Promise<void> {
  const text = content.trim().slice(0, MAX_CONTENT_LENGTH)
  if (!text) return

  const embedding = await embedText(text)
  if (!embedding) return

  try {
    // Evict oldest if over the cap
    const count = (rawDb.prepare('SELECT COUNT(*) as c FROM memories WHERE session_id = ?').get(sessionId) as any)?.c ?? 0
    if (count >= MAX_MEMORIES_PER_SESSION) {
      rawDb.prepare(
        'DELETE FROM memories WHERE id = (SELECT id FROM memories WHERE session_id = ? ORDER BY created_at ASC LIMIT 1)'
      ).run(sessionId)
    }

    rawDb.prepare(
      'INSERT INTO memories (id, session_id, role, content, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(newId(), sessionId, role, text, JSON.stringify(embedding), Date.now())
  } catch (err: any) {
    console.warn('[VectorMemory] Store failed:', err?.message || err)
  }
}

/**
 * Recall the top-K most semantically relevant memories for a given query.
 * Returns them as formatted strings: "[player] ..." or "[dm] ..."
 */
export async function recallMemories(
  sessionId: string,
  query: string,
  topK = 5
): Promise<string[]> {
  const queryEmbedding = await embedText(query)
  if (!queryEmbedding) return []

  try {
    const rows = rawDb.prepare(
      'SELECT role, content, embedding FROM memories WHERE session_id = ? ORDER BY created_at DESC LIMIT 100'
    ).all(sessionId) as Array<{ role: string; content: string; embedding: string }>

    if (rows.length === 0) return []

    const scored = rows
      .map(row => {
        try {
          const vec = JSON.parse(row.embedding) as number[]
          return { role: row.role, content: row.content, score: cosine(queryEmbedding, vec) }
        } catch {
          return null
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    return scored.map(r => `[${r.role === 'player' ? 'player' : 'dm'}] ${r.content}`)
  } catch (err: any) {
    console.warn('[VectorMemory] Recall failed:', err?.message || err)
    return []
  }
}

/**
 * Clear all memories for a session (used on reset).
 */
export function clearMemories(sessionId: string): void {
  try {
    rawDb.prepare('DELETE FROM memories WHERE session_id = ?').run(sessionId)
  } catch { /* ignore */ }
}
