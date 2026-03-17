import { generateAIResponse, type PreferredLanguage } from './aiService.js'
import { ensureNPCProfileById } from './npcRegistry.js'

export interface SceneState {
  location: string
  timeOfDay?: string
  activeNPCs: string[]
  sceneGoal?: string
  tensionLevel?: 'low' | 'medium' | 'high'
}

export interface NarrativeContext {
  playerAction: string
  directorNotes: string
  worldState: Record<string, unknown>
  playerProfile: Record<string, unknown>
  memoryContext: string
  location: string
  recentEvents: string[]
  sceneState?: SceneState
  campaignKey?: string
}

export interface NarrativeSceneMeta {
  location: string
  time: string
}

export interface NarrativeResult {
  scene: NarrativeSceneMeta
  narration: string
  choices: string[]
}

const safeString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const normalizeChoices = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean)
        .slice(0, 3)
    : []

const isValidNarrative = (value: Partial<NarrativeResult>): value is NarrativeResult =>
  typeof value.scene?.location === 'string' &&
  value.scene.location.trim().length > 0 &&
  typeof value.scene?.time === 'string' &&
  value.scene.time.trim().length > 0 &&
  typeof value.narration === 'string' &&
  value.narration.trim().length > 0 &&
  Array.isArray(value.choices) &&
  value.choices.length === 3 &&
  value.choices.every(choice => typeof choice === 'string' && choice.trim().length > 0)

export function buildNarrativePrompt(
  context: NarrativeContext,
  language: PreferredLanguage = 'en'
): string {
  const npcMood = (context.worldState as any)?.npcMood || null
  const worldStateBlock = JSON.stringify(context.worldState || {}, null, 2)
  const profileBlock = JSON.stringify(context.playerProfile || {}, null, 2)
  const recentEventsBlock = (context.recentEvents || []).length
    ? context.recentEvents.map(event => `- ${event}`).join('\n')
    : '- none'
  const effectiveSceneState: SceneState = {
    location: safeString(context.sceneState?.location || context.location, 'Unknown location'),
    timeOfDay: safeString(context.sceneState?.timeOfDay, ''),
    activeNPCs: Array.isArray(context.sceneState?.activeNPCs)
      ? context.sceneState!.activeNPCs.filter(Boolean)
      : [],
    sceneGoal: safeString(context.sceneState?.sceneGoal, ''),
    tensionLevel: context.sceneState?.tensionLevel
  }
  const activeCharactersBlock = effectiveSceneState.activeNPCs.length
    ? effectiveSceneState.activeNPCs.map(name => `- ${name}`).join('\n')
    : '- none'
  const russianGrammarRules =
    language === 'ru'
      ? `
Russian grammar rules (mandatory):
- Use correct case inflection for nouns, names, and adjectives.
- Keep subject-verb agreement and number agreement in every sentence.
- Avoid ambiguous pronouns when multiple characters are present; repeat role/name.
- Keep consistent tense within each paragraph unless a clear transition is stated.
- Use natural Russian syntax; avoid calques from English.
- Do not mix Cyrillic and Latin in Russian narrative text.
- Before finalizing, self-check each sentence for declension and agreement errors.`
      : ''

  return `You are the Narrative Engine for Rollia.
You describe scenes only. You do not decide mechanics or world consequences.

OUTPUT FORMAT (CRITICAL):
- Return ONLY valid JSON.
- Do not write any explanations.
- Do not write any text before the JSON.
- Do not write any text after the JSON.
- Do not wrap JSON in markdown or code fences.
- The response must begin with "{" and end with "}".

Required JSON schema (exactly these fields):
{
  "scene": {
    "location": "string",
    "time": "string"
  },
  "narration": "string",
  "choices": ["string", "string", "string"]
}

Field rules:
- "scene.location" MUST match the Location provided in Context. NEVER change, move, or 'hallucinate' a location shift unless the Director Notes explicitly state a successful move occurred.
- "scene.time" MUST be consistent with Context → Time. Do NOT output "Unspecified" or vague terms; if unspecified, pick a concrete time and stick with it.
- "narration" must contain only narrative events and character actions.
- Do NOT include location or time inside "narration".
- Do NOT use game terms like "NPC", "Tension", "HP", "XP" inside "narration".
- "choices" must be an array with exactly 3 actionable elements.
- CHARACTER LOGIC: NPCs MUST act logically based on their history, mood, and recent events. They are NOT omniscient. 
- SPATIAL GROUNDING: Players and NPCs cannot teleport. Respect walls, floors, and distances.
- NO POETIC VAGUENESS: Avoid abstract metaphors (e.g., "shadows of fate") in favor of physical, concrete descriptions.
- CONSISTENCY: Do NOT contradict recent history or current world state.
${russianGrammarRules} in narration.
${russianGrammarRules}

Context:
Current Scene Context:
Location: ${effectiveSceneState.location}
Time: ${effectiveSceneState.timeOfDay || 'Unspecified'}
Tension Level: ${effectiveSceneState.tensionLevel || 'Unspecified'}

Active Characters:
${activeCharactersBlock}

Scene Goal:
${effectiveSceneState.sceneGoal || 'Not specified'}

Current World State:
${worldStateBlock}

NPC Emotional State:
${npcMood ? JSON.stringify(npcMood, null, 2) : 'Not provided'}

Recent Story Events:
${recentEventsBlock}

Memory Context:
${safeString(context.memoryContext, 'No memory context')}

Director Instructions (authoritative):
${safeString(context.directorNotes, 'No director notes')}

Player Profile:
${profileBlock}

Player Action:
${safeString(context.playerAction, '').trim()}`
}

