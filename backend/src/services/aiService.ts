import OpenAI from 'openai'
import type { ChatCompletionMessage, ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import dotenv from 'dotenv'
import {
  listNPCProfiles,
  getNPCProfile,
  getNPCProfileById,
  registerNPCProfile,
  localizeNpcName,
  slugify,
  listNPCDialoguePalette,
  type NPCProfile
} from './npcRegistry.js'
import type { BackstoryProfile, BackstoryArcPlan, BackstoryBeat } from './backstoryArcStore.js'
import type { CombatEvent, CombatState } from './combatService.js'

dotenv.config({ override: true })

const groqBaseUrl = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
const primaryApiKey = process.env.GROQ_API_KEY_PRIMARY || process.env.GROQ_API_KEY
const utilityApiKey = process.env.GROQ_API_KEY_UTILITY

if (!primaryApiKey) {
  console.warn('WARNING: GROQ_API_KEY_PRIMARY is not set in environment variables')
  console.warn('Make sure backend/.env includes GROQ_API_KEY_PRIMARY=your_key_here')
}
if (!utilityApiKey) {
  console.warn('WARNING: GROQ_API_KEY_UTILITY is not set in environment variables')
  console.warn('Utility tasks will fall back to primary key if available')
}

const configuredModel = process.env.GROQ_MODEL || 'qwen/qwen3-32b'
const utilityModel =
  process.env.GROQ_UTILITY_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'

console.log(`Using primary model: ${configuredModel}`)
console.log(`Using utility model: ${utilityModel}`)
console.log('Set GROQ_MODEL or GROQ_UTILITY_MODEL in backend/.env to change the defaults')

let primaryClient: OpenAI | null = null
let utilityClient: OpenAI | null = null

try {
  if (!primaryApiKey) {
    throw new Error('GROQ_API_KEY_PRIMARY is required')
  }

  primaryClient = new OpenAI({
    apiKey: primaryApiKey,
    baseURL: groqBaseUrl
  })

  if (utilityApiKey) {
    utilityClient = new OpenAI({
      apiKey: utilityApiKey,
      baseURL: groqBaseUrl
    })
  }

  console.log('Groq clients initialized successfully')
} catch (error) {
  console.error('Failed to initialize Groq client:', error)
  throw error
}

export interface AIPromptOptions {
  systemPrompt?: string
  userPrompt?: string
  temperature?: number
  maxTokens?: number
  history?: ChatCompletionMessageParam[]
  responseFormat?: { type: 'json_object' }
  taskType?: TaskType
}

export interface SceneState {
  location?: string
  roster?: string[]
  lastTransition?: string | null
}

export interface GeneratedQuest {
  id: string
  title: string
  summary: string
  xp: number
  hook: string
  objectives: string[]
  recommendedLevel: number
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

export interface StatusDot {
  timing: 'startOfTurn' | 'endOfTurn'
  amount: string
}

export interface StatusUpdatePayload {
  apply: StatusEffect[]
  update: StatusEffect[]
  remove: Array<{ id: string }>
}

export interface StatusStateInput {
  active_statuses: StatusEffect[]
}

export interface CheckRequest {
  id?: string
  type?: string
  actor?: string
  stat?: string
  difficulty?: string
  context?: string
  on_success?: string
  on_failure?: string
}

export type TaskType =
  | 'DM_NARRATION'
  | 'COMBAT_NARRATION'
  | 'SUMMARIZE'
  | 'STATUS_JSON'
  | 'NPC_JSON'
  | 'REPAIR_JSON'
  | 'CLASSIFY_INTENT'
  | 'INTENT_ROUTER'
  | 'APPEARANCE_JSON'
  | 'CLASS_TAGS_JSON'
  | 'CUSTOM_CLASS'
  | 'QUEST_JSON'
  | 'BACKSTORY_ARC_JSON'
  | 'QUEST_NPC_JSON'

export type PreferredLanguage = 'en' | 'ru'

const normalizeLanguage = (language?: string): PreferredLanguage =>
  language === 'ru' ? 'ru' : 'en'

const languageDirective = (language?: string): string => {
  const resolved = normalizeLanguage(language)
  if (resolved === 'ru') {
    return 'LANGUAGE RULE: Write all user-facing content in Russian. Keep JSON keys/schema in English when required.'
  }
  return 'LANGUAGE RULE: Write all user-facing content in English.'
}

const isMostlyCyrillic = (text: string): boolean => {
  const letters = (text.match(/[A-Za-zА-Яа-яЁё]/g) || []).length
  if (!letters) return false
  const cyr = (text.match(/[А-Яа-яЁё]/g) || []).length
  return cyr / letters >= 0.6
}

interface CallAIOptions {
  temperature?: number
  maxTokens?: number
  responseFormat?: { type: 'json_object' }
}

const TASK_DEFAULTS: Record<
  TaskType,
  { client: 'primary' | 'utility'; maxTokens: number; maxCap?: number; minCap?: number }
> = {
  DM_NARRATION: { client: 'primary', maxTokens: 1400, minCap: 1200, maxCap: 1600 },
  COMBAT_NARRATION: { client: 'primary', maxTokens: 1200, minCap: 900, maxCap: 1400 },
  SUMMARIZE: { client: 'utility', maxTokens: 250, minCap: 200, maxCap: 350 },
  STATUS_JSON: { client: 'utility', maxTokens: 200, minCap: 120, maxCap: 250 },
  NPC_JSON: { client: 'utility', maxTokens: 200, minCap: 120, maxCap: 250 },
  REPAIR_JSON: { client: 'utility', maxTokens: 200, minCap: 150, maxCap: 300 },
  CLASSIFY_INTENT: { client: 'utility', maxTokens: 200, minCap: 120, maxCap: 250 },
  INTENT_ROUTER: { client: 'utility', maxTokens: 350, minCap: 200, maxCap: 450 },
  APPEARANCE_JSON: { client: 'utility', maxTokens: 300, minCap: 200, maxCap: 400 },
  CLASS_TAGS_JSON: { client: 'utility', maxTokens: 200, minCap: 120, maxCap: 250 },
  CUSTOM_CLASS: { client: 'utility', maxTokens: 1200 },
  QUEST_JSON: { client: 'utility', maxTokens: 800 },
  BACKSTORY_ARC_JSON: { client: 'utility', maxTokens: 900, minCap: 600, maxCap: 1100 },
  QUEST_NPC_JSON: { client: 'utility', maxTokens: 600 }
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

export async function callAI(
  taskType: TaskType,
  messages: ChatCompletionMessageParam[],
  options: CallAIOptions = {}
): Promise<string> {
  if (!messages.length) {
    throw new Error('No messages provided to callAI')
  }

  const taskDefaults = TASK_DEFAULTS[taskType]
  const wantsUtility = taskDefaults.client === 'utility'
  const activeClient =
    wantsUtility && utilityClient ? utilityClient : primaryClient

  if (!activeClient) {
    throw new Error('Groq client is not configured')
  }

  if (wantsUtility && !utilityClient) {
    console.warn('Utility client not configured; falling back to primary client.')
  }

  const model = wantsUtility && utilityClient ? utilityModel : configuredModel
  const requestedMax = options.maxTokens ?? taskDefaults.maxTokens
  const minCap = taskDefaults.minCap
  const maxCap = taskDefaults.maxCap
  let resolvedMaxTokens = requestedMax
  if (typeof minCap === 'number') {
    resolvedMaxTokens = Math.max(minCap, resolvedMaxTokens)
  }
  if (typeof maxCap === 'number') {
    resolvedMaxTokens = Math.min(maxCap, resolvedMaxTokens)
  }

  // qwen3 and llama-4 on Groq use thinking mode by default and require temperature=1
  // Passing response_format: json_object to thinking models causes a 400 validation error
  const isThinkingModel = /qwen.?3|llama-4/i.test(model)
  const effectiveTemperature = isThinkingModel ? 1 : (options.temperature ?? 0.7)

  try {
    console.log(`Calling AI task ${taskType} with model ${model}`)

    const completion = await runWithRetries(
      () =>
        activeClient.chat.completions.create({
          messages,
          model,
          temperature: effectiveTemperature,
          max_tokens: resolvedMaxTokens,
          ...(options.responseFormat && !isThinkingModel ? { response_format: options.responseFormat } : {})
        }),
      { label: `chat.completions.create:${taskType}` }
    )

    const response = stripThinkingBlocks(extractMessageContent(completion.choices[0]?.message))
    if (!response || !response.trim()) {
      if (taskType === 'DM_NARRATION' || taskType === 'COMBAT_NARRATION') {
        const contextText = messages
          .map(message => (typeof message.content === 'string' ? message.content : ''))
          .join(' ')
        console.warn('AI response was empty; using fallback narrative line.')
        return pickFallbackNarration(contextText, contextText)
      }
      return ''
    }

    return response
  } catch (error: any) {
    if (error?.status === 429) {
      if (taskType === 'DM_NARRATION' || taskType === 'COMBAT_NARRATION') {
        const contextText = messages
          .map(message => (typeof message.content === 'string' ? message.content : ''))
          .join(' ')
        console.warn('Rate limited on DM narration; using fallback narrative line.')
        return pickFallbackNarration(contextText, contextText)
      }
      console.warn(`Rate limited on utility task ${taskType}; returning no-op.`)
      return ''
    }
    // Groq returns 400 "Failed to validate JSON" when a thinking model outputs <think> blocks
    // with response_format: json_object. Retry without it and extract JSON manually.
    if (error?.status === 400) {
      console.warn(`400 error on task ${taskType} (model: ${model}):`, JSON.stringify(error?.error ?? error?.message ?? String(error)))
      if (options.responseFormat) {
        console.warn(`Retrying ${taskType} without response_format`)
        const retryCompletion = await activeClient!.chat.completions.create({
          messages,
          model,
          temperature: effectiveTemperature,
          max_tokens: resolvedMaxTokens,
        })
        return stripThinkingBlocks(extractMessageContent(retryCompletion.choices[0]?.message))
      }
    }
    throw error
  }
}

export async function generateAIResponse(options: AIPromptOptions): Promise<string> {
  try {
    const messages: ChatCompletionMessageParam[] = []

    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt
      })
    }

    if (options.history?.length) {
      messages.push(...options.history)
    }

    if (options.userPrompt) {
      messages.push({
        role: 'user',
        content: options.userPrompt
      })
    }

    if (!messages.length) {
      throw new Error('No messages provided to generateAIResponse')
    }

    console.log(`System prompt length: ${(options.systemPrompt || '').length}`)
    console.log(`History count: ${options.history?.length || 0}`)
    console.log(`User prompt length: ${(options.userPrompt || '').length}`)

    return await callAI(options.taskType ?? 'DM_NARRATION', messages, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      responseFormat: options.responseFormat
    })
  } catch (error: any) {
    console.error('AI Service Error Details:')
    console.error('Error message:', error?.message)
    console.error('Error code:', error?.code)
    console.error('Error status:', error?.status)
    console.error('Full error:', error)

    if (error?.message?.toLowerCase().includes('api key')) {
      throw new Error('Invalid or missing Groq API key')
    }
    if (error?.status === 401) {
      throw new Error('Unauthorized - Check your Groq API key')
    }
    if (error?.status === 403) {
      throw new Error('Forbidden - Your API key lacks access to this model or endpoint')
    }
    if (error?.status === 429) {
      throw new Error('Rate limit exceeded - Please try again later')
    }

    throw new Error(`Failed to generate AI response: ${error?.message || 'Unknown error'}`)
  }
}

