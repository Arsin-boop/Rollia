const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '')

// Test backend connection
export async function testBackendConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/api/health`)
    return response.ok
  } catch (error) {
    console.error('Backend connection test failed:', error)
    return false
  }
}

export interface CustomClassResponse {
  className: string
  stats: {
    strength: number
    dexterity: number
    constitution: number
    intelligence: number
    wisdom: number
    charisma: number
  }
  hitDie: string
  proficiencies: string[]
  features: string[]
  description: string
}

export interface DMResponse {
  response: string
  diceRolls?: Array<{
    type: string
    result: number
    rolls: number[]
  }>
  requiresRoll?: boolean
  rollType?: string
  optionalRollType?: string
  pending_check?: {
    id: string
    type: string
    actor: string
    target?: string | null
    stat: string
    difficulty: string | number
    context: string
    reason?: string
  } | null
  ui?: { showRoll?: boolean }
  checkRequest?: {
    id?: string
    type?: string
    actor?: string
    stat?: string
    difficulty?: string
    context?: string
    on_success?: string
    on_failure?: string
  }
  npcRegistry?: Array<{
    id: string
    name: string
    dialogueColorId: string
  }>
  npcPalette?: Array<{
    id: string
    color: string
    glow?: string
  }>
}

export interface CharacterRecord {
  id: string
  name?: string
  class?: string
  classDescription?: string
  backstory?: string
  appearance?: string
  appearanceDescription?: string
  appearanceSpec?: CharacterAppearanceSpec
  appearanceSpecMeta?: { confidence: number; warnings: string[] }
  derivedAvatarClassTags?: string[]
  avatarPrompt?: { prompt: string; negativePrompt?: string }
  avatarUrl?: string | null
  avatarHash?: string | null
  avatarStatus?: 'pending' | 'ready' | 'failed'
  avatarError?: string | null
}

export type CharacterAppearanceSpec = {
  sex: 'male' | 'female' | 'unknown'
  genderPresentation: 'masculine' | 'feminine' | 'androgynous' | 'unknown'
  ageRange: 'teen' | '20s' | '30s' | '40s' | '50+' | 'unknown'
  hairLength: 'short' | 'medium' | 'long' | 'unknown'
  bodyType: 'slim' | 'average' | 'athletic' | 'muscular' | 'unknown'
  notableFeatures: string[]
  clothingStyle: string[]
  palette: string[]
  confidence: number
}

export interface GeneratedQuest {
  id: string
  title: string
  summary: string
  hook: string
  xp: number
  recommendedLevel: number
  objectives: string[]
}

export interface DiceRoll {
  type: string
  result: number
  rolls: number[]
  modifier?: number
  total: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type StatusDurationType = 'rounds' | 'minutes' | 'scene' | 'until_removed'

export interface StatusEffect {
  id: string
  name: string
  type: 'condition' | 'buff' | 'debuff'
  mechanics: string
  trigger: string
  modifiers: StatusModifiers
  restrictions: StatusRestrictions
  narrationCues: string[]
  duration: { type: StatusDurationType; value?: number }
  cure?: string
  source?: string
  severity?: number
  appliedAt?: number
}

export interface StatusModifiers {
  attackRolls?: string
  abilityChecks?: string
  savingThrows?: string
  skillChecks?: string
  damage?: string
  movementSpeed?: string
  perceptionSight?: string
  actionAvailability?: string
  hpMax?: string
}

export interface StatusRestrictions {
  canAct?: boolean
  canMove?: boolean
  canSpeak?: boolean
  reactionsAllowed?: boolean
  movementSpeedMultiplier?: number
  cannotApproachSource?: boolean
  cannotTargetCharmer?: boolean
  special?: string
}

export interface StatusUpdatePayload {
  apply: StatusEffect[]
  update: StatusEffect[]
  remove: Array<{ id: string }>
}

export interface StatusStateInput {
  active_statuses: StatusEffect[]
}

export type CombatEntity = {
  id: string
  type: 'player' | 'enemy'
  name: string
  hp: number
  hp_max: number
  mp?: number
  mp_max?: number
  statuses: Array<{ key: string; duration: number }>
}

export type CombatEvent = {
  type: string
  data: Record<string, any>
}

export type CombatState = {
  id: string
  phase: 'starting' | 'player_turn' | 'enemy_turn' | 'resolving' | 'ended'
  round: number
  turn_index: number
  initiative_order: string[]
  entities: CombatEntity[]
  log: CombatEvent[]
}

export type ActionIntent = {
  action: 'attack' | 'defend' | 'move' | 'item' | 'spell' | 'attempt'
  actor: string
  target?: string | null
  params?: Record<string, any>
  free_text?: string | null
  risk?: 'low' | 'medium' | 'high'
}

// Generate custom class
export async function generateCustomClass(description: string): Promise<CustomClassResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/character/generate-class`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('API Error:', errorData)
      throw new Error(errorData.error || `Failed to generate custom class (${response.status})`)
    }

    return response.json()
  } catch (error: any) {
    console.error('generateCustomClass error:', error)
    if (error.message) {
      throw error
    }
    throw new Error(`Network error: ${error.message || 'Could not connect to backend'}`)
  }
}