export function parseNarrativeResponse(response: string): NarrativeResult | null {
  try {
    // Strip <think>...</think> blocks (Qwen3 thinking mode)
    let cleaned = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    // Strip markdown code fences
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    // Extract first {...} JSON object
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1) return null
    cleaned = cleaned.slice(start, end + 1)

    const parsed = JSON.parse(cleaned) as Partial<NarrativeResult>
    const candidate: Partial<NarrativeResult> = {
      scene:
        parsed.scene && typeof parsed.scene === 'object'
          ? {
              location: safeString((parsed.scene as NarrativeSceneMeta).location, '').trim(),
              time: safeString((parsed.scene as NarrativeSceneMeta).time, '').trim()
            }
          : undefined,
      narration: typeof parsed.narration === 'string' ? parsed.narration.trim() : '',
      choices: normalizeChoices(parsed.choices)
    }
    return isValidNarrative(candidate) ? candidate : null
  } catch {
    return null
  }
}

export async function runNarrativeEngine(
  context: NarrativeContext,
  language: PreferredLanguage = 'en'
): Promise<NarrativeResult> {
  const syncNpcRegistryFromNarration = (result: NarrativeResult) => {
    const narration = result.narration || ''
    const regex = /<npc\s+id="([^"]+)"/gi
    let match: RegExpExecArray | null
    while ((match = regex.exec(narration)) !== null) {
      const npcId = (match[1] || '').trim()
      if (!npcId) continue
      ensureNPCProfileById(npcId, context.campaignKey || 'default', {
        location: result.scene.location || context.sceneState?.location || context.location,
        contextSnippet: narration.slice(0, 500)
      })
    }
  }

  const prompt = buildNarrativePrompt(context, language)
  const callModel = async (extraInstruction?: string): Promise<string> =>
    await generateAIResponse({
      systemPrompt: 'You are a deterministic RPG narrative formatter. Keep formatting strict and narration grounded.',
      userPrompt:
        extraInstruction
          ? `${prompt}\n\n${language === 'ru' ? 'Output in Russian (Cyrillic).' : 'Output in English.'}\n\n${extraInstruction}`
          : `${prompt}\n\n${language === 'ru' ? 'Output in Russian (Cyrillic).' : 'Output in English.'}`,
      temperature: 0.3, // Lowered temperature to reduce hallucinations/poetry
      maxTokens: 900,
      taskType: 'DM_NARRATION'
    })

  const firstRaw = await callModel()
  const firstParsed = parseNarrativeResponse(firstRaw)
  if (firstParsed) {
    syncNpcRegistryFromNarration(firstParsed)
    return firstParsed
  }

  const retryRaw = await callModel(
    'Retry. Return strictly valid JSON with non-empty scene.location, scene.time, narration, and exactly 3 non-empty choices.'
  )
  const retryParsed = parseNarrativeResponse(retryRaw)
  if (retryParsed) {
    syncNpcRegistryFromNarration(retryParsed)
    return retryParsed
  }

  const fallback: NarrativeResult = {
    scene: {
      location: safeString(
        context.sceneState?.location || context.location,
        language === 'ru' ? 'Неизвестная локация' : 'Unknown location'
      ),
      time: safeString(
        context.sceneState?.timeOfDay,
        language === 'ru' ? 'Сейчас' : 'Present'
      )
    },
    narration: language === 'ru'
      ? `Воздух в помещении становится тяжелее, и внимание окружающих смещается к вашему действию.
<npc id="corin-blackbriar">"Я вижу, к чему это ведёт. Действуй осторожно."</npc>
Обстановка меняется, и последствия уже начинают проявляться.`
      : `Pressure rises in the room as attention shifts toward your action.
<npc id="corin-blackbriar">"I can see where this is going. Choose your next step carefully."</npc>
The situation changes, and consequences begin to unfold.`,
    choices: language === 'ru'
      ? ['Осмотреть обстановку', 'Заговорить с NPC', 'Продвинуться вперёд']
      : ['Survey the area', 'Speak to the NPC', 'Push forward']
  }
  syncNpcRegistryFromNarration(fallback)
  return fallback
}