export async function generateCustomClass(description: string, language: PreferredLanguage = 'en'): Promise<{
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
  startingWeapon: {
    name: string
    type: string
    damage: string
    description: string
    tags: string[]
  }
  startingArmor: {
    name: string
    armorClass: number
    description: string
    tags: string[]
  }
}> {
  const normalizeClassDescription = (
    rawDescription: string | undefined,
    className: string | undefined,
    seedDescription: string,
    lang: PreferredLanguage
  ): string => {
    const cleaned = String(rawDescription || '')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    const paragraphCount = cleaned
      ? cleaned.split(/\n{2,}/).map(part => part.trim()).filter(Boolean).length
      : 0
    const sentenceCount = (cleaned.match(/[.!?]/g) || []).length
    const cyrCount = (cleaned.match(/[\u0400-\u04FF]/g) || []).length
    const latinCount = (cleaned.match(/[A-Za-z]/g) || []).length
    const looksRussian = lang !== 'ru' || cyrCount >= Math.max(30, latinCount)
    const hasQuality =
      cleaned.length >= (lang === 'ru' ? 520 : 420) &&
      paragraphCount >= 3 &&
      sentenceCount >= 6 &&
      looksRussian

    if (hasQuality) {
      return cleaned
    }

    const safeName = (className || (lang === 'ru' ? 'Пользовательский класс' : 'Custom Class')).trim()
    const safeSeed = seedDescription.trim() || (lang === 'ru' ? 'уникальная концепция героя' : 'a unique adventurer concept')

    if (lang === 'ru') {
      return `${safeName} — это путь героя, который строится вокруг идеи: ${safeSeed}. Представители этого класса обычно приходят из суровой практики, а не из академических трактатов. Их мировоззрение формируется через конкретные испытания, из-за чего они быстро оценивают угрозу, держат фокус на цели и действуют без лишней театральности.\n\nВ бою ${safeName} сочетает дисциплину и адаптацию. Класс уверенно работает на средней дистанции, умеет входить в ближний контакт в нужный момент и поддерживает стабильный темп схватки за счёт выверенных базовых приёмов. Его сильная сторона — последовательность: сначала контроль позиции, затем давление, затем добивание через точное применение ключевых умений.\n\nВ группе ${safeName} закрывает роль надёжного универсала. Такой персонаж полезен в затяжных сценах, не теряется при смене темпа и помогает команде удерживать инициативу. Идеальный стиль игры для этого класса — принимать тактические решения по ситуации, сохранять ресурс до решающего эпизода и раскрывать потенциал через командное взаимодействие.`
    }

    return `${safeName} is a class path built around this concept: ${safeSeed}. Its practitioners are shaped by practical trials rather than abstract doctrine, so they prioritize situational awareness, disciplined execution, and clear tactical goals. The class identity is grounded, direct, and action-focused.\n\nIn combat, ${safeName} combines control and pressure. It performs best when it can manage distance, choose timing for engagement, and maintain momentum through reliable core techniques. The class rewards deliberate sequencing: establish position, apply pressure, then convert advantage with decisive abilities.\n\nInside a party, ${safeName} functions as a dependable flexible specialist. It stays useful in long encounters, supports team tempo, and scales well with coordinated play. The ideal gameplay loop is to read the battlefield, spend resources at high-impact moments, and keep the group stable while pursuing mission objectives.`
  }

  const normalizeClassFeatures = (
    rawFeatures: unknown,
    lang: PreferredLanguage
  ): string[] => {
    const features = Array.isArray(rawFeatures)
      ? rawFeatures.map(item => String(item || '').trim()).filter(Boolean)
      : []
    const normalized = features.map(feature =>
      feature.endsWith('.') || feature.endsWith('!') || feature.endsWith('?')
        ? feature
        : `${feature}.`
    )

    if (normalized.length >= 3) {
      return normalized
    }

    if (lang === 'ru') {
      return [
        'Боевой ритм: класс получает бонус к устойчивости в первом раунде столкновения.',
        'Тактический шаг: раз за сцену можно занять более выгодную позицию без потери темпа.',
        'Контролируемый натиск: успешные действия усиливают следующее целевое умение.',
        'Полевой опыт: класс лучше справляется с проверками, связанными с угрозами и преследованием.'
      ]
    }

    return [
      'Battle Rhythm: gain early-round stability in dangerous engagements.',
      'Tactical Step: reposition once per scene without losing tempo.',
      'Controlled Pressure: successful actions improve the next focused ability.',
      'Field Experience: stronger checks in threat assessment and pursuit scenarios.'
    ]
  }

  const systemPrompt = `You are an expert D&D 5e game designer. Generate a balanced custom class based on the user's description.
Return ONLY a valid JSON object with this exact structure:
{
  "className": "string",
  "stats": {
    "strength": number (8-15),
    "dexterity": number (8-15),
    "constitution": number (8-15),
    "intelligence": number (8-15),
    "wisdom": number (8-15),
    "charisma": number (8-15)
  },
  "hitDie": "d6" | "d8" | "d10" | "d12",
  "proficiencies": ["array", "of", "strings"],
  "features": ["array", "of", "feature", "descriptions"],
  "description": "At least 3 paragraphs describing the class's origin, philosophy, combat style, and ideal party role. Use \\n\\n for paragraph breaks.",
  "startingWeapon": {
    "name": "string",
    "type": "melee" | "ranged" | "magic",
    "damage": "string (for example: 1d8 slashing)",
    "description": "string",
    "tags": ["equipment", "weapon"]
  },
  "startingArmor": {
    "name": "string",
    "armorClass": number (10-22),
    "description": "string",
    "tags": ["equipment", "armor"]
  }
}
Make sure the stats total between 72-78 (standard point buy range). The class should be balanced and follow D&D 5e design principles.
Always include both startingWeapon and startingArmor.
If language is Russian:
- Write fluent, grammatically correct Russian.
- Avoid sentence fragments and broken clauses.
- Description must be detailed and semantically coherent in 3 full paragraphs.
- Each paragraph should contain at least 2 complete sentences.
${languageDirective(language)}`

  const userPrompt = `Create a D&D 5e custom class based on this description: ${description}
Return only JSON. Do not wrap the response in markdown or add any commentary.`

  try {
    let response = ''
    try {
      response = await generateAIResponse({
        systemPrompt,
        userPrompt,
        temperature: 0.7,
        maxTokens: 1500,
        responseFormat: { type: 'json_object' },
        taskType: 'CUSTOM_CLASS'
      })
    } catch (error: any) {
      const message = String(error?.message || '')
      if (/response_format|json_object|unsupported/i.test(message)) {
        response = await generateAIResponse({
          systemPrompt,
          userPrompt,
          temperature: 0.7,
          maxTokens: 1500,
          taskType: 'CUSTOM_CLASS'
        })
      } else {
        throw error
      }
    }

    let jsonString = response.trim()
    if (jsonString.includes('```json')) {
      jsonString = jsonString.split('```json')[1].split('```')[0].trim()
    } else if (jsonString.includes('```')) {
      jsonString = jsonString.split('```')[1].split('```')[0].trim()
    }
    const extractedJson = extractJsonObject(jsonString)
    if (extractedJson) {
      jsonString = extractedJson
    }

    const classData = JSON.parse(sanitizeJsonForParse(jsonString))

    const stats = (classData.stats || {}) as Record<string, number>
    const statTotal = Object.values(stats).reduce((sum, val) => sum + Number(val || 0), 0)

    if (statTotal < 72 || statTotal > 78) {
      const targetTotal = 75
      const scale = targetTotal / statTotal
      Object.keys(stats).forEach(key => {
        stats[key] = Math.round(stats[key] * scale)
        if (stats[key] < 8) stats[key] = 8
        if (stats[key] > 15) stats[key] = 15
      })
    }

    return {
      className: classData.className || 'Custom Class',
      stats: {
        strength: Math.max(8, Math.min(15, stats.strength || 10)),
        dexterity: Math.max(8, Math.min(15, stats.dexterity || 10)),
        constitution: Math.max(8, Math.min(15, stats.constitution || 10)),
        intelligence: Math.max(8, Math.min(15, stats.intelligence || 10)),
        wisdom: Math.max(8, Math.min(15, stats.wisdom || 10)),
        charisma: Math.max(8, Math.min(15, stats.charisma || 10))
      },
      hitDie: classData.hitDie || 'd8',
      proficiencies: Array.isArray(classData.proficiencies) ? classData.proficiencies : [],
      features: normalizeClassFeatures(classData.features, language),
      description: normalizeClassDescription(
        classData.description,
        classData.className,
        description,
        language
      ),
      startingWeapon: {
        name: classData.startingWeapon?.name || 'Adventurer Blade',
        type: classData.startingWeapon?.type || 'melee',
        damage: classData.startingWeapon?.damage || '1d8 slashing',
        description:
          classData.startingWeapon?.description ||
          'A practical weapon chosen to match this class training.',
        tags: Array.isArray(classData.startingWeapon?.tags)
          ? classData.startingWeapon.tags
          : ['equipment', 'weapon']
      },
      startingArmor: {
        name: classData.startingArmor?.name || 'Traveler Armor',
        armorClass: Math.max(10, Math.min(22, Number(classData.startingArmor?.armorClass) || 12)),
        description:
          classData.startingArmor?.description ||
          'Protective armor suited to this class combat style.',
        tags: Array.isArray(classData.startingArmor?.tags)
          ? classData.startingArmor.tags
          : ['equipment', 'armor']
      }
    }
  } catch (error) {
    console.error('Error generating custom class:', error)
    return {
      className: 'Custom Class',
      stats: {
        strength: 10,
        dexterity: 12,
        constitution: 13,
        intelligence: 14,
        wisdom: 11,
        charisma: 12
      },
      hitDie: 'd8',
      proficiencies: ['Simple weapons', 'Light armor'],
      features:
        language === 'ru'
          ? [
              'Базовая техника: класс получает надёжный приём, отражающий выбранную концепцию.',
              'Тактическая гибкость: класс может подстраивать стиль боя под обстановку.',
              'Профильное мастерство: класс стабильно усиливается по мере развития персонажа.'
            ]
          : ['Custom ability based on your description'],
      description:
        language === 'ru'
          ? `Этот класс создан на основе вашей идеи: ${description}. Его основа — понятный боевой стиль, логичная роль в группе и внятный путь развития без разрывов в механике и повествовании.

Представители класса действуют собранно: они выбирают момент для давления, контролируют дистанцию и используют сильные стороны без лишнего риска. Главный принцип — последовательность решений и устойчивость в затяжных сценах.

В команде такой персонаж полезен как универсальный исполнитель: он поддерживает темп, закрывает ключевые задачи и помогает группе удерживать инициативу в критические моменты.`
          : `${description}

Their tale is whispered through campfires and taverns alike, describing the ideals that shaped them and the oaths they swore. Paint a vivid origin story for this class when you play them.

Detail how this class approaches adventuring: the cadence of their combat rhythm, their relationship with magic or steel, and the sorts of quests that ignite their passion.`,
      startingWeapon: {
        name: 'Adventurer Blade',
        type: 'melee',
        damage: '1d8 slashing',
        description: 'A reliable blade carried by seasoned travelers.',
        tags: ['equipment', 'weapon']
      },
      startingArmor: {
        name: 'Traveler Armor',
        armorClass: 12,
        description: 'Layered leather and cloth armor fit for the road.',
        tags: ['equipment', 'armor']
      }
    }
  }
}

export async function generateStatusUpdate(
  history: ChatCompletionMessageParam[],
  statusState: StatusStateInput,
  language: PreferredLanguage = 'en'
): Promise<StatusUpdatePayload> {
  const transcript = history
    .filter(entry => entry && entry.role !== 'system' && typeof entry.content === 'string')
    .map(entry => `${entry.role === 'user' ? 'PLAYER' : 'DM'}: ${entry.content}`)
    .join('\n')

  const systemPrompt = `You are the character status engine for a D&D-style RPG.
Output JSON only, following the contract below.

CORE RULES
- Status effects are ONLY character-bound conditions/buffs/debuffs with mechanical impact.
- Never output social, scene, or NPC-attitude effects (no crowds, rooms, or reputation).
- Each status must include explicit mechanics, a trigger, a duration, and a cure.
- Maximum one new status effect per update.

CANONICAL STATUS LIST (ONLY THESE ARE ALLOWED)
- poisoned / "Poisoned"
- blinded / "Blinded"
- charmed / "Charmed"
- frightened / "Frightened"
- exhaustion (level 1-6) / "Exhaustion (Level X)"
- paralyzed / "Paralyzed"
- restrained / "Restrained"
- stunned / "Stunned"
- unconscious / "Unconscious"
- invisible / "Invisible"
- inspired / "Inspired"
- blessed / "Blessed"
- cursed / "Cursed"
- bleeding / "Bleeding"
- madness / "Madness"
- fear / "Fear"
- corruption (tiered) / "Corruption (Tier X)"

TRIGGER RULE
- Trigger must be a concrete event: spell hit, failed save, damage source, ritual, artifact, etc.
- Do not use vague triggers like "atmosphere" or "felt uneasy".

OUTPUT CONTRACT
{
  "apply": [
    {
      "id": "string",
      "name": "string",
      "type": "condition|buff|debuff",
      "mechanics": "string",
      "trigger": "string",
      "modifiers": {
        "attackRolls": "adv|dis|+XdY|text",
        "abilityChecks": "adv|dis|text",
        "savingThrows": "adv|dis|text",
        "skillChecks": "adv|dis|text",
        "damage": "+XdY|text",
        "movementSpeed": "0|0.5x|text",
        "perceptionSight": "auto-fail|text",
        "actionAvailability": "text"
      },
      "restrictions": {
        "canAct": true,
        "canMove": true,
        "canSpeak": true,
        "reactionsAllowed": true,
        "movementSpeedMultiplier": 1,
        "cannotApproachSource": false,
        "cannotTargetCharmer": false,
        "special": "text"
      },
      "narrationCues": ["string"],
      "duration": { "type": "rounds|minutes|scene|until_removed", "value": 1 },
      "cure": "string",
      "source": "string",
      "severity": 1,
      "appliedAt": 0
    }
  ],
  "update": [],
  "remove": [ { "id": "string" } ]
}

If no status change is required, return:
{ "apply": [], "update": [], "remove": [] }`

  const userPrompt = `Scene transcript:
${transcript}

Current status state:
${JSON.stringify(statusState)}

${languageDirective(language)}

Output JSON only.` 

  const summaryState = {
    active_statuses: (statusState.active_statuses || []).map(status => ({
      id: status.id,
      name: status.name,
      type: status.type,
      mechanics: status.mechanics,
      trigger: status.trigger,
      modifiers: status.modifiers,
      restrictions: status.restrictions,
      narrationCues: status.narrationCues,
      duration: status.duration,
      cure: status.cure,
      source: status.source,
      severity: status.severity,
      appliedAt: status.appliedAt
    }))
  }

  const safeUserPrompt = `Scene transcript:
${transcript}

Current status state:
${JSON.stringify(summaryState)}

Output JSON only.`

  let raw = ''
  try {
    raw = await generateAIResponse({
      systemPrompt,
      userPrompt: safeUserPrompt,
      temperature: 0.2,
      maxTokens: 500,
      taskType: 'STATUS_JSON'
    })
  } catch (error: any) {
    const message = String(error?.message || '')
    if (/response_format|json_object|unsupported|json_validate_failed/i.test(message)) {
      raw = await generateAIResponse({
        systemPrompt,
        userPrompt: safeUserPrompt,
        temperature: 0.2,
        maxTokens: 500,
        taskType: 'STATUS_JSON'
      })
    } else {
      throw error
    }
  }

  const jsonString = extractJsonObject(raw) || raw
  const parsedDirect = safeJsonParse(jsonString)
  if (parsedDirect) {
    return normalizeStatusUpdate(parsedDirect, statusState)
  }

  const repaired = repairJsonString(jsonString)
  const parsedRepaired = safeJsonParse(repaired)
  if (parsedRepaired) {
    return normalizeStatusUpdate(parsedRepaired, statusState)
  }

  const modelFixed = await repairJsonWithModel(raw)
  const parsedModelFixed = modelFixed ? safeJsonParse(modelFixed) : null
  if (parsedModelFixed) {
    return normalizeStatusUpdate(parsedModelFixed, statusState)
  }

  console.error('Failed to parse status update JSON after repair attempts.')
  return { apply: [], update: [], remove: [] }
}

