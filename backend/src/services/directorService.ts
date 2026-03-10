// Minimal deterministic "Director" layer.
// This module owns world consequences so the narrator model only describes outcomes.

export type ActionType = 'violent' | 'social' | 'investigation' | 'exploration' | 'neutral'

export interface WorldState {
  tension: number
  guardsAlert: boolean
  npcMood: {
    anger: number
    suspicion: number
    trust: number
  }
}

export interface NPCState {
  anger: number
  suspicion: number
  trust: number
}

export interface NPCReaction {
  attitude: 'hostile' | 'cautious' | 'neutral' | 'friendly'
  angerDelta: number
  suspicionDelta: number
  trustDelta: number
  tensionDelta: number
  callGuards: boolean
  summary: string
}

export interface DirectorResult {
  actionType: ActionType
  npcReaction: NPCReaction
  updatedWorldState: WorldState
  directorNotes: string
}

export function processTurnWithActionType(
  playerInput: string,
  actionType: ActionType,
  worldState: WorldState,
  npcState: NPCState
): DirectorResult {
  const npcReaction = determineNPCReaction(actionType, npcState)
  const updatedWorldState = updateWorldState(worldState, npcReaction)

  const directorNotes = npcReaction.callGuards
    ? `${npcReaction.summary} Tension rises to ${updatedWorldState.tension}. Guards are now alerted.`
    : `${npcReaction.summary} Tension is now ${updatedWorldState.tension}.`

  return {
    actionType,
    npcReaction,
    updatedWorldState,
    directorNotes
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const normalizeText = (value: string): string => value.toLowerCase().trim()

const containsAny = (text: string, keywords: string[]): boolean =>
  keywords.some(keyword => text.includes(keyword))

/**
 * Classifies player input into one of the supported action categories.
 * MVP logic: straightforward keyword matching, ordered by priority.
 */
export function classifyAction(playerInput: string): ActionType {
  const text = normalizeText(playerInput)

  const violentKeywords = [
    'attack', 'hit', 'punch', 'kick', 'stab', 'slash', 'strike', 'kill', 'smash', 'shoot',
    'атак', 'удар', 'пнуть', 'пырнуть', 'убить', 'резать', 'стрелять'
  ]
  const socialKeywords = [
    'talk', 'speak', 'ask', 'persuade', 'negotiate', 'greet', 'apologize', 'threaten',
    'говор', 'спрос', 'убед', 'договор', 'поздор', 'извин'
  ]
  const investigationKeywords = [
    'inspect', 'investigate', 'search', 'examine', 'clue', 'question', 'interrogate', 'analyze',
    'осмотр', 'исслед', 'обыск', 'улик', 'допрос', 'анализ'
  ]
  const explorationKeywords = [
    'move', 'go', 'walk', 'travel', 'explore', 'enter', 'leave', 'climb', 'open door',
    'идти', 'двиг', 'исследоват', 'войти', 'выйти', 'лезть', 'открыть'
  ]

  if (containsAny(text, violentKeywords)) return 'violent'
  if (containsAny(text, socialKeywords)) return 'social'
  if (containsAny(text, investigationKeywords)) return 'investigation'
  if (containsAny(text, explorationKeywords)) return 'exploration'
  return 'neutral'
}

/**
 * Converts action type + current NPC state into a deterministic NPC reaction.
 */
export function determineNPCReaction(actionType: ActionType, npcState: NPCState): NPCReaction {
  switch (actionType) {
    case 'violent': {
      const highThreat = npcState.anger >= 50 || npcState.suspicion >= 60
      return {
        attitude: 'hostile',
        angerDelta: 20,
        suspicionDelta: 15,
        trustDelta: -15,
        tensionDelta: 20,
        callGuards: highThreat,
        summary: highThreat
          ? 'The NPC is furious and immediately calls for guards.'
          : 'The NPC becomes hostile and raises their voice.'
      }
    }
    case 'social':
      return {
        attitude: npcState.trust >= 50 ? 'friendly' : 'cautious',
        angerDelta: -5,
        suspicionDelta: -3,
        trustDelta: 8,
        tensionDelta: -2,
        callGuards: false,
        summary:
          npcState.trust >= 50
            ? 'The NPC responds openly and seems cooperative.'
            : 'The NPC remains cautious but engages in conversation.'
      }
    case 'investigation':
      return {
        attitude: 'cautious',
        angerDelta: 2,
        suspicionDelta: 10,
        trustDelta: -4,
        tensionDelta: 6,
        callGuards: npcState.suspicion >= 70,
        summary:
          npcState.suspicion >= 70
            ? 'The NPC notices the scrutiny and signals nearby guards.'
            : 'The NPC notices the scrutiny and grows suspicious.'
      }
    case 'exploration':
      return {
        attitude: 'neutral',
        angerDelta: 0,
        suspicionDelta: 1,
        trustDelta: 0,
        tensionDelta: 1,
        callGuards: false,
        summary: 'The NPC watches your movement but does not intervene.'
      }
    default:
      return {
        attitude: 'neutral',
        angerDelta: 0,
        suspicionDelta: 0,
        trustDelta: 0,
        tensionDelta: 0,
        callGuards: false,
        summary: 'No strong reaction from the NPC.'
      }
  }
}

/**
 * Applies NPC reaction effects to world state.
 * Keeps values bounded to stable gameplay ranges.
 */
export function updateWorldState(worldState: WorldState, reaction: NPCReaction): WorldState {
  return {
    tension: clamp(worldState.tension + reaction.tensionDelta, 0, 100),
    guardsAlert: worldState.guardsAlert || reaction.callGuards,
    npcMood: {
      anger: clamp(worldState.npcMood.anger + reaction.angerDelta, 0, 100),
      suspicion: clamp(worldState.npcMood.suspicion + reaction.suspicionDelta, 0, 100),
      trust: clamp(worldState.npcMood.trust + reaction.trustDelta, 0, 100)
    }
  }
}

/**
 * Main Director pipeline for one turn.
 * Produces deterministic consequences plus a concise narrator instruction.
 */
export function processTurn(
  playerInput: string,
  worldState: WorldState,
  npcState: NPCState
): DirectorResult {
  const actionType = classifyAction(playerInput)
  return processTurnWithActionType(playerInput, actionType, worldState, npcState)
}
