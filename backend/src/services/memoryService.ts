// Deterministic story memory service.
// This module stores short factual logs and compresses them into stable summaries.

export interface EventLogEntry {
  description: string
  type: string
  turnNumber: number
}

export interface StoryMemory {
  recentEvents: EventLogEntry[]
  storySummary: string[]
}

const normalizeSentence = (value: string): string => {
  const cleaned = (value || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  const noTrailing = cleaned.replace(/[.!?]+$/g, '')
  return `${noTrailing}.`
}

const toClause = (value: string): string => {
  const cleaned = (value || '').replace(/\s+/g, ' ').trim()
  return cleaned.replace(/[.!?]+$/g, '')
}

/**
 * Adds one event entry and keeps only the latest 10 entries in recentEvents.
 */
export function addEvent(
  memory: StoryMemory,
  description: string,
  type: string,
  turnNumber: number
): StoryMemory {
  const nextRecentEvents = [
    ...(memory?.recentEvents || []),
    {
      description: normalizeSentence(description),
      type: (type || 'unknown').trim().toLowerCase(),
      turnNumber
    }
  ].slice(-10)

  return {
    recentEvents: nextRecentEvents,
    storySummary: [...(memory?.storySummary || [])]
  }
}

/**
 * Generates a short factual log line for a turn from player action + director notes.
 * No narrative style, only compact state reporting.
 */
export function generateTurnLog(playerAction: string, directorNotes: string): string {
  const action = toClause(playerAction)
  const notes = toClause(directorNotes)

  if (action && notes) {
    return normalizeSentence(`Player action: ${action}. Outcome: ${notes}`)
  }
  if (action) {
    return normalizeSentence(`Player action: ${action}`)
  }
  if (notes) {
    return normalizeSentence(`Outcome: ${notes}`)
  }
  return 'No significant turn event.'
}

/**
 * When 5+ recent events exist, compress them into one factual summary entry and clear recentEvents.
 */
export function updateStorySummary(memory: StoryMemory): StoryMemory {
  const recentEvents = memory?.recentEvents || []
  const storySummary = [...(memory?.storySummary || [])]

  if (recentEvents.length < 5) {
    return {
      recentEvents: [...recentEvents],
      storySummary
    }
  }

  const batch = recentEvents.slice(0, 5)
  const firstTurn = batch[0]?.turnNumber
  const lastTurn = batch[batch.length - 1]?.turnNumber
  const uniqueTypes = Array.from(new Set(batch.map(entry => entry.type).filter(Boolean))).join(', ')

  const firstEvent = toClause(batch[0]?.description || '')
  const lastEvent = toClause(batch[batch.length - 1]?.description || '')

  const summary = normalizeSentence(
    `Turns ${firstTurn}-${lastTurn}: ${firstEvent}; ${lastEvent}. Types: ${uniqueTypes || 'unknown'}`
  )

  storySummary.push(summary)

  return {
    recentEvents: recentEvents.slice(5),
    storySummary
  }
}

/**
 * Builds a clean context block for AI narration prompts.
 */
export function buildContextForAI(memory: StoryMemory): string {
  const storySummary = memory?.storySummary || []
  const recentEvents = memory?.recentEvents || []

  const summaryBlock = storySummary.length
    ? storySummary.map(entry => `- ${toClause(entry)}`).join('\n')
    : '- None'

  const recentBlock = recentEvents.length
    ? recentEvents
        .map(entry => `- [Turn ${entry.turnNumber}] ${toClause(entry.description)}`)
        .join('\n')
    : '- None'

  return `Story Chronicle:\n${summaryBlock}\n\nRecent Events:\n${recentBlock}`
}