export async function generateSceneSummary(
  history: ChatCompletionMessageParam[],
  language: PreferredLanguage = 'en'
): Promise<string> {
  const filteredHistory = history.filter(
    entry => entry && entry.role !== 'system' && typeof entry.content === 'string' && entry.content.trim()
  )

  const transcript = filteredHistory
    .map(entry => `${entry.role === 'user' ? 'PLAYER' : 'DM'}: ${entry.content}`)
    .join('\n')

  const systemPrompt = `Summarize the following scene for continued play.

Rules:
- Keep only concrete facts, discoveries, and unresolved hooks.
- Do NOT include prose, atmosphere, or stylistic language.
- Do NOT include dice, rolls, or system messages.
- Use 3-5 short bullet points.
- This summary will replace the full scene context.

${languageDirective(language)}

Output only the summary.`

  const userPrompt = `Scene transcript:
${transcript}

Output only the summary.`

  const response = await generateAIResponse({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 200,
    taskType: 'SUMMARIZE'
  })

  return normalizeSummary(response)
}

export async function generateBackstorySummary(
  backstory: string,
  language: PreferredLanguage = 'en'
): Promise<string> {
  const systemPrompt = `Summarize the character backstory into key moments for future DM use.

Rules:
- 3-5 bullet points.
- Focus on concrete events, motivations, unresolved hooks.
- No prose, no mechanics, no meta.
- Output only the bullet list.

${languageDirective(language)}`

  const userPrompt = `Backstory:
${backstory}

Output only the bullet list.`

  const response = await generateAIResponse({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 200,
    taskType: 'SUMMARIZE'
  })

  return normalizeSummary(response)
}

export async function generateBackstoryArcPlan(payload: {
  characterKey: string
  name?: string
  className?: string
  backstory: string
  currentTurn: number
}): Promise<{ profile: BackstoryProfile; plan: BackstoryArcPlan }> {
  const systemPrompt = `You are a backstory arc planner for a grounded dark-fantasy RPG.
Return STRICT JSON only. Do not add commentary.

Required schema:
{
  "profile": {
    "origin": "",
    "keyEvent": "",
    "unresolvedConflict": "",
    "antagonisticForce": "",
    "witnesses": [],
    "debts": [],
    "artifactsOrMarks": [],
    "emotionalCore": "",
    "secrecyRules": [],
    "hookTags": []
  },
  "plan": {
    "beats": [
      {
        "id": "",
        "type": "echo|trace|pressure|revelation|vector|choice|consequence",
        "goal": "",
        "deliveryModes": ["rumor"],
        "constraints": { "minTurnsGap": 4, "maxRevealLevel": "hint" },
        "triggerHints": {},
        "payload": { "keyNames": [], "symbols": [], "phrases": [], "objects": [], "summary": "" }
      }
    ],
    "currentBeatIndex": 0,
    "pressureLevel": 10,
    "revealedFacts": [],
    "status": "active"
  }
}

Rules:
- Provide 5 to 7 beats, escalating in order: echo -> trace -> pressure -> revelation -> vector -> choice -> consequence.
- Keep content grounded and concrete. No metaphysical vagueness.
- secrecyRules must prevent early spoilers.
- deliveryModes must be from: rumor, npc, letter, seal, wantedPoster, dream, artifactReaction, patrol, bounty, coincidence.`

  const userPrompt = `Character name: ${payload.name || 'Unknown'}
Class: ${payload.className || 'Unknown'}
Character key: ${payload.characterKey}
Backstory:
${payload.backstory}`

  const buildCall = async (extraInstruction?: string, forceJsonFormat?: boolean) => {
    const prompt = extraInstruction ? `${userPrompt}\n\n${extraInstruction}` : userPrompt
    return await generateAIResponse({
      systemPrompt,
      userPrompt: prompt,
      temperature: 0.4,
      maxTokens: 900,
      taskType: 'BACKSTORY_ARC_JSON',
      ...(forceJsonFormat ? { responseFormat: { type: 'json_object' } } : {})
    })
  }

  let raw = await buildCall(undefined, true)
  let extracted = extractJsonObject(raw) || raw
  let parsed = safeJsonParse(extracted) || safeJsonParse(repairJsonString(extracted))
  if (!parsed || !parsed.profile || !parsed.plan) {
    raw = await buildCall(
      'Return ONLY valid JSON for the schema. No markdown, no commentary, no code fences.',
      true
    )
    extracted = extractJsonObject(raw) || raw
    parsed = safeJsonParse(extracted) || safeJsonParse(repairJsonString(extracted))
  }
  if (!parsed || !parsed.profile || !parsed.plan) {
    const fallbackProfile: BackstoryProfile = {
      characterKey: payload.characterKey,
      origin: 'unknown',
      keyEvent: 'unknown',
      unresolvedConflict: 'unresolved',
      antagonisticForce: 'unknown',
      witnesses: [],
      debts: [],
      artifactsOrMarks: [],
      emotionalCore: 'survival',
      secrecyRules: ['Avoid explicit spoilers early.'],
      hookTags: []
    }
    const fallbackBeats: BackstoryBeat[] = [
      { id: `${payload.characterKey}-echo`, type: 'echo', goal: 'A faint rumor surfaces', deliveryModes: ['rumor'], constraints: { minTurnsGap: 4, maxRevealLevel: 'hint' }, triggerHints: {}, payload: { summary: 'a rumor about the past' }, used: false },
      { id: `${payload.characterKey}-trace`, type: 'trace', goal: 'A trace is spotted', deliveryModes: ['patrol'], constraints: { minTurnsGap: 5, maxRevealLevel: 'hint' }, triggerHints: {}, payload: { summary: 'a sign tied to the past' }, used: false },
      { id: `${payload.characterKey}-pressure`, type: 'pressure', goal: 'Pressure tightens', deliveryModes: ['npc'], constraints: { minTurnsGap: 6, maxRevealLevel: 'partial' }, triggerHints: {}, payload: { summary: 'a warning or demand' }, used: false },
      { id: `${payload.characterKey}-revelation`, type: 'revelation', goal: 'A guarded revelation', deliveryModes: ['letter'], constraints: { minTurnsGap: 7, maxRevealLevel: 'partial' }, triggerHints: {}, payload: { summary: 'a revealed link' }, used: false },
      { id: `${payload.characterKey}-vector`, type: 'vector', goal: 'A vector appears', deliveryModes: ['seal'], constraints: { minTurnsGap: 7, maxRevealLevel: 'partial' }, triggerHints: {}, payload: { summary: 'a lead to follow' }, used: false },
      { id: `${payload.characterKey}-choice`, type: 'choice', goal: 'A choice is forced', deliveryModes: ['bounty'], constraints: { minTurnsGap: 8, maxRevealLevel: 'explicit' }, triggerHints: {}, payload: { summary: 'a hard decision' }, used: false },
      { id: `${payload.characterKey}-consequence`, type: 'consequence', goal: 'A consequence lands', deliveryModes: ['coincidence'], constraints: { minTurnsGap: 9, maxRevealLevel: 'explicit' }, triggerHints: {}, payload: { summary: 'a consequence arrives' }, used: false }
    ]
    const fallbackPlan: BackstoryArcPlan = {
      characterKey: payload.characterKey,
      beats: fallbackBeats,
      currentBeatIndex: 0,
      pressureLevel: 10,
      nextEligibleAfter: payload.currentTurn + 4,
      revealedFacts: [],
      status: 'active'
    }
    return { profile: fallbackProfile, plan: fallbackPlan }
  }

  return {
    profile: parsed.profile as BackstoryProfile,
    plan: parsed.plan as BackstoryArcPlan
  }
}

const normalizeAppearanceSpec = (
  raw: Partial<CharacterAppearanceSpec>
): { spec: CharacterAppearanceSpec; warnings: string[] } => {
  const warnings: string[] = []
  const pick =
    <T extends string>(value: any, allowed: T[], fallback: T) => {
      if (typeof value === 'string' && allowed.includes(value as T)) {
        return value as T
      }
      return fallback
    }

  const sex = pick(raw.sex, ['male', 'female', 'unknown'], 'unknown')
  const genderPresentation = pick(
    raw.genderPresentation,
    ['masculine', 'feminine', 'androgynous', 'unknown'],
    'unknown'
  )
  const ageRange = pick(raw.ageRange, ['teen', '20s', '30s', '40s', '50+', 'unknown'], 'unknown')
  const hairLength = pick(raw.hairLength, ['short', 'medium', 'long', 'unknown'], 'unknown')
  const bodyType = pick(
    raw.bodyType,
    ['slim', 'average', 'athletic', 'muscular', 'unknown'],
    'unknown'
  )
  const confidence =
    typeof raw.confidence === 'number'
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0
  const normalizeList = (value: any) =>
    Array.isArray(value)
      ? value.map(item => String(item)).filter(Boolean).slice(0, 8)
      : []

  const notableFeatures = normalizeList(raw.notableFeatures)
  const clothingStyle = normalizeList(raw.clothingStyle)
  const palette = normalizeList(raw.palette)

  if (sex === 'unknown') {
    warnings.push('sex_unknown')
  }
  if (genderPresentation === 'unknown') {
    warnings.push('gender_presentation_unknown')
  }

  return {
    spec: {
      sex,
      genderPresentation,
      ageRange,
      hairLength,
      bodyType,
      notableFeatures,
      clothingStyle,
      palette,
      confidence
    },
    warnings
  }
}

export async function generateAppearanceSpec(appearanceDescription: string): Promise<{
  appearanceSpec: CharacterAppearanceSpec
  warnings: string[]
}> {
  const systemPrompt = `You are the Appearance Extractor. Return ONLY JSON.
Extract a structured appearance spec from the user's description.

RULES
- If sex/gender is not explicit, use "unknown". Do NOT guess.
- Only output fields in the schema.
- Provide confidence 0..1.
- Use these enums:
  sex: male|female|unknown
  genderPresentation: masculine|feminine|androgynous|unknown
  ageRange: teen|20s|30s|40s|50+|unknown
  hairLength: short|medium|long|unknown
  bodyType: slim|average|athletic|muscular|unknown
- Extract only explicit cues. Otherwise, use "unknown".

Return JSON with this exact shape:
{
  "sex": "unknown",
  "genderPresentation": "unknown",
  "ageRange": "unknown",
  "hairLength": "unknown",
  "bodyType": "unknown",
  "notableFeatures": [],
  "clothingStyle": [],
  "palette": [],
  "confidence": 0.0
}`

  const userPrompt = `Appearance description:
${appearanceDescription}

Return JSON only.`

  let raw = ''
  try {
    raw = await generateAIResponse({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxTokens: 300,
      responseFormat: { type: 'json_object' },
      taskType: 'APPEARANCE_JSON'
    })
  } catch (error: any) {
    const message = String(error?.message || '')
    if (/response_format|json_object|unsupported|json_validate_failed/i.test(message)) {
      raw = await generateAIResponse({
        systemPrompt,
        userPrompt,
        temperature: 0.2,
        maxTokens: 300,
        taskType: 'APPEARANCE_JSON'
      })
    } else {
      throw error
    }
  }

  const extracted = extractJsonObject(raw) || raw
  const parsed = safeJsonParse(extracted)
  if (!parsed) {
    const fallback = normalizeAppearanceSpec({})
    return { appearanceSpec: fallback.spec, warnings: fallback.warnings.concat('parse_failed') }
  }

  const normalized = normalizeAppearanceSpec(parsed)
  return { appearanceSpec: normalized.spec, warnings: normalized.warnings }
}

