/**
 * IMPROVED NARRATIVE ENGINE v2 for Rollia
 * 
 * Based on analysis of two campaign logs
 * Improvements:
 * - Stronger spatial logic requirements
 * - Explicit choices in every response
 * - Better separation of player action and description
 * - Enhanced anachronism detection
 * 
 * INSTALLATION:
 * 1. Copy narrativeValidator_v2.ts to backend/src/services/
 * 2. Replace backend/src/services/narrativeEngine.ts with this file
 */

import { generateAIResponse, streamNarrationTokens, type PreferredLanguage } from './aiService.js'
import { ensureNPCProfileById } from './npcRegistry.js'
import { narrativeValidator } from './narrativeValidator.js'

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

/**
 * IMPROVED v2: Enhanced narrative prompt with spatial logic and explicit choices
 */
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

  // IMPROVED v2: Comprehensive system prompt for Russian with spatial logic
  const systemPromptRU = `Ты — Мастер Подземелий в мире тёмного фэнтези. Твоя роль — создавать увлекательный, атмосферный нарратив, который полностью погружает игрока в мир.

═══════════════════════════════════════════════════════════════
КРИТИЧЕСКИЕ ПРАВИЛА (НАРУШЕНИЕ = ПЕРЕПИСАНИЕ)
═══════════════════════════════════════════════════════════════

1. 🚫 НИКОГДА НЕ ИСПОЛЬЗУЙ МЕТАЯЗЫК:
   ❌ ЗАПРЕЩЕНО: "NPC", "проверка", "успех", "итого", "бросок", "кубик", "HP", "XP"
   ❌ ЗАПРЕЩЕНО: упоминание механик игры в нарративе
   ❌ ЗАПРЕЩЕНО: квадратные скобки [как эти]
   ✅ ВМЕСТО: Используй имена персонажей, описывай действия

2. 🌍 ПРОСТРАНСТВЕННАЯ ЛОГИКА (КРИТИЧНО):
   ✅ Локация ДОЛЖНА соответствовать Context → Location
   ✅ Если локация меняется, ОБЯЗАТЕЛЬНО объясни логический переход
   ✅ Помни о предыдущих событиях в этой локации
   ✅ Не телепортируй персонажей без объяснения
   ✅ Описывай расстояния и направления (близко, далеко, слева, справа)
   ❌ ЗАПРЕЩЕНО: менять локацию без объяснения

3. 🎯 РАЗДЕЛЕНИЕ ОТВЕТСТВЕННОСТИ:
   ✅ Нарратив описывает результаты действия игрока
   ✅ Нарратив описывает реакцию мира на действие
   ❌ ЗАПРЕЩЕНО: описывать сами действия игрока
   ❌ ЗАПРЕЩЕНО: описывать мысли персонажа
   ❌ ЗАПРЕЩЕНО: решать за игрока, что он делает

4. 📋 ВЫБОРЫ (CHOICES):
   ✅ ВСЕГДА предложи ровно 3 конкретных действия
   ✅ Каждый выбор должен быть ясным и выполнимым
   ✅ Выборы должны соответствовать текущей ситуации
   ✅ Примеры: "Спросить о кольце", "Осмотреть ящик", "Атаковать стражника"
   ❌ ЗАПРЕЩЕНО: менее 3 выборов

5. 🌍 МАТЕРИАЛЫ И АНАХРОНИЗМЫ:
   ✅ Используй ТОЛЬКО средневековые/фэнтези материалы:
      - ✅ камень, дерево, металл, кожа, ткань, глина
      - ✅ факелы, свечи, масляные лампы
      - ✅ мечи, луки, щиты, доспехи
   ❌ ЗАПРЕЩЕНО: бетон, пластик, асфальт, тротуар, решетка, электричество, стекло

6. 👥 ПЕРСОНАЖИ И ДИАЛОГИ:
   ✅ Персонажи должны иметь имена и характеры
   ✅ Диалоги должны быть полными и естественными
   ✅ Используй кавычки: "Слова персонажа"
   ✅ Персонажи реагируют на действия игрока логично
   ✅ Персонажи помнят предыдущие события
   ❌ ЗАПРЕЩЕНО: неполные диалоги, заканчивающиеся на многоточие

7. 🎭 СТРУКТУРА НАРРАТИВА:
   ✅ 3-4 предложения описания сцены
   ✅ Реакция персонажей на действие игрока
   ✅ Полный диалог (если применимо)
   ✅ Сенсорные детали (звуки, запахи, ощущения)
   ❌ ЗАПРЕЩЕНО: абстрактные метафоры ("тени судьбы")

═══════════════════════════════════════════════════════════════
СТРУКТУРА ОТВЕТА
═══════════════════════════════════════════════════════════════

Выведи ТОЛЬКО валидный JSON, без объяснений:

{
  "scene": {
    "location": "Текущая локация (ДОЛЖНА совпадать с Context)",
    "time": "Конкретное время"
  },
  "narration": "3-4 предложения описания + реакция + диалог",
  "choices": ["Действие 1", "Действие 2", "Действие 3"]
}

ПРАВИЛА ПОЛЕЙ:
- "scene.location": ДОЛЖНА совпадать с Context → Location (НИКОГДА не меняй без объяснения)
- "scene.time": Конкретное время (не "Неопределено")
- "narration": Только нарратив, БЕЗ локации и времени, БЕЗ описания действий игрока
- "choices": РОВНО 3 конкретных действия, соответствующих ситуации`

  // IMPROVED v2: Comprehensive system prompt for English
  const systemPromptEN = `You are a Dungeon Master in a dark fantasy world. Your role is to create immersive, atmospheric narrative that fully immerses the player in the world.

═══════════════════════════════════════════════════════════════
CRITICAL RULES (VIOLATION = REWRITE)
═══════════════════════════════════════════════════════════════

1. 🚫 NEVER USE META-LANGUAGE:
   ❌ FORBIDDEN: "NPC", "check", "success", "total", "roll", "dice", "HP", "XP"
   ❌ FORBIDDEN: mentioning game mechanics in narrative
   ❌ FORBIDDEN: square brackets [like these]
   ✅ INSTEAD: Use character names, describe actions

2. 🌍 SPATIAL LOGIC (CRITICAL):
   ✅ Location MUST match Context → Location
   ✅ If location changes, EXPLAIN the logical transition
   ✅ Remember previous events in this location
   ✅ Don't teleport characters without explanation
   ✅ Describe distances and directions (close, far, left, right)
   ❌ FORBIDDEN: change location without explanation

3. 🎯 SEPARATION OF RESPONSIBILITY:
   ✅ Narrative describes results of player action
   ✅ Narrative describes world reaction to action
   ❌ FORBIDDEN: describe player's own actions
   ❌ FORBIDDEN: describe character's thoughts
   ❌ FORBIDDEN: decide for player what they do

4. 📋 CHOICES:
   ✅ ALWAYS offer exactly 3 specific actions
   ✅ Each choice must be clear and executable
   ✅ Choices must match the current situation
   ✅ Examples: "Ask about the ring", "Examine the box", "Attack the guard"
   ❌ FORBIDDEN: fewer than 3 choices

5. 🌍 MATERIALS AND ANACHRONISMS:
   ✅ Use ONLY medieval/fantasy materials:
      - ✅ stone, wood, metal, leather, cloth, clay
      - ✅ torches, candles, oil lamps
      - ✅ swords, bows, shields, armor
   ❌ FORBIDDEN: concrete, plastic, asphalt, sidewalk, grating, electricity, glass

6. 👥 CHARACTERS AND DIALOGUE:
   ✅ Characters must have names and personalities
   ✅ Dialogue must be complete and natural
   ✅ Use quotation marks: "Character's words"
   ✅ Characters react to player actions logically
   ✅ Characters remember previous events
   ❌ FORBIDDEN: incomplete dialogues ending with ellipsis

7. 🎭 NARRATIVE STRUCTURE:
   ✅ 3-4 sentences of scene description
   ✅ Character reaction to player action
   ✅ Complete dialogue (if applicable)
   ✅ Sensory details (sounds, smells, sensations)
   ❌ FORBIDDEN: abstract metaphors ("shadows of fate")

═══════════════════════════════════════════════════════════════
RESPONSE STRUCTURE
═══════════════════════════════════════════════════════════════

Output ONLY valid JSON, no explanations:

{
  "scene": {
    "location": "Current location (MUST match Context)",
    "time": "Specific time"
  },
  "narration": "3-4 sentences of description + reaction + dialogue",
  "choices": ["Action 1", "Action 2", "Action 3"]
}

FIELD RULES:
- "scene.location": MUST match Context → Location (NEVER change without explanation)
- "scene.time": Specific time (not "Unspecified")
- "narration": Only narrative, NO location and time, NO description of player's actions
- "choices": EXACTLY 3 specific actions matching the situation`

  const systemPrompt = language === 'ru' ? systemPromptRU : systemPromptEN

  const russianGrammarRules =
    language === 'ru'
      ? `
Правила русского языка (обязательно):
- Используй правильное склонение существительных, имён и прилагательных
- Согласуй подлежащее и сказуемое
- Избегай неоднозначных местоимений; повторяй роль/имя
- Сохраняй консистентность времени в каждом абзаце
- Используй естественный русский синтаксис`
      : ''

  return `${systemPrompt}

${russianGrammarRules}

OUTPUT FORMAT (CRITICAL):
- Return ONLY valid JSON.
- Do not write any explanations.
- Do not write any text before the JSON.
- Do not write any text after the JSON.
- Do not wrap JSON in markdown or code fences.
- The response must begin with "{" and end with "}".

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

/**
 * IMPROVED v2: Parse with integrated validation
 */
export function parseNarrativeResponse(
  response: string,
  language: PreferredLanguage = 'en'
): NarrativeResult | null {
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

    // IMPROVED v2: Validate narrative quality
    if (candidate.narration) {
      const validation = narrativeValidator.validate(candidate.narration, language)
      if (!validation.isValid) {
        console.warn(
          `[NarrativeValidator] ${narrativeValidator.getSummary(validation, language)}`,
          validation.issues
        )
        // If critical issues, return null to trigger retry
        if (validation.hasCriticalIssues) {
          return null
        }
      }
    }

    return isValidNarrative(candidate) ? candidate : null
  } catch (error) {
    console.error('[parseNarrativeResponse] JSON parsing error:', error)
    return null
  }
}

/**
 * IMPROVED v2: Narrative engine with better retry logic
 */
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
      systemPrompt: language === 'ru'
        ? 'Ты — Мастер Подземелий. Создавай только нарратив. Никогда не используй метаязык. Используй только средневековые материалы. Персонажи должны иметь имена и характеры. Локация ДОЛЖНА совпадать с контекстом.'
        : 'You are a Dungeon Master. Create only narrative. Never use meta-language. Use only medieval materials. Characters must have names and personalities. Location MUST match context.',
      userPrompt:
        extraInstruction
          ? `${prompt}\n\n${language === 'ru' ? 'Выведи только JSON на русском (Кириллица).' : 'Output only JSON in English.'}\n\n${extraInstruction}`
          : `${prompt}\n\n${language === 'ru' ? 'Выведи только JSON на русском (Кириллица).' : 'Output only JSON in English.'}`,
      temperature: 0.3,
      maxTokens: 900,
      taskType: 'DM_NARRATION'
    })

  // First attempt
  const firstRaw = await callModel()
  const firstParsed = parseNarrativeResponse(firstRaw, language)
  if (firstParsed) {
    syncNpcRegistryFromNarration(firstParsed)
    return firstParsed
  }

  // IMPROVED v2: Retry with specific instructions including spatial logic
  const retryInstruction = language === 'ru'
    ? 'Переписать. КРИТИЧНО: 1) Локация ДОЛЖНА совпадать с контекстом; 2) Нет метаязыка; 3) Только средневековые материалы; 4) Ровно 3 выбора; 5) Не описывай действия игрока; 6) Валидный JSON.'
    : 'Retry. CRITICAL: 1) Location MUST match context; 2) No meta-language; 3) Only medieval materials; 4) Exactly 3 choices; 5) Don\'t describe player\'s actions; 6) Valid JSON.'

  const retryRaw = await callModel(retryInstruction)
  const retryParsed = parseNarrativeResponse(retryRaw, language)
  if (retryParsed) {
    syncNpcRegistryFromNarration(retryParsed)
    return retryParsed
  }

  // IMPROVED v2: Better fallback narrative with explicit choices
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
      ? `Воздух в помещении становится тяжелее. Обстановка меняется, и последствия уже начинают проявляться. Все внимание сосредоточено на твоём действии.`
      : `Pressure rises in the room. The situation changes, and consequences begin to unfold. All attention is focused on your action.`,
    choices: language === 'ru'
      ? ['Осмотреть обстановку', 'Заговорить с персонажем', 'Продвинуться вперёд']
      : ['Survey the area', 'Speak to the character', 'Push forward']
  }
  syncNpcRegistryFromNarration(fallback)
  return fallback
}

const DM_SYSTEM = {
  en: 'You are a Dungeon Master. Create only narrative. Never use meta-language. Use only medieval materials. Characters must have names and personalities. Location MUST match context.',
  ru: 'Ты — Мастер Подземелий. Создавай только нарратив. Никогда не используй метаязык. Используй только средневековые материалы. Персонажи должны иметь имена и характеры. Локация ДОЛЖНА совпадать с контекстом.'
}

/**
 * Streaming variant of runNarrativeEngine.
 * Calls the primary model with stream=true, detects the "narration" JSON field,
 * and emits those tokens via onChunk as they arrive.
 * Returns the full NarrativeResult (parsed at stream-end).
 * Falls back to the non-streaming engine on parse failure.
 */
export async function streamNarrativeEngine(
  context: NarrativeContext,
  language: PreferredLanguage = 'en',
  onChunk: (text: string) => void
): Promise<NarrativeResult> {
  const prompt = buildNarrativePrompt(context, language)
  const userPrompt = `${prompt}\n\n${
    language === 'ru' ? 'Выведи только JSON на русском (Кириллица).' : 'Output only JSON in English.'
  }`

  // State machine: detect "narration":"..." field in the streaming JSON
  let inNarration = false
  let narrationDone = false
  let escaped = false
  let lookAhead = '' // accumulates chars while scanning for the marker

  const MARKERS = ['"narration":"', '"narration": "']

  let fullText = ''
  try {
    fullText = await streamNarrationTokens(
      DM_SYSTEM[language],
      userPrompt,
      (delta) => {
        if (narrationDone) return

        if (!inNarration) {
          lookAhead += delta
          let markerIdx = -1
          let markerLen = 0
          for (const m of MARKERS) {
            const idx = lookAhead.indexOf(m)
            if (idx !== -1) { markerIdx = idx; markerLen = m.length; break }
          }
          if (markerIdx !== -1) {
            inNarration = true
            // everything after the marker opening quote is narration content
            delta = lookAhead.slice(markerIdx + markerLen)
            lookAhead = ''
          } else {
            // keep last 50 chars for overlap detection across chunk boundaries
            if (lookAhead.length > 100) lookAhead = lookAhead.slice(-50)
            return
          }
        }

        // We are inside the narration string — process chars, handle escapes, stop at closing "
        let emit = ''
        for (let i = 0; i < delta.length; i++) {
          const ch = delta[i]
          if (escaped) {
            if (ch === 'n') emit += '\n'
            else if (ch === 't') emit += '\t'
            else if (ch === '"') emit += '"'
            else if (ch === '\\') emit += '\\'
            else emit += ch
            escaped = false
          } else if (ch === '\\') {
            escaped = true
          } else if (ch === '"') {
            // closing quote of narration JSON string
            inNarration = false
            narrationDone = true
            break
          } else {
            emit += ch
          }
        }
        if (emit) onChunk(emit)
      }
    )
  } catch (err) {
    console.warn('[streamNarrativeEngine] streaming failed, falling back:', err)
    return runNarrativeEngine(context, language)
  }

  const parsed = parseNarrativeResponse(fullText, language)
  if (parsed) {
    const syncNpc = (result: NarrativeResult) => {
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
    syncNpc(parsed)
    return parsed
  }

  // Fallback metadata if JSON parse failed (narration was already streamed)
  return {
    scene: {
      location: safeString(context.sceneState?.location || context.location, language === 'ru' ? 'Неизвестная локация' : 'Unknown location'),
      time: safeString(context.sceneState?.timeOfDay, language === 'ru' ? 'Сейчас' : 'Present')
    },
    narration: language === 'ru'
      ? 'Воздух становится тяжелее. Обстановка меняется.'
      : 'The air grows heavy. Things are shifting.',
    choices: language === 'ru'
      ? ['Осмотреть обстановку', 'Заговорить с кем-то', 'Продвинуться вперёд']
      : ['Survey the area', 'Speak to someone', 'Push forward']
  }
}