// Get DM response
export async function getDMResponse(
  playerAction: string,
  characterInfo: any,
  gameContext?: string,
  history?: ChatMessage[],
  options?: {
    campaignId?: string
    rollResult?: {
      total?: number
      result?: number
      success?: boolean
      d20?: number
      bonus?: number
      stat?: string
      label?: string
      dc?: number
    }
    pendingCheckId?: string
    playerSnapshot?: { hp?: number; mp?: number }
  }
): Promise<DMResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/game/dm-response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerAction,
        characterInfo,
        gameContext,
        history,
        campaignId: options?.campaignId,
        rollResult: options?.rollResult,
        pendingCheckId: options?.pendingCheckId,
        playerSnapshot: options?.playerSnapshot
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('API Error:', errorData)
      throw new Error(errorData.error || `Failed to get DM response (${response.status})`)
    }

    return response.json()
  } catch (error: any) {
    console.error('getDMResponse error:', error)
    if (error.message) {
      throw error
    }
    throw new Error(`Network error: ${error.message || 'Could not connect to backend'}`)
  }
}

export async function summarizeScene(history: ChatMessage[]): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/game/summarize-scene`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ history }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('Summarize API Error:', errorData)
      throw new Error(errorData.error || `Failed to summarize scene (${response.status})`)
    }

    const data = await response.json()
    return data.summary || ''
  } catch (error: any) {
    console.error('summarizeScene error:', error)
    if (error.message) {
      throw error
    }
    throw new Error(`Network error: ${error.message || 'Could not connect to backend'}`)
  }
}

export async function getStatusUpdate(
  history: ChatMessage[],
  statusState: StatusStateInput
): Promise<StatusUpdatePayload> {
  try {
    const response = await fetch(`${API_BASE_URL}/game/status-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ history, statusState }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('Status update API Error:', errorData)
      throw new Error(errorData.error || `Failed to update status (${response.status})`)
    }

    return response.json()
  } catch (error: any) {
    console.error('getStatusUpdate error:', error)
    if (error.message) {
      throw error
    }
    throw new Error(`Network error: ${error.message || 'Could not connect to backend'}`)
  }
}

export async function startBattle(payload: {
  campaignId: string
  player: {
    id: string
    name: string
    hp: number
    hp_max: number
    mp?: number
    mp_max?: number
  }
  enemies: Array<{ id?: string; name: string; hp: number; hp_max?: number }>
}): Promise<{ battle: CombatState; events: CombatEvent[] }> {
  const response = await fetch(`${API_BASE_URL}/battle/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `Failed to start battle (${response.status})`)
  }

  return response.json()
}

export async function actBattle(payload: {
  campaignId: string
  intent: ActionIntent
  context?: string
  playerSnapshot?: { hp?: number; mp?: number }
}): Promise<{ battle: CombatState; events: CombatEvent[]; narration: string }> {
  const response = await fetch(`${API_BASE_URL}/battle/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `Failed to resolve battle action (${response.status})`)
  }

  return response.json()
}

export async function getBattleState(campaignId: string): Promise<{ battle: CombatState }> {
  const response = await fetch(`${API_BASE_URL}/battle/state/${campaignId}`)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `Failed to load battle state (${response.status})`)
  }
  return response.json()
}

export async function generateQuestFromBackstory(
  backstory: string,
  characterName: string,
  characterClass: string
): Promise<GeneratedQuest> {
  const response = await fetch(`${API_BASE_URL}/game/generate-quest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ backstory, characterName, characterClass })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    console.error('generateQuest error:', errorData)
    throw new Error(errorData.error || `Failed to generate quest (${response.status})`)
  }

  return response.json()
}

export async function saveCharacterAppearance(payload: {
  characterId?: string | null
  appearance: string
  name?: string
  class?: string
  classDescription?: string
  backstory?: string
  forceRegenerate?: boolean
  regenNonce?: number
}): Promise<CharacterRecord> {
  const response = await fetch(`${API_BASE_URL}/character/appearance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `Failed to save appearance (${response.status})`)
  }

  return response.json()
}

export async function getCharacter(characterId: string): Promise<CharacterRecord> {
  const response = await fetch(`${API_BASE_URL}/character/${characterId}`)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `Failed to fetch character (${response.status})`)
  }
  return response.json()
}

export async function summarizeBackstory(backstory: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/game/summarize-backstory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ backstory })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    console.error('summarizeBackstory error:', errorData)
    throw new Error(errorData.error || `Failed to summarize backstory (${response.status})`)
  }

  const data = await response.json()
  return data.summary || ''
}

// Roll dice
export async function rollDice(notation: string): Promise<DiceRoll> {
  const response = await fetch(`${API_BASE_URL}/dice/roll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notation }),
  })

  if (!response.ok) {
    throw new Error('Failed to roll dice')
  }

  return response.json()
}

// Roll d20
export async function rollD20(modifier: number = 0): Promise<DiceRoll> {
  const response = await fetch(`${API_BASE_URL}/dice/roll-d20`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modifier }),
  })

  if (!response.ok) {
    throw new Error('Failed to roll d20')
  }

  return response.json()
}

// Perform skill check
export async function performSkillCheck(
  skill: string,
  ability: string,
  abilityScore: number,
  proficiencyBonus: number,
  isProficient: boolean,
  dc?: number
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/dice/skill-check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skill,
      ability,
      abilityScore,
      proficiencyBonus,
      isProficient,
      dc,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to perform skill check')
  }

  return response.json()
}

// Perform saving throw
export async function performSavingThrow(
  ability: string,
  abilityScore: number,
  proficiencyBonus: number,
  isProficient: boolean,
  dc?: number
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/dice/saving-throw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ability,
      abilityScore,
      proficiencyBonus,
      isProficient,
      dc,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to perform saving throw')
  }

  return response.json()
}