export async function generateClassVisualTags(
  className: string,
  classDescription?: string
): Promise<string[]> {
  const systemPrompt = `You are a portrait-tag extractor for character avatars.
Return ONLY JSON with this exact shape:
{ "tags": ["tag1", "tag2", "tag3"] }

Rules:
- 3 to 6 short tags.
- Portrait-safe only: collars, motifs, subtle symbols, aura lighting, facial accessories.
- Avoid full-body, weapons, scenes, or multiple poses.
- Keep tags concise.`

  const userPrompt = `Class name: ${className}
Class description: ${classDescription || 'None'}`

  let raw = ''
  try {
    raw = await generateAIResponse({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxTokens: 200,
      responseFormat: { type: 'json_object' },
      taskType: 'CLASS_TAGS_JSON'
    })
  } catch (error: any) {
    const message = String(error?.message || '')
    if (/response_format|json_object|unsupported|json_validate_failed/i.test(message)) {
      raw = await generateAIResponse({
        systemPrompt,
        userPrompt,
        temperature: 0.2,
        maxTokens: 200,
        taskType: 'CLASS_TAGS_JSON'
      })
    } else {
      throw error
    }
  }

  const extracted = extractJsonObject(raw) || raw
  const parsed = safeJsonParse(extracted)
  if (!parsed || !Array.isArray(parsed.tags)) {
    return []
  }
  return parsed.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean).slice(0, 6)
}

export async function generateCombatNarration(
  battleState: CombatState,
  events: CombatEvent[],
  context: string,
  language: PreferredLanguage = 'en'
): Promise<string> {
  const systemPrompt = `You are the combat narrator for a grounded dark-fantasy RPG.
Narrate ONLY the provided combat events. Start from the outcome and world reaction.
Do not add mechanics, rolls, DCs, or new effects. Do NOT ask the player to roll.

OUTPUT TEMPLATE (MANDATORY)
Dungeon Master
<Location \u00B7 Sub-location \u00B7 Time>

Immediate action (1-2 sentences)

Atmospheric detail (1-2 sentences)

Tension hook or shift (exactly 1 sentence)

STYLE RULES
- Factual first, atmospheric second.
- Concrete, physical description. No prophetic or poetic vagueness.
- Keep one blank line between blocks.
- End on a situation, not a question.
- No meta/system filler. No roll mentions.
- Subject clarity is mandatory: every action must have a clearly identifiable actor.
- Avoid ambiguous pronouns when multiple actors are present; name the actor directly.
- Spatial continuity is mandatory: no unexplained room/floor/location shifts mid-beat.
- Keep statements logically grounded in visible context; do not drop abrupt lore reveals without anchor.
- Avoid contradictory descriptors unless the contrast is explicitly explained.
- Keep dialogue direct and referential; avoid cryptic lines with missing referents.
- Grammar must be clean and professional: agreement, syntax, tense consistency, no mixed alphabets.

${languageDirective(language)}`

  const userPrompt = `Context:
${context || 'None'}

Battle state:
${JSON.stringify({
  round: battleState.round,
  phase: battleState.phase,
  entities: battleState.entities.map(entity => ({
    id: entity.id,
    name: entity.name,
    type: entity.type,
    hp: entity.hp,
    hp_max: entity.hp_max,
    statuses: entity.statuses.map(status => status.key)
  }))
})}

Events:
${JSON.stringify(events)}

Narrate only these events in-world.`

  const generateNarration = async (extraInstruction?: string) =>
    await generateAIResponse({
      systemPrompt,
      userPrompt: extraInstruction ? `${userPrompt}\n\n${extraInstruction}` : userPrompt,
      temperature: 0.4,
      maxTokens: 1200,
      taskType: 'COMBAT_NARRATION'
    })

  let raw = await generateNarration()
  let cleaned = stripMetaGuidance(raw)
  const lengthOutOfBounds = cleaned.length < 550 || cleaned.length > 1200
  if (lengthOutOfBounds) {
    const lengthInstruction =
      cleaned.length < 550
        ? 'Expand to 550-1200 characters while keeping the exact template and concrete detail.'
        : 'Trim to 550-1200 characters while keeping the exact template and concrete detail.'
    raw = await generateNarration(lengthInstruction)
    cleaned = stripMetaGuidance(raw)
  }

  if (isFillerResponse(cleaned)) {
    raw = await generateNarration(
      'Rewrite with grounded GT detail. Include physical actions and at least one clear reaction.'
    )
    cleaned = stripMetaGuidance(raw)
  }

  return cleaned || pickFallbackNarration(context, 'combat', language)
}

export type IntentDecision = {
  primarySegmentId: string
  intentType: 'REQUEST' | 'SPEECH' | 'ACTION_NOW' | 'PAST_REF' | 'PLAN' | 'UNKNOWN'
  domain: string
  shouldRoll: boolean
  stat: string | null
  skill?: string | null
  dc: number | null
  actionLabel: string
  narration: string
}

export async function generateIntentDecision(payload: {
  rawText: string
  segments: Array<{
    id: string
    text: string
    hint?: string
    confidence?: number
    anchorMatch?: boolean
    noRollCandidate?: boolean
    markers?: string[]
  }>
  lastResolvedAction?: Record<string, any> | null
  sceneContext?: Record<string, any> | null
}): Promise<IntentDecision> {
  const systemPrompt = `You are the intent router for a narrative RPG. Choose a primary segment, decide roll/no-roll, and provide a short action label. Return ONLY valid JSON with this exact schema:
{
  "primarySegmentId": "seg-1",
  "intentType": "REQUEST|SPEECH|ACTION_NOW|PAST_REF|PLAN|UNKNOWN",
  "domain": "physical|social|mental|magic|violence|stealth|other",
  "shouldRoll": true|false,
  "stat": "STR|DEX|CON|INT|WIS|CHA|null",
  "skill": "string|null",
  "dc": 12|13|14|15|null,
  "actionLabel": "short present-tense action",
  "narration": "1-3 sentences, outcome-focused, no numbers"
}

Rules:
- Never choose PAST_REF as primary if any REQUEST or ACTION_NOW exists.
- PAST_REF segments never roll.
- TRIVIALITY RULE: Basic actions (sitting, standing, walking normally, looking around) NEVER roll.
- ROLEPLAY RULE: Speech/apology/normal conversation without conflict or high stakes => no roll.
- Requests for trivial items or common services => no roll.
- Use ACTION_NOW for immediate actions with stakes.
- Keep actionLabel short (<= 8 words), no quotes.
- If shouldRoll=false, set stat and dc to null.`

  const userPrompt = `Raw text:
${payload.rawText}

Segments:
${JSON.stringify(payload.segments)}

Last resolved action:
${JSON.stringify(payload.lastResolvedAction || null)}

Scene context:
${JSON.stringify(payload.sceneContext || null)}`

  const raw = await generateAIResponse({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 400,
    taskType: 'INTENT_ROUTER'
  })

  const cleaned = stripMetaGuidance(raw)
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error('Intent router did not return JSON')
  }
  const jsonString = cleaned.slice(start, end + 1)
  const parsed = JSON.parse(sanitizeJsonForParse(jsonString))
  return parsed as IntentDecision
}

export async function generateQuestFromBackstory(
  backstory: string,
  characterInfo: { name?: string; className?: string },
  language: PreferredLanguage = 'en'
): Promise<GeneratedQuest> {
  const systemPrompt = `You are a D&D quest architect. Given a character's backstory, propose a single compelling quest that feels handcrafted for them.
Before writing the quest, extract Narrative Hooks from the backstory into:
Origin, Faction Ties, Wounds or Secrets, Supernatural Marks, Unresolved Past Events.
Use at least one Hook as the core driver of the quest. Prefer hooks that imply pursuit,
consequences, or a stirring place or artifact. Early quests should be hook-driven.
Return ONLY a JSON object with this exact structure:
{
  "id": "kebab-case-id",
  "title": "short quest title",
  "summary": "2 sentences that describe the inciting event and stakes",
  "hook": "one vivid line the DM can read when presenting the quest",
  "xp": number between 150 and 500,
  "recommendedLevel": number between 1 and 5,
  "objectives": ["list of clear objectives in order"]
}
${languageDirective(language)}`

  const userPrompt = `Character Name: ${characterInfo.name || (language === 'ru' ? 'Неизвестно' : 'Unknown')}
Class: ${characterInfo.className || (language === 'ru' ? 'Искатель приключений' : 'Adventurer')}
Backstory:
${backstory}

Design one quest tailored to this hero.`

  try {
    const response = await generateAIResponse({
      systemPrompt,
      userPrompt,
      temperature: 0.7,
      maxTokens: 800,
      taskType: 'QUEST_JSON'
    })

    let jsonString = response.trim()
    if (jsonString.includes('```json')) {
      jsonString = jsonString.split('```json')[1].split('```')[0].trim()
    } else if (jsonString.includes('```')) {
      jsonString = jsonString.split('```')[1].split('```')[0].trim()
    }

    const quest = JSON.parse(sanitizeJsonForParse(jsonString))
    return {
      id: quest.id || `quest-${Date.now()}`,
      title: quest.title || (language === 'ru' ? 'Героический шанс' : 'Heroic Opportunity'),
      summary: quest.summary || (language === 'ru' ? 'Таинственный слух сулит славу.' : 'A mysterious rumor promises glory.'),
      hook: quest.hook || (language === 'ru' ? 'Фигура в капюшоне манит вас к судьбе.' : 'A hooded figure beckons you toward destiny.'),
      xp: Math.max(50, Math.min(800, quest.xp || 200)),
      recommendedLevel: quest.recommendedLevel || 1,
      objectives: Array.isArray(quest.objectives) && quest.objectives.length
        ? quest.objectives
        : language === 'ru'
        ? ['Расследуйте тревожный след', 'Столкнитесь с угрозой', 'Заберите награду']
        : ['Investigate the disturbance', 'Confront the threat', 'Claim your reward']
    }
  } catch (error) {
    console.error('Error generating quest:', error)
    return {
      id: `quest-${Date.now()}`,
      title: language === 'ru' ? 'Эхо прошлого' : 'Echoes of the Past',
      summary:
        language === 'ru'
          ? 'Слух намекает, что поступки вашей семьи из прошлого возвращаются за расплатой.'
          : 'A rumor suggests the past deeds of your family are returning to haunt you.',
      hook:
        language === 'ru'
          ? 'Тёмные дела прошлого тянутся в настоящее — и кто-то явно знает, где вас найти.'
          : 'The past has a way of finding those who would rather forget it.',
      xp: 200,
      recommendedLevel: 1,
      objectives:
        language === 'ru'
          ? [
              'Выясните, кто стоит за происходящим',
              'Раскройте источник тревожных отголосков',
              'Упокойте прошлое или подчините его силу'
            ]
          : [
              'Uncover who is behind what is happening',
              'Uncover the source of the haunting echoes',
              'Lay the past to rest or seize its power'
            ]
    }
  }
}

export async function generateDMResponse(
  playerAction: string,
  characterInfo: any,
  gameContext: string = '',
  history: ChatCompletionMessage[] = [],
  sceneState: SceneState = {},
  backstoryArcContext?: {
    profile?: BackstoryProfile | null
    plan?: BackstoryArcPlan | null
    eligibleBeat?: BackstoryBeat | null
    currentTurn?: number
  },
  language: PreferredLanguage = 'en'
): Promise<{
  response: string
  diceRolls?: Array<{
    type: string
    result: number
    rolls: number[]
  }>
  requiresRoll?: boolean
  rollType?: string
  optionalRollType?: string
  checkRequest?: CheckRequest | null
}> {
  const knownNPCs = listNPCProfiles()
  const npcDisplayName = (name: string) => localizeNpcName(name, normalizeLanguage(language))
  const npcRegistrySummary = knownNPCs.length
    ? knownNPCs
        .map(
          npc =>
            `${npc.id} (${npcDisplayName(npc.name)}): dialogueColorId=${npc.dialogueColorId}, role=${npc.occupation || 'unknown'}, personality=${npc.innerCharacter}, voice=${npc.voice}, quirks=${npc.behaviorQuirks}`
        )
        .join('\n')
    : normalizeLanguage(language) === 'ru'
    ? 'Пока нет записей. Сцену удерживает Корин.'
    : 'None yet. Corin anchors the scene.'

  const sceneLocation = sceneState.location?.trim() || 'Unknown location'
  const sceneRoster = sceneState.roster?.length ? sceneState.roster.join(', ') : 'Unknown'
  const sceneTransition = sceneState.lastTransition?.trim() || 'None'
  const allowedProperNouns = Array.from(
    new Set(
      [
        sceneLocation,
        ...(sceneState.roster || []),
        ...knownNPCs.map(npc => npcDisplayName(npc.name)).filter(Boolean),
        characterInfo?.name,
        normalizeLanguage(language) === 'ru' ? 'Позолоченный Грифон' : 'The Gilded Griffin',
        'Everlume',
        normalizeLanguage(language) === 'ru' ? 'Корин' : 'Corin'
      ]
        .filter(Boolean)
        .map(value => String(value).trim())
        .filter(value => value.length > 0)
    )
  )

  const backstoryArcBlock = buildBackstoryArcPrompt(backstoryArcContext)
  const isRussian = normalizeLanguage(language) === 'ru'
  const responseLanguageRule = isRussian
    ? 'CRITICAL LANGUAGE REQUIREMENT: Output narration entirely in Russian (Cyrillic). Do not answer in English.'
    : 'CRITICAL LANGUAGE REQUIREMENT: Output narration entirely in English.'
  const russianPrecisionRules = isRussian
    ? `RUSSIAN PRECISION RULES (MANDATORY)
- Every sentence must have a clearly identifiable acting subject.
- If multiple male actors are present, avoid ambiguous pronouns (on/ego/tot/kto-to); use explicit role/name.
- Preserve spatial logic: no unexplained jumps between rooms/positions/floors.
- Do not introduce upper floors unless previously established by scene context.
- Keep physical descriptions plausible and visually coherent.
- Grammar must be professionally edited Russian prose: agreement, tense consistency, clean syntax.
- No mixed alphabets in headers or labels; never mix Cyrillic/Latin in "Dungeon Master".
- Anchor lore mentions (tattoo, missing brother, faction, past event) to current context before revelation.
- Faction naming consistency: prefer natural Russian naming for Snow Wolves and keep one variant.
- Dialogue must be direct and referential; no cryptic lines without a clear referent.
- Do not stack multiple metaphors in one paragraph; preserve semantic clarity.`
    : ''
  const russianPlainSpeechRules = isRussian
    ? `RUSSIAN STYLE CALIBRATION
- Prefer normal, natural speech over ornamental prose.
- Keep metaphor usage minimal: at most one light metaphor in the entire response.
- Default to concrete verbs and observable actions.
- Keep NPC dialogue practical and conversational, not literary or prophetic.
- Avoid rhetorical flourish; use direct sentences to express clear meaning.
- NPC logic must be grounded in their current anger/trust/suspicion state and recent events.`
    : ''

  const systemPrompt = `You are the Dungeon Master for a grounded dark-fantasy RPG with a Rollia House voice.

${responseLanguageRule}
${russianPrecisionRules ? `\n\n${russianPrecisionRules}` : ''}
${russianPlainSpeechRules ? `\n\n${russianPlainSpeechRules}` : ''}

FORMAT RULES (MANDATORY)
- Use this exact layout and order:
Dungeon Master
<Location \u00B7 Sub-location \u00B7 Time>

<Block 1: immediate action, 1-2 sentences>

<Block 2: atmospheric detail, 1-2 sentences>

<Block 3: tension hook or narrative shift, exactly 1 sentence>
- Keep one blank line between header and narrative, and between each block.
- "Dungeon Master" must stay in English exactly; do not replace it with localized variants.
- Put location only on the dedicated header line, never inside paragraph openings.
- No bullets, numbering, or meta labels in final output.
- If using Russian language output, only narrative text is Russian; header format stays exactly as shown.

SCENE TRANSITION CONSISTENCY
- Never switch location abruptly.
- If location changes, include a short transition cause in Block 1 before settling into the new place.
- If the shift is non-physical, explicitly mark it at sentence start:
  Vision:
  Memory:
  Hallucination:
  Magical Shift:
- Transition must explain why the scene context changed.

NARRATIVE STYLE
- Dark fantasy, grounded, BG3 / Dragon Age tone.
- Factual first, atmospheric second.
- Use concrete physical detail before interpretation.
- Avoid metaphor stacking: use at most one strong metaphor in the whole response.
- Alternate concrete detail with imagery; do not chain emotional + atmospheric + existential metaphors.
- Keep pacing tight and readable. Avoid long uninterrupted paragraphs.
- Subject clarity is mandatory: every action sentence must identify who acts.
- If two or more male characters are present, avoid ambiguous pronouns ("он", "его", "тот", "кто-то"); use names/roles.
- Dialogue must clarify facts and referents, not obscure them.

WORLD ACTS
- The world moves without waiting for the player.
- NPCs initiate, crowds shift, guards arrive, sounds interrupt, pressure escalates.
- End on a situation, not a question. Never ask "What do you do?"

OPENING SCENE
- The first scene of the campaign is generated dynamically using these same rules.
- Use the canonical starting location and time from campaign/scene state.
- Internal template to follow: arrival or waking, tavern interior, key NPC, background activity, external pressure.
- Inject 1-2 backstory hooks through NPC reaction, rumors, tension, or anomalies.
- Do not explain the backstory; expose it through reaction and consequence only.
- In the opening and early scenes, include at least one concrete beat that is a direct consequence of the player's backstory hooks.
- Backstory pressure must show through observable world reaction (recognition, suspicion, a targeted patrol/rumor, or a mark reacting).
- Treat the first message as the introduction to the world and the player's place in it: establish where they are, who is present, and what immediate pressure is forming.

OUTPUT RULES
- The scene header must be the first content line in the DM message.
- Always follow the template in that exact order.
- No meta/system filler. No roll mentions. No mechanics. Only <npc> tags for dialogue.
- No "you might/you could" suggestions or options.
- No abstract phrases like "fate whispers", "the world remembers".
- One response = one complete scene beat. No micro-messages.
- Spatial consistency is mandatory: no unexplained moves between rooms/floors/locations in one beat.
- Logical continuity is mandatory: anchor tattoos, relatives, secrets, and past events to prior context.
- Remove contradictory descriptors unless the reason for contrast is stated in the same sentence.
- Reduce abstract ambiguity: do not stack "что-то/будто/словно/казалось" style vagueness.
- Grammar enforcement: clean agreement, syntax, tense consistency; no mixed-script headers (never "Дungeon Master").
- NPC voice differentiation is required:
  - recurring NPCs must keep recognizable phrasing/rhythm.
  - avoid generic "dark wisdom" tone for every NPC.
  - dialogue should feel personal and role-specific, not poetic by default.
- Dialogue density: add about one extra short spoken line per scene beat on average.
- Background chatter is allowed when it advances tension (patron whispers, guards, servants).
- Keep dialogue short (3-12 words). No monologues.
- Readability check: make it clear who is here, what happened, who is a threat, and what changed.

LENGTH
- 550-1200 characters per response.

SCENE STATE
- Location: ${sceneLocation}
- Roster (present characters): ${sceneRoster}
- Last transition: ${sceneTransition}

KNOWN NPC REGISTRY (keep portrayals consistent, never reinvent):
${npcRegistrySummary}

COLOR TAGS
- When NPCs speak, wrap their exact quoted line in <npc id="npc_id">"NPC dialogue"</npc>.
- Use npc_id values from the registry. Do NOT output hex/rgb colors.
- Keep narration outside the tags.

Character Info:
  - Name: ${characterInfo.name || 'Unknown'}
  - Class: ${characterInfo.class || 'Unknown'}
${characterInfo.stats ? `- Stats: ${JSON.stringify(characterInfo.stats)}` : ''}
${characterInfo.appearance ? `- Appearance: ${characterInfo.appearance}` : ''}

${gameContext ? `Game Context: ${gameContext}` : ''}
${languageDirective(language)}`

  const userPromptBase = `${responseLanguageRule}

Player Action: ${playerAction}

Respond as the DM, narrating what happens in-world only. Follow the template exactly. No roll or mechanics references.`

  const buildUserPrompt = (extraInstruction?: string) =>
    extraInstruction ? `${userPromptBase}\n\n${extraInstruction}` : userPromptBase

  const generateNarration = async (extraInstruction?: string) =>
    await generateAIResponse({
      systemPrompt,
      userPrompt: buildUserPrompt(extraInstruction),
      history,
      temperature: 0.8,
      maxTokens: 1400,
      taskType: 'DM_NARRATION'
    })

  const cleanNarration = (raw: string) => {
    const checkMatch = raw.match(/\[CHECK_REQUEST([^\]]*)\]/i)
    const checkRequest = checkMatch ? parseTagAttributes(checkMatch[1]) : null

    const requiredMatch = raw.match(/\[REQUIRES_ROLL:\s*([^\]]+)\]/i)
    const optionalMatch = raw.match(/\[OPTIONAL_ROLL:\s*([^\]]+)\]/i)
    const rollResolution = resolveRollIntent(requiredMatch?.[1], optionalMatch?.[1])
    const checkRollType = checkRequest ? buildCheckRollType(checkRequest) : undefined

    const hasRollEvent = Boolean(checkRollType || rollResolution.rollType)
    const rawWithoutTags = raw
      .replace(/\[REQUIRES_ROLL:[^\]]*\]/gi, '')
      .replace(/\[OPTIONAL_ROLL:[^\]]*\]/gi, '')
      .replace(/\[EFFECT[^\]]*\]/gi, '')
      .replace(/\[CHECK_REQUEST[^\]]*\]/gi, '')
      .trim()

    let cleanedResponse = stripMetaGuidance(rawWithoutTags)
    const stateChangeResult = stripStateChangeWithoutEvent(cleanedResponse, hasRollEvent)
    cleanedResponse = stateChangeResult.cleaned

    return {
      response: cleanedResponse,
      hasRollEvent,
      checkRequest,
      rollResolution,
      checkRollType,
      stateChangeResult
    }
  }

  let rawResponse = await generateNarration()
  let cleanedResult = cleanNarration(rawResponse)
  const lengthOutOfBounds =
    cleanedResult.response.length < 550 || cleanedResult.response.length > 1200
  if (lengthOutOfBounds) {
    const lengthInstruction =
      cleanedResult.response.length < 550
        ? 'Expand to 550-1200 characters while keeping the exact template and concrete detail.'
        : 'Trim to 550-1200 characters while keeping the exact template and concrete detail.'
    rawResponse = await generateNarration(lengthInstruction)
    cleanedResult = cleanNarration(rawResponse)
  }
  if (containsForbiddenLexicon(cleanedResult.response)) {
    rawResponse = await generateNarration(
      `Rewrite to remove forbidden terms and use only these proper nouns: ${allowedProperNouns.join(', ') || 'none'}.`
    )
    cleanedResult = cleanNarration(rawResponse)
    if (containsForbiddenLexicon(cleanedResult.response)) {
      cleanedResult.response = removeForbiddenLines(cleanedResult.response)
    }
  }

  const npcNames = knownNPCs.map(npc => npc.name).filter(Boolean)
  const needsFillerRetry = isFillerResponse(cleanedResult.response)
  const needsBridgeRetry = missingBridgeBeat(cleanedResult.response, sceneState, npcNames)

  if (needsFillerRetry || needsBridgeRetry) {
    const retryInstruction = buildRetryInstruction({
      filler: needsFillerRetry,
      bridge: needsBridgeRetry,
      sceneState
    })
    rawResponse = await generateNarration(retryInstruction)
    cleanedResult = cleanNarration(rawResponse)
  }

  if (isRussian && cleanedResult.response && !isMostlyCyrillic(cleanedResult.response)) {
    rawResponse = await generateNarration(
      'Rewrite the same scene fully in Russian (Cyrillic). Preserve all events and structure, change language only.'
    )
    cleanedResult = cleanNarration(rawResponse)
  }

  let cleanedResponse = cleanedResult.response
  const shouldFallback = !cleanedResponse || !cleanedResponse.trim()
  if (shouldFallback) {
    const fallback = pickFallbackNarration(gameContext, playerAction, language)
    console.warn('DM output empty after filtering.', {
      reason: cleanedResult.stateChangeResult.removed
        ? 'STATE_CHANGE_WITHOUT_EVENT'
        : 'EMPTY_AFTER_FILTER',
      raw: rawResponse.slice(0, 400)
    })
    cleanedResponse = fallback
  } else if (cleanedResult.stateChangeResult.removed) {
    console.warn('Stripped state-changing narration without system event.', {
      reason: 'STATE_CHANGE_WITHOUT_EVENT',
      raw: rawResponse.slice(0, 400)
    })
  }

  const autoTagged = autoTagNpcDialogue(cleanedResponse, knownNPCs)
  if (autoTagged !== cleanedResponse) {
    cleanedResponse = autoTagged
  }

  await syncNPCProfilesFromResponse(cleanedResponse, 'The Gilded Griffin')

  return {
    response: cleanedResponse,
    requiresRoll: Boolean(cleanedResult.checkRollType || cleanedResult.rollResolution.rollType),
    rollType: cleanedResult.checkRollType || cleanedResult.rollResolution.rollType,
    optionalRollType: cleanedResult.rollResolution.optionalRollType,
    checkRequest: cleanedResult.checkRequest || undefined
  }
}

function extractMessageContent(message?: ChatCompletionMessage): string {
  if (!message?.content) {
    return ''
  }

  if (typeof message.content === 'string') {
    return message.content.trim()
  }

  return (message.content as Array<unknown>)
    .map((part: unknown) => {
      if (!part) {
        return ''
      }

      if (typeof part === 'string') {
        return part
      }

      if (typeof part === 'object' && part !== null && 'text' in part && (part as Record<string, unknown>).text) {
        return (part as Record<string, unknown>).text as string
      }

      return ''
    })
    .join('')
    .trim()
}

function buildBackstoryArcPrompt(context?: {
  profile?: BackstoryProfile | null
  plan?: BackstoryArcPlan | null
  eligibleBeat?: BackstoryBeat | null
  currentTurn?: number
}): string {
  if (!context?.profile || !context?.plan) {
    return ''
  }

  const profile = context.profile
  const plan = context.plan
  const eligibleBeat = context.eligibleBeat
  const revealedFacts = plan.revealedFacts.length ? plan.revealedFacts.join('; ') : 'None'
  const secrecyRules = profile.secrecyRules.length ? profile.secrecyRules.join('; ') : 'None'

  const baseLines = [
    `Profile: origin=${profile.origin}; keyEvent=${profile.keyEvent}; unresolvedConflict=${profile.unresolvedConflict}.`,
    `Antagonistic force: ${profile.antagonisticForce}. Emotional core: ${profile.emotionalCore}.`,
    `Witnesses: ${profile.witnesses.join(', ') || 'None'}. Debts: ${profile.debts.join(', ') || 'None'}.`,
    `Artifacts/marks: ${profile.artifactsOrMarks.join(', ') || 'None'}.`,
    `Secrecy rules: ${secrecyRules}.`,
    `Revealed facts: ${revealedFacts}.`,
    `Pressure level: ${plan.pressureLevel}.`
  ]

  if (!eligibleBeat) {
    return `BACKSTORY ARC CONTEXT\n${baseLines.join('\n')}`
  }

  const beatLines = [
    `ELIGIBLE BEAT: ${eligibleBeat.type} (${eligibleBeat.goal}).`,
    `Delivery modes: ${eligibleBeat.deliveryModes.join(', ')}.`,
    `Max reveal level: ${eligibleBeat.constraints?.maxRevealLevel || 'hint'}.`,
    `Payload: ${eligibleBeat.payload?.summary || 'See payload fields'}.`
  ]

  const directive =
    'Directive: Surface ONE backstory beat subtly using an allowed delivery mode. Do NOT label it as a quest. Do NOT explain it. Show consequences through world events.'

  return `BACKSTORY ARC CONTEXT\n${baseLines.join('\n')}\n${beatLines.join('\n')}\n${directive}`
}

function stripThinkingBlocks(input: string): string {
  if (!input) {
    return ''
  }
  let output = input.replace(/<think>[\s\S]*?<\/think>/gi, '')
  output = output.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  if (/<think>/i.test(output)) {
    output = output.replace(/<think>[\s\S]*/i, '')
  }
  if (/<thinking>/i.test(output)) {
    output = output.replace(/<thinking>[\s\S]*/i, '')
  }
  return output.replace(/<\/?think>/gi, '').replace(/<\/?thinking>/gi, '').trim()
}

async function runWithRetries<T>(
  operation: () => Promise<T>,
  options: { retries?: number; label?: string } = {}
): Promise<T> {
  const maxRetries = options.retries ?? 2
  let attempt = 0

  while (true) {
    try {
      return await operation()
    } catch (error: any) {
      const isRetryable =
        error?.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
        error?.errno === 'ERR_STREAM_PREMATURE_CLOSE' ||
        /premature close/i.test(error?.message || '')

      if (!isRetryable || attempt >= maxRetries) {
        throw error
      }

      const delayMs = 250 * Math.pow(2, attempt)
      console.warn(
        `Retrying ${options.label || 'operation'} after ERR_STREAM_PREMATURE_CLOSE (attempt ${
          attempt + 1
        } of ${maxRetries + 1}) in ${delayMs}ms`
      )
      await new Promise(resolve => setTimeout(resolve, delayMs))
      attempt++
    }
  }
}

function sanitizeJsonForParse(input: string): string {
  let inString = false
  let escaped = false
  let result = ''

  for (const char of input) {
    if (!escaped && char === '"') {
      inString = !inString
    }

    if (inString && !escaped) {
      if (char === '\n') {
        result += '\\n'
        continue
      }
      if (char === '\r') {
        result += '\\r'
        continue
      }
      if (char === '\t') {
        result += '\\t'
        continue
      }
    }

    result += char

    if (!escaped && char === '\\') {
      escaped = true
    } else {
      escaped = false
    }
  }

  return result
}

function normalizeSummary(text: string): string {
  const cleaned = text.replace(/^summary:\s*/i, '').trim()
  if (!cleaned) {
    return ''
  }
  const lines = cleaned
    .split(/\n+/)
    .map(line => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)

  return lines.map(line => `- ${line}`).join('\n').trim()
}

function safeJsonParse(input: string): any | null {
  if (!input) {
    return null
  }
  try {
    return JSON.parse(sanitizeJsonForParse(input))
  } catch (error) {
    return null
  }
}

function repairJsonString(input: string): string {
  let output = input.trim()
  output = output.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  output = output.replace(/,\s*([}\]])/g, '$1')
  output = output.replace(/([{\s,])([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
  output = output.replace(/'([^']*)'/g, (_match, value) => `"${value.replace(/"/g, '\\"')}"`)
  return output
}

async function repairJsonWithModel(input: string): Promise<string | null> {
  const systemPrompt = `You fix broken JSON and output only valid JSON.
Return only a JSON object with keys: apply, update, remove.
Do not include any extra text.`

  const userPrompt = `Fix this JSON and return only valid JSON:
${input}`

  try {
    const response = await generateAIResponse({
      systemPrompt,
      userPrompt,
      temperature: 0,
      maxTokens: 400,
      taskType: 'REPAIR_JSON'
    })
    const extracted = extractJsonObject(response) || response
    return extracted.trim()
  } catch (error) {
    console.error('Failed to repair JSON with model:', error)
    return null
  }
}

function normalizeStatusUpdate(
  payload: any,
  statusState: StatusStateInput
): StatusUpdatePayload {
  const safePayload = payload && typeof payload === 'object' ? payload : {}
  const apply = Array.isArray(safePayload.apply) ? safePayload.apply : []
  const update = Array.isArray(safePayload.update) ? safePayload.update : []
  const remove = Array.isArray(safePayload.remove) ? safePayload.remove : []

  const activeIds = new Set((statusState.active_statuses || []).map(status => status.id))
  let prunedApply = apply.filter((entry: any) => entry && entry.id && entry.name)
  prunedApply = prunedApply.filter((entry: any) => !activeIds.has(entry.id))

  if (prunedApply.length > 1) {
    prunedApply = prunedApply.slice(0, 1)
  }

  const canonicalStatusMap: Record<
    string,
    { id: string; name: string; type: 'condition' | 'buff' | 'debuff' }
  > = {
    poisoned: { id: 'poisoned', name: 'Poisoned', type: 'condition' },
    blinded: { id: 'blinded', name: 'Blinded', type: 'condition' },
    charmed: { id: 'charmed', name: 'Charmed', type: 'condition' },
    frightened: { id: 'frightened', name: 'Frightened', type: 'condition' },
    paralyzed: { id: 'paralyzed', name: 'Paralyzed', type: 'condition' },
    restrained: { id: 'restrained', name: 'Restrained', type: 'condition' },
    stunned: { id: 'stunned', name: 'Stunned', type: 'condition' },
    unconscious: { id: 'unconscious', name: 'Unconscious', type: 'condition' },
    invisible: { id: 'invisible', name: 'Invisible', type: 'condition' },
    inspired: { id: 'inspired', name: 'Inspired', type: 'buff' },
    blessed: { id: 'blessed', name: 'Blessed', type: 'buff' },
    cursed: { id: 'cursed', name: 'Cursed', type: 'debuff' },
    bleeding: { id: 'bleeding', name: 'Bleeding', type: 'debuff' },
    madness: { id: 'madness', name: 'Madness', type: 'debuff' },
    fear: { id: 'fear', name: 'Fear', type: 'debuff' },
    corruption: { id: 'corruption', name: 'Corruption', type: 'debuff' },
    exhaustion: { id: 'exhaustion', name: 'Exhaustion', type: 'debuff' }
  }

  const socialOrScenePattern =
    /\b(crowd|room|tavern|atmosphere|reputation|tension|patrons|bystanders|onlookers|public|rumor|gossip|npc|bartender|barkeep|innkeeper)\b/i
  const mechanicsPattern =
    /\b(advantage|disadvantage|speed|cannot|can'?t|no reactions|bonus|penalty|halved|incapacitated|attack roll|saving throw|ability check|ac|damage|restrained|stunned|poisoned|grappled|prone|blinded|deafened|paralyzed|unconscious|invisible|exhaustion|critical|auto fails?|fails)\b/i
  const triggerPattern =
    /\b(save|spell|hit|damage|failed|success|check|dc|poison|venom|curse|ritual|artifact|touch|round|turn|start|end|after|when|on|critical)\b/i
  const validDuration = new Set(['rounds', 'minutes', 'scene', 'until_removed'])

  const buildStatusDefinition = (
    normalizedId: string,
    severity?: number
  ): {
    name: string
    type: 'condition' | 'buff' | 'debuff'
    mechanics: string
    modifiers: StatusModifiers
    restrictions: StatusRestrictions
    narrationCues: string[]
    dot?: StatusDot
  } | null => {
    const baseDefinitions: Record<
      string,
      {
        name: string
        type: 'condition' | 'buff' | 'debuff'
        mechanics: string
        modifiers: StatusModifiers
        restrictions: StatusRestrictions
        narrationCues: string[]
        dot?: StatusDot
      }
    > = {
      poisoned: {
        name: 'Poisoned',
        type: 'debuff',
        mechanics: 'Disadvantage on attack rolls and ability checks.',
        modifiers: { attackRolls: 'dis', abilityChecks: 'dis' },
        restrictions: {},
        narrationCues: ['nausea', 'shaky hands', 'sweat', 'slowed reactions']
      },
      blinded: {
        name: 'Blinded',
        type: 'debuff',
        mechanics:
          'Automatically fails sight-based checks. Attack rolls against you have advantage. Your attack rolls have disadvantage.',
        modifiers: {
          perceptionSight: 'auto-fail',
          attackRolls: 'dis (self); attackers adv'
        },
        restrictions: { special: 'Cannot target by sight unless guessing location.' },
        narrationCues: ['darkness', 'blur', 'hands searching', 'missteps']
      },
      charmed: {
        name: 'Charmed',
        type: 'debuff',
        mechanics:
          'Cannot willingly attack the charmer. Charmer has advantage on social checks vs you.',
        modifiers: { actionAvailability: 'cannot harm charmer' },
        restrictions: { cannotTargetCharmer: true },
        narrationCues: ['softened tone', 'trusting posture', 'rationalizing requests']
      },
      frightened: {
        name: 'Frightened',
        type: 'debuff',
        mechanics:
          'Disadvantage on attack rolls and ability checks while source is in sight. Cannot willingly move closer.',
        modifiers: { attackRolls: 'dis (source in sight)', abilityChecks: 'dis (source in sight)' },
        restrictions: { cannotApproachSource: true },
        narrationCues: ['tight breath', 'tunnel vision', 'instinct to flee']
      },
      paralyzed: {
        name: 'Paralyzed',
        type: 'debuff',
        mechanics:
          'Incapacitated; cannot move or speak. Automatically fails STR/DEX saves. Attackers have advantage; melee hits within 5 ft are critical.',
        modifiers: {
          savingThrows: 'STR/DEX auto-fail',
          attackRolls: 'attackers adv; melee crit within 5 ft'
        },
        restrictions: { canAct: false, canMove: false, canSpeak: false, reactionsAllowed: false },
        narrationCues: ['frozen muscles', 'wide eyes', 'no response']
      },
      restrained: {
        name: 'Restrained',
        type: 'debuff',
        mechanics:
          'Speed 0. Attack rolls against you have advantage. Your attack rolls have disadvantage. Disadvantage on DEX saves.',
        modifiers: {
          movementSpeed: '0',
          attackRolls: 'dis (self); attackers adv',
          savingThrows: 'DEX dis'
        },
        restrictions: { canMove: false, special: 'Can attempt escape.' },
        narrationCues: ['bindings bite', 'dragged posture', 'limited swings']
      },
      stunned: {
        name: 'Stunned',
        type: 'debuff',
        mechanics:
          'Incapacitated; cannot move. Automatically fails STR/DEX saves. Attackers have advantage.',
        modifiers: { savingThrows: 'STR/DEX auto-fail', attackRolls: 'attackers adv' },
        restrictions: { canAct: false, canMove: false, reactionsAllowed: false },
        narrationCues: ['ringing ears', 'blank stare', 'delayed responses']
      },
      unconscious: {
        name: 'Unconscious',
        type: 'debuff',
        mechanics:
          'Incapacitated and prone. Automatically fails STR/DEX saves. Attackers have advantage; melee hits within 5 ft are critical.',
        modifiers: {
          savingThrows: 'STR/DEX auto-fail',
          attackRolls: 'attackers adv; melee crit within 5 ft'
        },
        restrictions: { canAct: false, canMove: false, canSpeak: false, reactionsAllowed: false },
        narrationCues: ['collapse', 'slack limbs', 'shallow breath']
      },
      invisible: {
        name: 'Invisible',
        type: 'buff',
        mechanics:
          'Cannot be seen without special senses. Your attack rolls have advantage. Attack rolls against you have disadvantage.',
        modifiers: { attackRolls: 'adv (self); attackers dis' },
        restrictions: { special: 'Still detectable by sound or tracks.' },
        narrationCues: ['outline vanishes', 'footsteps remain', 'air shifts']
      },
      inspired: {
        name: 'Inspired',
        type: 'buff',
        mechanics: 'Gain advantage on one chosen roll. Consumed on use.',
        modifiers: {
          attackRolls: 'adv (one roll)',
          abilityChecks: 'adv (one roll)',
          savingThrows: 'adv (one roll)'
        },
        restrictions: { special: 'Consumed on use.' },
        narrationCues: ['surge of confidence', 'clear focus', 'steady hands']
      },
      blessed: {
        name: 'Blessed',
        type: 'buff',
        mechanics: 'Add 1d4 to attack rolls and saving throws.',
        modifiers: { attackRolls: '+1d4', savingThrows: '+1d4' },
        restrictions: {},
        narrationCues: ['faint glow', 'calm certainty', 'guided motion']
      },
      cursed: {
        name: 'Cursed',
        type: 'debuff',
        mechanics: 'Disadvantage on specified rolls or saves, defined by the curse.',
        modifiers: { abilityChecks: 'dis (specified)', savingThrows: 'dis (specified)' },
        restrictions: { special: 'Curse may include compulsion or aversion.' },
        narrationCues: ['cold weight', 'bad luck', 'uneasy whispers']
      },
      bleeding: {
        name: 'Bleeding',
        type: 'debuff',
        mechanics: 'Take damage at start of each turn. Severe bleeding imposes CON check disadvantage.',
        modifiers: { abilityChecks: 'CON dis (severe)' },
        restrictions: { special: 'May limit recovery until treated.' },
        narrationCues: ['dripping blood', 'dizziness', 'stained clothes'],
        dot: { timing: 'startOfTurn', amount: '1d4' }
      },
      madness: {
        name: 'Madness',
        type: 'debuff',
        mechanics: 'Disadvantage on WIS and CHA checks. Under stress, WIS saves may be required.',
        modifiers: { abilityChecks: 'WIS/CHA dis', savingThrows: 'WIS dis (under stress)' },
        restrictions: { special: 'May lose action on failed stress save.' },
        narrationCues: ['intrusive thoughts', 'paranoia', 'dissociation']
      },
      fear: {
        name: 'Fear',
        type: 'debuff',
        mechanics:
          'When confronting the fear trigger, make a WIS save or become Frightened for the scene.',
        modifiers: { savingThrows: 'WIS save on trigger' },
        restrictions: { special: 'Avoidance behavior unless save succeeds.' },
        narrationCues: ['flashbacks', 'freezing', 'shaky voice']
      },
      corruption: {
        name: 'Corruption',
        type: 'debuff',
        mechanics:
          'Progressive debuff to WIS/CHA with hallucination or impulse triggers at higher tiers.',
        modifiers: { savingThrows: 'WIS penalty by tier', abilityChecks: 'WIS/CHA dis at tier 2+' },
        restrictions: { special: 'At high tier, failed WIS save can force impulse action.' },
        narrationCues: ['dark veins', 'whispers', 'cravings', 'distorted reflections']
      },
      exhaustion: {
        name: 'Exhaustion',
        type: 'debuff',
        mechanics: 'Exhaustion level effects apply per tier.',
        modifiers: {},
        restrictions: {},
        narrationCues: ['heavy limbs', 'shaking', 'collapse']
      }
    }

    if (normalizedId === 'exhaustion') {
      const level = typeof severity === 'number' ? severity : 1
      const exhaustionLevels: Record<number, StatusModifiers> = {
        1: { abilityChecks: 'dis' },
        2: { movementSpeed: '0.5x' },
        3: { attackRolls: 'dis', savingThrows: 'dis' },
        4: { hpMax: '0.5x' },
        5: { movementSpeed: '0', actionAvailability: 'cannot move' },
        6: { actionAvailability: 'dead' }
      }
      const base = baseDefinitions.exhaustion
      return {
        ...base,
        name: `Exhaustion (Level ${level})`,
        mechanics:
          'Level 1: ability checks disadvantage. Level 2: speed halved. Level 3: attack rolls and saves disadvantage. Level 4: HP max halved. Level 5: speed 0. Level 6: death.',
        modifiers: exhaustionLevels[level] || base.modifiers,
        restrictions:
          level >= 6
            ? { canAct: false, canMove: false, canSpeak: false, reactionsAllowed: false }
            : level >= 5
            ? { canMove: false }
            : {}
      }
    }

    if (normalizedId === 'corruption') {
      const tier = typeof severity === 'number' ? severity : 1
      const base = baseDefinitions.corruption
      return {
        ...base,
        name: `Corruption (Tier ${tier})`,
        modifiers:
          tier === 1
            ? { savingThrows: 'WIS -1 (or dis once per scene)' }
            : tier === 2
            ? { abilityChecks: 'WIS/CHA dis', savingThrows: 'WIS dis on trigger' }
            : { abilityChecks: 'WIS/CHA dis', savingThrows: 'WIS dis', damage: 'impulse risk' },
        restrictions:
          tier >= 3
            ? { special: 'On failed WIS save, DM may force one harmful impulse.' }
            : base.restrictions
      }
    }

    const base = baseDefinitions[normalizedId]
    return base || null
  }

  const normalizeEntry = (entry: any): StatusEffect | null => {
    if (!entry || !entry.id || !entry.name || !entry.mechanics) {
      return null
    }
    const rawId = String(entry.id).trim().toLowerCase()
    const rawName = String(entry.name).trim()
    const mechanics = String(entry.mechanics).trim()
    const trigger = String(entry.trigger || '').trim()
    const cure = String(entry.cure || '').trim()

    if (!rawId || !rawName || !mechanics || !trigger || !cure) {
      return null
    }
    if (
      socialOrScenePattern.test(rawName) ||
      socialOrScenePattern.test(mechanics) ||
      socialOrScenePattern.test(trigger) ||
      socialOrScenePattern.test(cure)
    ) {
      return null
    }
    if (!mechanicsPattern.test(mechanics)) {
      return null
    }
    if (!triggerPattern.test(trigger)) {
      return null
    }

    const durationType = entry.duration?.type
    if (!durationType || !validDuration.has(durationType)) {
      return null
    }
    const durationValue =
      typeof entry.duration?.value === 'number' ? entry.duration.value : undefined

    let normalizedId = rawId
    let normalizedName = rawName
    let normalizedSeverity =
      typeof entry.severity === 'number' ? Math.floor(entry.severity) : undefined
    let normalizedType: 'condition' | 'buff' | 'debuff' =
      entry.type === 'buff' || entry.type === 'debuff' ? entry.type : 'condition'

    if (rawId.startsWith('exhaustion') || /exhaustion/i.test(rawName)) {
      const levelMatch = rawId.match(/(\d+)/) || rawName.match(/(\d+)/)
      const level = levelMatch ? Number(levelMatch[1]) : normalizedSeverity
      if (!level || level < 1 || level > 6) {
        return null
      }
      normalizedId = 'exhaustion'
      normalizedName = `Exhaustion (Level ${level})`
      normalizedSeverity = level
      normalizedType = 'debuff'
    } else if (rawId.startsWith('corruption') || /corruption/i.test(rawName)) {
      const tierMatch = rawId.match(/(\d+)/) || rawName.match(/(\d+)/)
      const tier = tierMatch ? Number(tierMatch[1]) : normalizedSeverity
      if (!tier || tier < 1 || tier > 3) {
        return null
      }
      normalizedId = 'corruption'
      normalizedName = `Corruption (Tier ${tier})`
      normalizedSeverity = tier
      normalizedType = 'debuff'
    } else {
      const canonical = canonicalStatusMap[rawId]
      if (!canonical) {
        return null
      }
      normalizedId = canonical.id
      normalizedName = canonical.name
      normalizedType = canonical.type
    }

    const definition = buildStatusDefinition(normalizedId, normalizedSeverity)
    if (!definition) {
      return null
    }

    return {
      id: normalizedId,
      name: definition.name || normalizedName,
      type: definition.type || normalizedType,
      mechanics: definition.mechanics,
      trigger,
      modifiers: definition.modifiers,
      restrictions: definition.restrictions,
      narrationCues: definition.narrationCues,
      duration: { type: durationType, value: durationValue },
      cure,
      source: entry.source ? String(entry.source) : undefined,
      severity: typeof normalizedSeverity === 'number' ? normalizedSeverity : undefined,
      appliedAt: typeof entry.appliedAt === 'number' ? entry.appliedAt : undefined
    }
  }

  const normalizeRemove = (entry: any) => {
    if (!entry) return null
    if (typeof entry === 'string') {
      return { id: entry }
    }
    if (entry.id) {
      return { id: String(entry.id) }
    }
    return null
  }

  return {
    apply: prunedApply.map(normalizeEntry).filter(Boolean) as StatusEffect[],
    update: update.map(normalizeEntry).filter(Boolean) as StatusEffect[],
    remove: remove.map(normalizeRemove).filter(Boolean) as Array<{ id: string }>
  }
}

function extractJsonObject(input: string): string | null {
  const firstBrace = input.indexOf('{')
  const lastBrace = input.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null
  }
  return input.slice(firstBrace, lastBrace + 1).trim()
}

function parseTagAttributes(attrText: string): CheckRequest {
  const attributes: Record<string, string> = {}
  const regex = /(\w+)="([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(attrText)) !== null) {
    attributes[match[1].toLowerCase()] = match[2]
  }
  regex.lastIndex = 0
  return {
    id: attributes.id,
    type: attributes.type,
    actor: attributes.actor,
    stat: attributes.stat,
    difficulty: attributes.difficulty,
    context: attributes.context,
    on_success: attributes.on_success,
    on_failure: attributes.on_failure
  }
}

function buildCheckRollType(request: CheckRequest): string | undefined {
  const stat = request.stat?.toUpperCase()
  if (!stat) {
    return undefined
  }
  const context = request.context ? `to ${request.context}` : ''
  return `d20+0 ${stat}${context ? ` ${context}` : ''}`.trim()
}

const NPC_TAG_REGEX = /<npc\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/npc>/gi
const FORBIDDEN_LEXICON = [
  'old greg',
  "greg's tavern",
  'crosshaven',
  'temple of all paths',
  'scales of justice',
  'twilight demesne',
  'crystal empire',
  'wild territory',
  'bringer',
  'whispering well'
]

const containsForbiddenLexicon = (text: string): boolean => {
  const lower = (text || '').toLowerCase()
  return FORBIDDEN_LEXICON.some(term => lower.includes(term))
}

const removeForbiddenLines = (text: string): string => {
  const lines = (text || '').split('\n')
  const filtered = lines.filter(line => !containsForbiddenLexicon(line))
  return filtered.join('\n').trim()
}

function stripMetaGuidance(text: string): string {
  const metaPattern =
    /(\\broll\\b|saving throw|ability check|dc\\s*\\d+|make a .* save|roll successful|roll failed|action resolved)/i
  const forbiddenPhrases = [
    'you might need',
    'you might want',
    'you could',
    'you can choose',
    'you may want',
    'the choice is yours',
    'no immediate dice rolls are required',
    'you can try',
    "if you'd like",
    'feel free',
    'perhaps you',
    'consider',
    'you need to',
    'you must',
    'you may attempt',
    'you should',
    'try to',
    'to gauge',
    'to persuade',
    'to convince',
    'the situation is delicate',
    'you may respond',
    'you can respond',
    'you can allow',
    'roll successful',
    'roll failed',
    'action resolved',
    'roll result'
  ]

  const lines = text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => {
      if (!line) {
        return true
      }
      const lower = line.toLowerCase()
      if (metaPattern.test(lower)) {
        return false
      }
      return !forbiddenPhrases.some(phrase => lower.includes(phrase))
    })
    .map(line => line)

  return lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

function isFillerResponse(text: string): boolean {
  if (!text) return true
  const wordCount = text.trim().split(/\s+/).length
  const abstractPattern =
    /\b(moment|tension|silence|stillness|breath|hush|weight|pressure|unease|waiting|hangs|holds|lingers)\b/i
  const concretePattern =
    /\b(steps?|footsteps|moves?|turns?|opens?|closes?|leans?|nods?|shakes?|sets?|puts?|grabs?|pushes?|pulls?|draws?|hits?|strikes?|kicks?|throws?|runs?|says?|asks?|replies?|shouts?|whispers?|laughs?|coughs?|door|table|mug|chair|lantern|blade|blood|floor|wall|window|stairs?)\b/i
  const hasDialogue = /"[^"]+"|'[^']+'/m.test(text)
  const hasConcrete = concretePattern.test(text) || hasDialogue
  if (wordCount >= 35) {
    return !hasConcrete && abstractPattern.test(text)
  }
  return !hasConcrete && abstractPattern.test(text)
}

function missingBridgeBeat(
  text: string,
  sceneState: SceneState,
  knownNpcNames: string[]
): boolean {
  if (!text || !knownNpcNames.length) return false
  const roster = new Set((sceneState.roster || []).map(name => name.toLowerCase()))
  if (!roster.size) return false
  const bridgePattern =
    /\b(door opens|door swings|latch|footsteps|steps|enters?|arrives?|comes in|from behind|behind you|from the hall|from outside|steps out|steps in|voice behind)\b/i

  const lower = text.toLowerCase()
  const missingNames = knownNpcNames.filter(
    name => name && !roster.has(name.toLowerCase()) && lower.includes(name.toLowerCase())
  )
  if (!missingNames.length) {
    return false
  }
  return !bridgePattern.test(lower)
}

function buildRetryInstruction(options: {
  filler: boolean
  bridge: boolean
  sceneState: SceneState
}): string {
  const instructions: string[] = []
  if (options.filler) {
    instructions.push(
      'Rewrite with grounded GT detail. Include physical actions and at least one NPC reaction or clear environment change.'
    )
  }
  if (options.bridge) {
    const roster = options.sceneState.roster?.length
      ? options.sceneState.roster.join(', ')
      : 'the roster'
    instructions.push(
      `Add a bridge line explaining how any off-roster character enters the scene. Current roster: ${roster}.`
    )
  }
  return instructions.join(' ')
}

function resolveRollIntent(required?: string, optional?: string): {
  rollType?: string
  optionalRollType?: string
} {
  if (!required && !optional) {
    return {}
  }
  const resolveOne = (raw?: string): string | undefined => {
    if (!raw) return undefined
    const intentMatch = raw.match(/intent\\s*=\\s*([a-z0-9_\\-]+)/i)
    const statToken = raw.match(/\\b(STR|DEX|CON|INT|WIS|CHA)\\b/i)?.[1]?.toUpperCase()
    const labelRaw = raw.replace(/\\b\\d*d\\d+([+-]\\d+)?\\b/gi, '')
    const intentRaw = intentMatch ? intentMatch[1] : labelRaw
    const intentLabel = intentRaw
      .replace(/intent\\s*=\\s*/i, '')
      .replace(/\\b(STR|DEX|CON|INT|WIS|CHA)\\b/gi, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\\s+/g, ' ')
      .trim()

    const resolvedStat = statToken || mapIntentToStat(intentLabel)
    if (!resolvedStat) {
      return undefined
    }
    const actionLabel = intentLabel ? `to ${intentLabel}` : ''
    return `d20+0 ${resolvedStat}${actionLabel ? ` ${actionLabel}` : ''}`.trim()
  }

  return {
    rollType: resolveOne(required),
    optionalRollType: resolveOne(optional)
  }
}

function mapIntentToStat(intent: string): string | undefined {
  const normalized = (intent || '').toLowerCase()
  const map: Array<{ key: RegExp; stat: string }> = [
    { key: /dodge|avoid|sidestep|duck|evade/, stat: 'DEX' },
    { key: /resist|endure|withstand|poison|pain|fatigue/, stat: 'CON' },
    { key: /hold|force|push|brace|lift|wrestle/, stat: 'STR' },
    { key: /read|sense|notice|insight|intuition|motive/, stat: 'WIS' },
    { key: /recall|analyze|logic|investigate|study/, stat: 'INT' },
    { key: /charm|persuade|deceive|intimidate|command/, stat: 'CHA' }
  ]
  const match = map.find(entry => entry.key.test(normalized))
  return match?.stat
}

function stripStateChangeWithoutEvent(
  text: string,
  hasEvent: boolean
): { cleaned: string; removed: boolean } {
  if (hasEvent) {
    return { cleaned: text, removed: false }
  }
  const patterns = [
    /\\bdisarm\\b/i,
    /\\bknock(?:s|ed)?\\s+.*\\b(prone|down)\\b/i,
    /\\bgrapple\\b|\\bgrapples\\b|\\bpinned\\b/i,
    /\\bweapon\\b.*\\b(clatters|skitters|flies|drops)\\b/i,
    /\\bforced\\s+movement\\b|\\bshoves?\\b|\\bthrows?\\b\\s+you\\b/i,
    /\\bstunned\\b|\\bstun\\b/i,
    /\\bsevere\\s+injury\\b|\\bmassive\\s+damage\\b/i
  ]
  const sentences = text.split(/(?<=[.!?])\\s+/)
  let removed = false
  const kept = sentences.filter(sentence => {
    if (patterns.some(pattern => pattern.test(sentence))) {
      removed = true
      return false
    }
    return true
  })
  return { cleaned: kept.join(' ').trim(), removed }
}

function pickFallbackNarration(
  gameContext: string,
  playerAction: string,
  language: PreferredLanguage = 'en'
): string {
  const context = `${gameContext} ${playerAction}`.toLowerCase()
  const combatHints = /battle|fight|attack|blade|blood|strike|ambush|enemy|wound/
  const socialHints = /tavern|talk|ask|reply|barkeep|crowd|rumor|deal/
  const combatFallbacks =
    language === 'ru'
      ? [
          'Сталь звенит, клинок скользит по ножке стула.',
          'Сапоги скребут пол, кто-то подается ближе.',
          'Оружие глухо бьет о дерево и отлетает в сторону.',
          'Кто-то резко выдыхает и крепче встает в стойку.'
        ]
      : [
          'Steel rings as a blade glances off a chair leg.',
          'Boots scrape the floor as someone shifts closer.',
          'A weapon thuds against wood, then skitters to a stop.',
          'Breath hisses through teeth as a stance tightens.'
        ]
  const socialFallbacks =
    language === 'ru'
      ? [
          'Кружка звякает о стойку. Несколько голов поворачиваются к вам.',
          'Корин вытирает бар и поднимает взгляд. "Говори."',
          'Стулья скрипят, пара посетителей подается вперед.',
          'Дверь с тяжелым вздохом закрывается за чьей-то спиной.'
        ]
      : [
          'A mug clinks on the counter. A head turns toward you.',
          'Corin wipes the bar and looks up. "Go on."',
          'Chairs creak as a few patrons lean in to listen.',
          'A door sighs shut behind someone. The room stills.'
        ]
  const neutralFallbacks =
    language === 'ru'
      ? [
          'Фонарь мерцает и бросает резкую тень на пол.',
          'Пыль поднимается, когда сквозняк тянет из-под двери.',
          'Сапог шаркает по доскам. Кто-то меняет стойку.',
          'Вдалеке один раз звонит колокол и затихает.'
        ]
      : [
          'A lantern flickers and throws a hard shadow across the floor.',
          'Dust lifts as a draft slips under the door.',
          'A boot scuffs the boards. Someone shifts their weight.',
          'A distant bell rings once, then fades.'
        ]

  const pool = combatHints.test(context)
    ? combatFallbacks
    : socialHints.test(context)
    ? socialFallbacks
    : neutralFallbacks

  const narrativeLine = pool[Math.floor(Math.random() * pool.length)]
  const locationLine = inferFallbackSceneHeader(gameContext)
  const immediateAction = narrativeLine
  const atmosphere =
    language === 'ru'
      ? 'Запах дыма и мокрой шерсти держится в воздухе, а взгляды снова сходятся на движении.'
      : 'Smoke and wet wool linger in the air as nearby eyes track the movement.'
  const hook =
    language === 'ru'
      ? 'Напряжение сдвигается: следующий шаг уже меняет расклад.'
      : 'Tension shifts: the next move is already changing the room.'

  return `Dungeon Master
${locationLine}

${immediateAction}

${atmosphere}

${hook}`
}

function inferFallbackSceneHeader(gameContext: string): string {
  const match = gameContext.match(/location\s*:\s*([^\n]+)/i)
  const location = (match?.[1] || 'The Gilded Griffin').trim()
  return `${location} \u00B7 Main Floor \u00B7 Present`
}

async function syncNPCProfilesFromResponse(response: string, location: string): Promise<void> {
  const npcIds = extractCharacterNames(response)
  const creationTasks = npcIds
    .filter(id => !getNPCProfileById(id))
    .map(id =>
      generateNpcProfile(displayNameFromNpcId(id), {
        location,
        contextSnippet: response.slice(0, 800)
      }, id)
    )

  const profiles = await Promise.all(creationTasks)
  profiles
    .filter((profile): profile is NPCProfile => Boolean(profile))
    .forEach(profile => registerNPCProfile(profile))
}

function autoTagNpcDialogue(response: string, knownNPCs: NPCProfile[]): string {
  if (!response || response.includes('<npc')) {
    return response
  }
  const npcByName = new Map<string, NPCProfile>()
  knownNPCs.forEach(npc => {
    if (npc.name) {
      npcByName.set(npc.name.toLowerCase(), npc)
    }
  })
  const allNames = Array.from(npcByName.keys())
  if (!allNames.length) {
    return response
  }

  const quoteRegex = /(["“])([^"”]+)(["”])/g
  const lines = response.split('\n')
  const taggedLines = lines.map(line => {
    const lower = line.toLowerCase()
    const matchedName = allNames.find(name => lower.includes(name))
    if (!matchedName) {
      return line
    }
    const npc = npcByName.get(matchedName)
    if (!npc) {
      return line
    }
    return line.replace(quoteRegex, (_match, open, content, close) => {
      const text = `${open}${content}${close}`
      return `<npc id="${npc.id}">${text}</npc>`
    })
  })

  return taggedLines.join('\n')
}

function extractCharacterNames(response: string): string[] {
  const names = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = NPC_TAG_REGEX.exec(response)) !== null) {
    const npcId = match[1]?.trim()
    if (npcId) {
      names.add(npcId)
    }
  }
  NPC_TAG_REGEX.lastIndex = 0
  return Array.from(names)
}

function displayNameFromNpcId(npcId: string): string {
  const stripped = npcId.replace(/^npc[-_]/i, '').replace(/[_-]+/g, ' ').trim()
  if (!stripped) {
    return 'Unknown'
  }
  return stripped
    .split(' ')
    .map(word => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ')
}

async function generateNpcProfile(
  name: string,
  context: { location: string; contextSnippet: string },
  npcId?: string
): Promise<NPCProfile | null> {
  try {
    const systemPrompt = `You are an elite NPC architect for a grounded dark-fantasy world.
Produce concise but vivid NPC dossiers ONLY when asked.
Return ONLY JSON with this exact structure:
{
  "name": "",
  "role": "",
  "coreMotivation": "",
  "fearOrFlaw": "",
  "personality": "",
  "speechStyle": "",
  "behaviorQuirks": "",
  "relationshipToLocation": "",
  "wantsFromPlayer": "",
  "hiding": ""
}

Guidelines:
- Names must fit the setting (no clichés).
- personality lists 2–3 strong traits.
- speechStyle should describe how they talk (short/long, formal/rude, poetic/blunt).
- behaviorQuirks describe gestures or habits.
- relationshipToLocation explains how they tie to the current place (loyal patron, outsider, worker, spy).
- wantsFromPlayer and hiding should be actionable but stay secret unless uncovered in play.`

    const userPrompt = `Create an NPC profile.
NPC Name: ${name}
Location: ${context.location}
Hidden context: ${context.contextSnippet}`

    const raw = await generateAIResponse({
      systemPrompt,
      userPrompt,
      temperature: 0.6,
      maxTokens: 600,
      taskType: 'NPC_JSON'
    })

    let jsonString = raw.trim()
    if (jsonString.includes('```')) {
      const fenced = jsonString.match(/```(?:json)?([\s\S]*?)```/)
      if (fenced) {
        jsonString = fenced[1].trim()
      }
    }

    const parsed = safeJsonParse(jsonString) || safeJsonParse(repairJsonString(jsonString))
    if (!parsed) {
      throw new Error('NPC profile JSON parse failed')
    }
    const resolvedName = parsed.name || name
    const id = npcId || slugify(resolvedName)
    const profile: NPCProfile = {
      id,
      name: resolvedName,
      dialogueColorId: assignDialogueColorId(id),
      age: 'unknown',
      occupation: parsed.role || 'wanderer',
      firstImpression: '',
      innerCharacter: parsed.personality || '',
      primaryMotivation: parsed.coreMotivation || '',
      secondaryMotivation: '',
      secret: parsed.hiding || '',
      voice: parsed.speechStyle || '',
      behaviorQuirks: parsed.behaviorQuirks || '',
      relationshipToLocation: parsed.relationshipToLocation || context.location,
      potentialHook: parsed.wantsFromPlayer || '',
      location: context.location,
      contextSnippet: context.contextSnippet
    }

    return profile
  } catch (error) {
    console.error(`Failed to generate NPC profile for ${name}:`, error)
    return null
  }
}

/**
 * Extracts quest and NPC relationship updates from a scene narration.
 */
export async function generateQuestNPCUpdates(
  narration: string,
  currentQuests: any[],
  currentNPCs: any[],
  language: PreferredLanguage = 'en'
): Promise<{
  quests: Array<{ id?: string; title?: string; status?: string; objectives?: string[] }>
  npcRelationships: Array<{ npcId: string; npcName: string; affinityDelta: number; notes?: string }>
}> {
  const systemPrompt = `You are the Quest and Relationship monitor for a D&D session.
Analyze the provided narration and extract any changes to active quests or NPC relationships.

QUEST RULES:
- If a new quest is mentioned, return it with a title, status "active", and initial objectives.
- If an existing quest (by ID or Title) makes progress, return its updated status (active/completed/failed) or new objectives.
- Only include quests that actually changed in this specific narration.

NPC RELATIONSHIP RULES:
- Identify NPCs mentioned and how their relationship with the player shifted.
- affinityDelta: a number from -20 to +20. Positive for helpful/friendly acts, negative for hostile/insulting acts.
- notes: a brief one-sentence recap of the interaction (e.g., "Player helped find the lost locket").
- Only include NPCs who had a meaningful interaction in this scene.

Return ONLY JSON with this exact structure:
{
  "quests": [{ "id": "optional-id", "title": "Quest Title", "status": "active|completed|failed", "objectives": ["obj1"] }],
  "npcRelationships": [{ "npcId": "optional-id", "npcName": "NPC Name", "affinityDelta": number, "notes": "recap" }]
}

${languageDirective(language)}`

  const userPrompt = `Narration:
"${narration}"

Current Quests:
${JSON.stringify(currentQuests)}

Current Known NPCs & Standing:
${JSON.stringify(currentNPCs)}

Output JSON only.`

  try {
    const response = await generateAIResponse({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxTokens: 600,
      responseFormat: { type: 'json_object' },
      taskType: 'QUEST_NPC_JSON'
    })

    const extracted = extractJsonObject(response) || response
    const parsed = safeJsonParse(extracted)
    
    return {
      quests: Array.isArray(parsed?.quests) ? parsed.quests : [],
      npcRelationships: Array.isArray(parsed?.npcRelationships) ? parsed.npcRelationships : []
    }
  } catch (error) {
    console.error('Failed to extract Quest/NPC updates:', error)
    return { quests: [], npcRelationships: [] }
  }
}

function assignDialogueColorId(npcId: string): string {
  const palette = listNPCDialoguePalette()
  const hash = npcId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return palette[hash % palette.length].id
}
