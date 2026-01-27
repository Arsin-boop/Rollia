import express from 'express'
import type { ChatCompletionMessage } from 'openai/resources/chat/completions'
import {
  generateDMResponse,
  generateQuestFromBackstory,
  generateSceneSummary,
  generateStatusUpdate,
  generateBackstorySummary,
  generateCombatNarration,
  generateIntentDecision,
  generateBackstoryArcPlan
} from '../services/aiService.js'
import {
  getBackstoryArc,
  saveBackstoryArc,
  normalizeBackstoryArc,
  getEligibleBeat,
  markBeatUsed
} from '../services/backstoryArcStore.js'
import { listNPCProfiles, listNPCDialoguePalette } from '../services/npcRegistry.js'
import { getBattle, resolveAction, startBattle, type CombatEntity } from '../services/combatService.js'
import {
  annotateSegments,
  segmentMessage,
  type LastResolvedAction
} from '../services/intentUtility.js'

const router = express.Router()
const pendingChecks = new Map<string, PendingCheck>()
const gameStateByCampaign = new Map<string, { lastResolvedAction?: LastResolvedAction | null; turnIndex?: number }>()

type ActionIntent = {
  action: 'attack' | 'attempt' | 'talk'
  target: string | null
  tags: Array<'violence' | 'social' | 'stealth' | 'physical'>
  stakes: 'low' | 'medium' | 'high'
  suggested_check: 'none' | 'combat' | 'skill' | 'contest'
  reason: string
}

type PendingCheck = {
  id: string
  type: 'attack' | 'skill' | 'save' | 'contest' | 'perception' | 'social' | 'stealth' | 'magic'
  actor: 'player' | string
  target?: string | null
  targetLabel?: string | null
  stat: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'
  difficulty: 'opposed' | number
  context: string
  reason: string
  actionLabel?: string
  domain?: string
  skill?: string | null
  intentType?: string
  intent?: {
    action: ActionIntent['action']
    tags: ActionIntent['tags']
    target: ActionIntent['target']
  }
}

const generateCheckId = () => `check_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

const TRY_PATTERN = /^\s*(i\s+)?(try|attempt)\s+to\b/i
const PERSON_TARGET_PATTERN = /\b(him|her|them|guard|bartender|barkeep|innkeeper|man|woman|guy|enemy|foe|npc|soldier|bandit|thug)\b/i

const normalizeInput = (text: string) =>
  text
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

const summarizeActionText = (rawText: string, maxWords: number = 6) => {
  let text = rawText.replace(/["“”][^"“”]*["“”]/g, '').trim()
  text = text.replace(/^\s*(i\s+)?(try|attempt)\s+to\s+/i, '')
  text = text.replace(/^\s*i\s+(want to|would like to|am going to|will|gonna)\s+/i, '')
  text = text.replace(/^\s*i\s+/i, '')
  text = text.replace(/\s+/g, ' ').trim()
  if (!text) {
    return ''
  }
  const firstClause = text.split(/[.!?]/)[0].trim()
  const words = firstClause.split(/\s+/)
  if (words.length <= maxWords) {
    return firstClause
  }
  return `${words.slice(0, maxWords).join(' ')}...`
}

const extractKeywords = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2)
}

const extractLocationFromContext = (context?: string) => {
  if (!context) return 'Unknown location'
  const match = context.match(/location\s*:\s*([^\n]+)/i)
  if (match?.[1]) {
    return match[1].trim()
  }
  const firstLine = context.split('\n')[0].trim()
  return firstLine || 'Unknown location'
}

const buildCharacterKey = (campaignKey: string, characterInfo?: any) => {
  if (characterInfo?.id) {
    return String(characterInfo.id)
  }
  const name = String(characterInfo?.name || 'unknown').trim().toLowerCase()
  return `${campaignKey}:${name || 'unknown'}`
}

const ensureBackstoryArcForCharacter = async (payload: {
  characterKey: string
  characterInfo?: any
  backstory?: string
  currentTurn: number
}) => {
  if (!payload.backstory || !payload.backstory.trim()) {
    return null
  }
  const existing = getBackstoryArc(payload.characterKey)
  if (existing) {
    return existing
  }
  const generated = await generateBackstoryArcPlan({
    characterKey: payload.characterKey,
    name: payload.characterInfo?.name,
    className: payload.characterInfo?.class,
    backstory: payload.backstory,
    currentTurn: payload.currentTurn
  })
  const normalized = normalizeBackstoryArc(
    payload.characterKey,
    generated.profile,
    generated.plan,
    payload.currentTurn
  )
  saveBackstoryArc(payload.characterKey, normalized.profile, normalized.plan)
  console.log('Backstory arc generated:', payload.characterKey)
  return normalized
}

const buildBackstoryArcContext = async (payload: {
  characterKey: string
  characterInfo?: any
  backstory?: string
  currentTurn: number
}) => {
  const arcData = await ensureBackstoryArcForCharacter(payload)
  if (!arcData) {
    return null
  }
  const eligibleBeat = getEligibleBeat(arcData.plan, payload.currentTurn)
  if (!eligibleBeat) {
    return { profile: arcData.profile, plan: arcData.plan, eligibleBeat: null, currentTurn: payload.currentTurn }
  }
  const updatedPlan = markBeatUsed(arcData.plan, eligibleBeat, payload.currentTurn)
  saveBackstoryArc(payload.characterKey, arcData.profile, updatedPlan)
  console.log('Backstory beat surfaced:', payload.characterKey, eligibleBeat.id)
  return { profile: arcData.profile, plan: updatedPlan, eligibleBeat, currentTurn: payload.currentTurn }
}

const buildSceneState = (
  context?: string,
  participants?: Array<{ id?: string; name?: string }>
) => {
  const roster = Array.isArray(participants)
    ? Array.from(new Set(participants.map(entry => entry?.name).filter(Boolean)))
    : []
  return {
    location: extractLocationFromContext(context),
    roster,
    lastTransition: null
  }
}

const updateLastResolvedAction = (campaignKey: string, next: LastResolvedAction) => {
  gameStateByCampaign.set(campaignKey, { lastResolvedAction: next })
}

const violenceWords = [
  /\battack\b/i,
  /\bhit\b/i,
  /\bpunch\b/i,
  /\bkick\b/i,
  /\bstrike\b/i,
  /\bstab\b/i,
  /\bslash\b/i,
  /\bcut\b/i,
  /\bshoot\b/i,
  /\bkill\b/i,
  /\bchoke\b/i,
  /\bstrangle\b/i,
  /\bgrapple\b/i,
  /\bwrestle\b/i,
  /\btackle\b/i,
  /\bdisarm\b/i,
  /\btrip\b/i,
  /\bshove\b/i,
  /\bbrawl\b/i,
  /\bduel\b/i,
  /\bfight\b/i,
  /\bbash\b/i,
  /\bsmash\b/i
]

const stealthWords = [
  /\bsneak\b/i,
  /\bhide\b/i,
  /\bconceal\b/i,
  /\bshadow\b/i,
  /\bstalk\b/i,
  /\bfollow\s+quietly\b/i,
  /\bsteal\b/i,
  /\bpickpocket\b/i,
  /\bswipe\b/i,
  /\bsnatch\b/i,
  /\blockpick\b/i,
  /\bpick\s+the\s+lock\b/i,
  /\beavesdrop\b/i,
  /\bspy\b/i,
  /\bpeek\b/i,
  /\bscout\b/i,
  /\brecon\b/i,
  /\bslip\s+past\b/i,
  /\bavoid\s+notice\b/i,
  /\bcreep\b/i,
  /\bcrawl\b/i
]

const socialWords = [
  /\bpersuade\b/i,
  /\bconvince\b/i,
  /\bnegotiate\b/i,
  /\bbargain\b/i,
  /\bthreaten\b/i,
  /\bintimidate\b/i,
  /\blie\b/i,
  /\bbluff\b/i,
  /\bdeceive\b/i,
  /\btrick\b/i,
  /\bflatter\b/i,
  /\bcharm\b/i,
  /\bargue\b/i,
  /\breason\b/i,
  /\bprovoke\b/i,
  /\bcalm\b/i,
  /\breassure\b/i,
  /\binterrogate\b/i,
  /\bconfront\b/i,
  /\bmock\b/i,
  /\binsult\b/i,
  /\btaunt\b/i
]

const physicalWords = [
  /\bjump\b/i,
  /\bleap\b/i,
  /\bhop\b/i,
  /\bvault\b/i,
  /\bclimb\b/i,
  /\bscale\b/i,
  /\bbalance\b/i,
  /\brun\b/i,
  /\bsprint\b/i,
  /\bswim\b/i,
  /\bbackflip\b/i,
  /\bfrontflip\b/i,
  /\bflip\b/i,
  /\bsomersault\b/i,
  /\bcartwheel\b/i,
  /\broll\b/i,
  /\bdive\b/i,
  /\bslide\b/i,
  /\bpush\b/i,
  /\bpull\b/i,
  /\blift\b/i,
  /\bcarry\b/i,
  /\bthrow\b/i,
  /\bdrag\b/i,
  /\bbreak\b/i,
  /\bbend\b/i,
  /\bforce\b/i,
  /\bshoulder\s+bash\b/i,
  /\bsmash\b/i,
  /\bkick\b/i,
  /\bacrobat\b/i,
  /\bacrobatics\b/i,
  /\btumble\b/i,
  /\bparkour\b/i,
  /\bhold\s+on\b/i,
  /\bhang\b/i,
  /\bgrip\b/i,
  /\bgrab\b/i,
  /\bendure\b/i,
  /\bresist\b/i,
  /\bhold\s+breath\b/i
]

const hasAny = (text: string, patterns: RegExp[]) => patterns.some(pattern => pattern.test(text))

const detectTarget = (text: string, candidates?: Array<{ id?: string; name?: string }>): string | null => {
  if (Array.isArray(candidates) && candidates.length) {
    const lowered = text.toLowerCase()
    const matched = candidates.find(candidate => {
      const name = candidate.name?.toLowerCase()
      return name && lowered.includes(name)
    })
    if (matched?.id) {
      return matched.id
    }
    if (matched?.name) {
      return matched.name
    }
  }

  const roleMatch = text.match(/\bthe\s+(bartender|barkeep|innkeeper|guard|man|woman|stranger|soldier|bandit|thug)\b/i)
  if (roleMatch) {
    return roleMatch[1].toLowerCase()
  }

  return null
}

const resolveTargetLabel = (target: string | null, candidates?: Array<{ id?: string; name?: string }>) => {
  if (!target) return 'Enemy'
  if (Array.isArray(candidates)) {
    const matched = candidates.find(candidate => candidate.id === target || candidate.name === target)
    if (matched?.name) {
      return matched.name
    }
  }
  return target
}

const inferContextFlags = (context?: string) => {
  const lower = (context || '').toLowerCase()
  return {
    indoors: /\b(indoors|inside|room|hall|tavern|inn)\b/.test(lower),
    crowded: /\b(crowd|crowded|packed|busy)\b/.test(lower),
    armored: /\b(armored|armoured|armor|armour|plate|mail|chain)\b/.test(lower),
    targetHostile: /\b(hostile|enemy|bandit|thug|guard|soldier)\b/.test(lower)
  }
}

type PatternMatch = {
  name: string
  tag: ActionIntent['tags'][number]
  suggested_check: ActionIntent['suggested_check']
  stakes: ActionIntent['stakes']
  reason: string
  action?: ActionIntent['action']
  escalation_hint?: string
}

const makePattern = (name: string, patterns: RegExp[], match: Omit<PatternMatch, 'name'>): PatternMatch & { patterns: RegExp[] } => ({
  name,
  patterns,
  ...match
})

const PATTERN_LIBRARY = [
  makePattern('surrender_or_self_harm', [
    /\b(i\s*(give up|surrender|yield|quit|stop resisting))\b/i,
    /\b(just\s*kill me|let me die|i want to die|i die)\b/i,
    /\b(i don'?t want to fight|i won'?t fight|i stop resisting)\b/i
  ], {
    tag: 'social',
    suggested_check: 'none',
    stakes: 'medium',
    reason: 'surrender or refusal to act',
    action: 'talk'
  }),
  makePattern('explicit_attack', [
    /\b(i\s*)?attack\b/i,
    /\b(hit|punch|stab|slash|shoot|strike|kick)\b.*\b(him|her|you|bartender|barkeep|guard|man|woman|enemy|foe)\b/i,
    /\b(i\s*(swing|lunge|charge|rush|strike|draw and|raise))\b.*\b(weapon|sword|dagger|knife|axe|bow)\b/i
  ], {
    tag: 'violence',
    suggested_check: 'combat',
    stakes: 'medium',
    reason: 'explicit attack intent',
    action: 'attack'
  }),
  makePattern('coercion_threat', [
    /\bif\b.+\b(again|one more time|next time)\b.+\b(i'?ll|i will|i'?m gonna|i am going to)\b.+\b(kill|hurt|break|cut|gut|end|cripple|smash)\b/i,
    /\bone more\b.+\b(and|then)\b.+\b(i'?ll|i will|you'?re)\b.+\b(dead|done|finished|sorry|regret)\b/i,
    /\b(try|do|say)\b.+\b(again|one more time)\b.+\b(and)\b.+\b(i swear|i'?ll|i will)\b/i,
    /\b(back off|get away|don'?t move|don'?t touch|stay back)\b.+\b(or|else)\b.+\b(i'?ll|i will)\b/i,
    /\b(last warning|your last warning)\b/i,
    /\b(you'?ll regret|i'?ll make you regret)\b/i,
    /\b(i swear)\b.+\b(i'?ll|i will)\b.+\b(kill|hurt|break|cut|end)\b/i,
    /\b(touch me)\b.+\b(and)\b.+\b(you'?re|you are|i'?ll)\b.+\b(dead|done|finished|kill)\b/i,
    /\b(i'?m gonna|i am going to|i will)\b.+\b(kill|hurt|break|cut|end|cripple)\b/i
  ], {
    tag: 'social',
    suggested_check: 'contest',
    stakes: 'medium',
    reason: 'implicit threat or ultimatum',
    action: 'talk',
    escalation_hint: 'do_not_start_combat'
  }),
  makePattern('stealth_covert', [
    /\b(slip past|avoid notice|avoid being seen|don'?t get seen|stay unseen)\b/i,
    /\b(hide|conceal|blend in|duck behind|stay low)\b/i,
    /\b(follow|shadow|tail|stalk)\b.+\b(quietly|unseen|from a distance)\b/i,
    /\b(pickpocket|swipe|snatch|lift)\b/i,
    /\b(take)\b.+\b(without (him|her|them) noticing|unnoticed)\b/i,
    /\b(pick the lock|lockpick|tamper with the lock)\b/i
  ], {
    tag: 'stealth',
    suggested_check: 'contest',
    stakes: 'medium',
    reason: 'covert action',
    action: 'attempt'
  }),
  makePattern('social_deception', [
    /\b(pretend|act like|play the part|fake)\b/i,
    /\b(fake name|false name|make up|invent)\b.+\b(story|excuse|reason)\b/i,
    /\b(distract)\b.+\b(with talk|with conversation|by talking)\b/i
  ], {
    tag: 'social',
    suggested_check: 'contest',
    stakes: 'medium',
    reason: 'deception or manipulation',
    action: 'talk'
  }),
  makePattern('social_persuasion', [
    /\b(convince|talk (him|her|them) into|persuade)\b/i,
    /\b(negotiate|bargain|offer|deal)\b/i,
    /\b(calm down|let'?s talk|we don'?t have to fight|stand down)\b/i
  ], {
    tag: 'social',
    suggested_check: 'contest',
    stakes: 'low',
    reason: 'persuasion or negotiation',
    action: 'talk'
  }),
  makePattern('physical_stunt', [
    /\b(flip|back ?flip|front ?flip|somersault|cartwheel|vault)\b/i,
    /\b(balance|tightrope|beam|ledge)\b/i,
    /\b(across)\b.+\b(beam|ledge|railing)\b/i,
    /\b(kick)\b.+\b(door)\b/i,
    /\b(break|force)\b.+\b(door|lock|bar|chain)\b/i
  ], {
    tag: 'physical',
    suggested_check: 'skill',
    stakes: 'medium',
    reason: 'physical stunt or force',
    action: 'attempt'
  })
]

const matchPatternLibrary = (text: string): PatternMatch | null => {
  for (const entry of PATTERN_LIBRARY) {
    if (entry.patterns.some(pattern => pattern.test(text))) {
      return {
        name: entry.name,
        tag: entry.tag,
        suggested_check: entry.suggested_check,
        stakes: entry.stakes,
        reason: entry.reason,
        action: entry.action,
        escalation_hint: entry.escalation_hint
      }
    }
  }
  return null
}

const classifyIntent = (
  text: string,
  options: { selectedTarget?: string | null; sceneParticipants?: Array<{ id?: string; name?: string }>; gameContext?: string } = {}
): ActionIntent => {
  const normalized = normalizeInput(text)
  const attemptLead = TRY_PATTERN.test(normalized)
  const hasPersonTarget = PERSON_TARGET_PATTERN.test(normalized)
  const hasFireWeapon = /\bfire\b/.test(normalized) && /\b(bow|gun|weapon|arrow|bolt|pistol|rifle)\b/.test(normalized)
  const hasThrowAtPerson = /\bthrow\b/.test(normalized) && /\b(at|into|toward)\b/.test(normalized) && hasPersonTarget

  const target = options.selectedTarget || detectTarget(text, options.sceneParticipants)
  const contextFlags = inferContextFlags(options.gameContext)

  const patternMatch = matchPatternLibrary(normalized)
  if (patternMatch) {
    const hasPretendCue = /\b(pretend|act like|play the part|fake)\b/i.test(normalized)
    const baseAction =
      patternMatch.action ||
      (patternMatch.tag === 'violence' ? 'attack' : patternMatch.tag === 'social' ? 'talk' : 'attempt')
    const action = patternMatch.name === 'social_deception' && hasPretendCue ? 'attempt' : baseAction
    const finalAction = attemptLead && action === 'talk' ? 'attempt' : action
    const elevatedStakes = /\b(kill|strangle|choke|gut|cripple)\b/i.test(normalized) ? 'high' : patternMatch.stakes
    return {
      action: finalAction,
      target: target || null,
      tags: [patternMatch.tag],
      stakes: elevatedStakes,
      suggested_check: patternMatch.suggested_check,
      reason: `${patternMatch.name}: ${patternMatch.reason}`
    }
  }

  const violenceMatch =
    hasAny(normalized, violenceWords) ||
    hasFireWeapon ||
    hasThrowAtPerson ||
    (/\bkick\b/.test(normalized) && hasPersonTarget) ||
    (/\bsmash\b/.test(normalized) && hasPersonTarget)

  const stealthMatch = hasAny(normalized, stealthWords)
  const socialMatch = hasAny(normalized, socialWords)
  const physicalMatch =
    hasAny(normalized, physicalWords) ||
    (/\bkick\b/.test(normalized) && !hasPersonTarget) ||
    (/\bsmash\b/.test(normalized) && !hasPersonTarget) ||
    (/\bthrow\b/.test(normalized) && !hasThrowAtPerson)

  if (violenceMatch) {
    const stakes = /\b(kill|strangle|choke)\b/i.test(normalized) ? 'high' : 'medium'
    return {
      action: 'attack',
      target: target || null,
      tags: ['violence'],
      stakes,
      suggested_check: 'combat',
      reason: 'hostile action'
    }
  }
  if (stealthMatch) {
    return {
      action: 'attempt',
      target: target || null,
      tags: ['stealth'],
      stakes: contextFlags.targetHostile ? 'medium' : 'low',
      suggested_check: 'contest',
      reason: 'stealth action'
    }
  }
  if (socialMatch) {
    return {
      action: attemptLead ? 'attempt' : 'talk',
      target: target || null,
      tags: ['social'],
      stakes: /\b(threaten|intimidate)\b/i.test(normalized) ? 'medium' : 'low',
      suggested_check: 'contest',
      reason: 'social pressure'
    }
  }
  if (physicalMatch) {
    return {
      action: 'attempt',
      target: target || null,
      tags: ['physical'],
      stakes: contextFlags.indoors || contextFlags.crowded || contextFlags.armored ? 'medium' : 'low',
      suggested_check: 'skill',
      reason: 'physical strain'
    }
  }

  if (attemptLead) {
    return {
      action: 'attempt',
      target: target || null,
      tags: ['physical'],
      stakes: 'medium',
      suggested_check: 'skill',
      reason: 'attempted action'
    }
  }

  return {
    action: 'talk',
    target: target || null,
    tags: [],
    stakes: 'low',
    suggested_check: 'none',
    reason: 'safe interaction'
  }
}

const resolveCheck = (intent: ActionIntent, rawText: string, gameContext?: string): PendingCheck | null => {
  if (intent.suggested_check === 'none' || intent.suggested_check === 'combat') {
    return null
  }

  const baseContext = rawText.length > 120 ? `${rawText.slice(0, 120)}...` : rawText
  const summaryContext = summarizeActionText(rawText)

  if (intent.tags.includes('stealth')) {
    const isLockpick = /\blockpick\b|\bpick\s+the\s+lock\b/i.test(rawText)
    return {
      id: generateCheckId(),
      type: 'contest',
      actor: 'player',
      target: intent.target ?? 'npc',
      stat: 'DEX',
      difficulty: intent.target ? 'opposed' : 13,
      context: summaryContext || baseContext || (isLockpick ? 'pick the lock' : 'slip past unnoticed'),
      reason: isLockpick ? 'lockpick' : 'stealth'
    }
  }

  if (intent.tags.includes('social')) {
    return {
      id: generateCheckId(),
      type: 'contest',
      actor: 'player',
      target: intent.target ?? 'npc',
      stat: 'CHA',
      difficulty: intent.target ? 'opposed' : 13,
      context: summaryContext || baseContext || 'pressure the target',
      reason: 'social'
    }
  }

  if (intent.tags.includes('physical')) {
    const isStunt = /\b(backflip|frontflip|flip|somersault|cartwheel|vault|balance|tumble|acrobatics|parkour|climb|jump|leap|dive|slide|roll)\b/i.test(rawText)
    const isForce = /\b(break|force|push|pull|lift|carry|drag|bend|shoulder\s+bash|smash|kick)\b/i.test(rawText)
    const isEndure = /\b(endure|resist|hold\s+breath)\b/i.test(rawText)
    const contextFlags = inferContextFlags(gameContext)

    return {
      id: generateCheckId(),
      type: isEndure ? 'save' : 'skill',
      actor: 'player',
      target: intent.target ?? null,
      stat: isEndure ? 'CON' : isStunt ? 'DEX' : 'STR',
      difficulty: contextFlags.indoors || contextFlags.crowded || contextFlags.armored ? 13 : 12,
      context: summaryContext || baseContext || (isEndure ? 'endure the strain' : isStunt ? 'pull off the stunt' : 'force the obstacle'),
      reason: isEndure ? 'endurance' : isStunt ? 'stunt' : 'physical force'
    }
  }

  return null
}

const inferCombatProfile = (rawText: string) => {
  const normalized = normalizeInput(rawText)
  if (/\b(cast|spell|incant|hex|magic|firebolt|ray|blast)\b/i.test(normalized)) {
    return { stat: 'INT' as const, label: 'Spell Attack', actionType: 'spell' }
  }
  if (/\b(grapple|wrestle|tackle|choke|strangle|trip|shove)\b/i.test(normalized)) {
    return { stat: 'STR' as const, label: 'Grapple', actionType: 'grapple' }
  }
  if (/\b(shoot|fire|bow|arrow|bolt|crossbow|rifle|pistol|throw)\b/i.test(normalized)) {
    return { stat: 'DEX' as const, label: 'Ranged Attack', actionType: 'ranged' }
  }
  return { stat: 'STR' as const, label: 'Melee Attack', actionType: 'melee' }
}

const buildCombatCheck = (
  intent: ActionIntent,
  rawText: string,
  sceneParticipants?: Array<{ id?: string; name?: string }>
): PendingCheck => {
  const profile = inferCombatProfile(rawText)
  return {
    id: generateCheckId(),
    type: 'attack',
    actor: 'player',
    target: intent.target ?? null,
    targetLabel: resolveTargetLabel(intent.target, sceneParticipants),
    stat: profile.stat,
    difficulty: 10,
    context: profile.label,
    reason: profile.actionType,
    intent: {
      action: intent.action,
      tags: intent.tags,
      target: intent.target
    }
  }
}

const buildDecisionCheck = (params: {
  decision: any
  target: string | null
  rawText: string
  sceneParticipants?: Array<{ id?: string; name?: string }>
}): PendingCheck | null => {
  const { decision, target, rawText, sceneParticipants } = params
  const domain = String(decision.domain || '').toLowerCase()
  const intentType = decision.intentType || 'UNKNOWN'
  const statValue = (decision.stat || '').toUpperCase()
  const stat =
    statValue === 'STR' || statValue === 'DEX' || statValue === 'CON' || statValue === 'INT' || statValue === 'WIS' || statValue === 'CHA'
      ? statValue
      : null
  const actionLabel = String(decision.actionLabel || '').trim()

  if (domain === 'violence') {
    const intent: ActionIntent = {
      action: 'attack',
      target,
      tags: ['violence'],
      stakes: 'medium',
      suggested_check: 'combat',
      reason: 'violence intent'
    }
    const combatCheck = buildCombatCheck(intent, rawText, sceneParticipants)
    return {
      ...combatCheck,
      context: actionLabel || combatCheck.context,
      actionLabel,
      domain,
      skill: decision.skill ?? null,
      intentType
    }
  }

  if (!stat) {
    return null
  }

  const dcValue = Number.isFinite(decision.dc) ? Number(decision.dc) : null
  if (domain === 'social' || domain === 'stealth') {
    return {
      id: generateCheckId(),
      type: 'contest',
      actor: 'player',
      target: target ?? 'npc',
      stat,
      difficulty: dcValue ?? 13,
      context: actionLabel || summarizeActionText(rawText) || 'pressure the target',
      reason: domain,
      actionLabel,
      domain,
      skill: decision.skill ?? null,
      intentType
    }
  }

  const checkType = stat === 'CON' ? 'save' : 'skill'
  return {
    id: generateCheckId(),
    type: checkType,
    actor: 'player',
    target,
    stat,
    difficulty: dcValue ?? 12,
    context: actionLabel || summarizeActionText(rawText) || 'overcome the challenge',
    reason: domain || 'physical',
    actionLabel,
    domain: domain || 'physical',
    skill: decision.skill ?? null,
    intentType
  }
}

const stripOutcomeWithoutCheck = (text: string): { cleaned: string; removed: boolean } => {
  if (!text) {
    return { cleaned: text, removed: false }
  }
  const outcomePatterns = [
    /\b(hit|hits|strikes|smashes|breaks|cracks|slashes|stabs|cuts)\b/i,
    /\b(disarm|disarms|knock(?:s|ed)?\s+away)\b/i,
    /\b(bleed|blood|wound|injur(?:y|ies))\b/i,
    /\b(falls|collapses|drops)\b/i,
    /\b(grapple|grapples|pinned|restrained)\b/i,
    /\b(damage|harm)\b/i,
    /\byou\s+(succeed|fail)\b/i,
    /\blands?\s+awkwardly\b/i,
    /\bconnects?\b/i,
    /\bknocks?\s+you\s+out\b/i
  ]

  const sentences = text.split(/(?<=[.!?])\s+/)
  let removed = false
  const kept = sentences.filter(sentence => {
    if (outcomePatterns.some(pattern => pattern.test(sentence))) {
      removed = true
      return false
    }
    return true
  })

  const cleaned = kept.join(' ').trim()
  return { cleaned, removed }
}

// Get DM response for player action
router.post('/dm-response', async (req, res) => {
  try {
    const {
      playerAction,
      characterInfo,
      gameContext,
      history,
      campaignId,
      rollResult,
      pendingCheckId,
      selectedTarget,
      sceneParticipants,
      playerSnapshot
    } = req.body

    if (!playerAction || typeof playerAction !== 'string') {
      return res.status(400).json({ error: 'Player action is required' })
    }

    const historyMessages: ChatCompletionMessage[] = Array.isArray(history)
      ? history
          .map((entry: any) => {
            if (
              !entry ||
              typeof entry.content !== 'string' ||
              !entry.content.trim() ||
              (entry.role !== 'user' && entry.role !== 'assistant' && entry.role !== 'system')
            ) {
              return null
            }
            return {
              role: entry.role,
              content: entry.content
            } as ChatCompletionMessage
          })
          .filter((entry): entry is ChatCompletionMessage => Boolean(entry))
      : []

    const campaignKey = campaignId || 'default'
    const gameState = gameStateByCampaign.get(campaignKey) || { lastResolvedAction: null, turnIndex: 0 }
    const currentTurn = (gameState.turnIndex || 0) + 1
    gameStateByCampaign.set(campaignKey, { ...gameState, turnIndex: currentTurn })
    const sceneState = buildSceneState(gameContext || '', sceneParticipants)

    if (rollResult && pendingCheckId) {
      const pending = pendingChecks.get(campaignKey)
      if (pending && pending.id === pendingCheckId) {
        pendingChecks.delete(campaignKey)
        console.log('Pending check cleared:', pending.id)

        if (pending.type === 'attack') {
          let battleState = getBattle(campaignKey)
          if (!battleState) {
            const baseHp = typeof playerSnapshot?.hp === 'number' ? playerSnapshot.hp : 20
            const baseMp = typeof playerSnapshot?.mp === 'number' ? playerSnapshot.mp : 0
            const playerEntity: CombatEntity = {
              id: 'player',
              type: 'player',
              name: characterInfo?.name || 'Player',
              hp: baseHp,
              hp_max: baseHp,
              mp: baseMp,
              mp_max: baseMp,
              statuses: []
            }
            const enemyName = pending.targetLabel || 'Enemy'
            const enemyEntity: CombatEntity = {
              id: 'enemy-0',
              type: 'enemy',
              name: enemyName,
              hp: 12,
              hp_max: 12,
              statuses: []
            }
            battleState = startBattle(campaignKey, playerEntity, [enemyEntity])
          }

          let targetId = pending.target || null
          if (!targetId || !battleState.entities.find(entity => entity.id === targetId)) {
            const fallback = battleState.entities.find(entity => entity.type === 'enemy' && entity.hp > 0)
            targetId = fallback?.id || null
          }

          const rollTotal = rollResult.total ?? rollResult.result ?? 0
          const rollD20 = typeof rollResult.d20 === 'number' ? rollResult.d20 : undefined
          const rollBonus =
            typeof rollResult.bonus === 'number'
              ? rollResult.bonus
              : typeof rollD20 === 'number'
                ? rollTotal - rollD20
                : 0

          const resolved = resolveAction(
            campaignKey,
            {
              action: 'attack',
              actor: 'player',
              target: targetId,
              params: { action_type: pending.reason, label: pending.context }
            },
            playerSnapshot,
            {
              attackRoll: typeof rollD20 === 'number'
                ? {
                    d20: rollD20,
                    bonus: rollBonus,
                    total: rollTotal
                  }
                : undefined
            }
          )

          const narration = await generateCombatNarration(
            resolved.state,
            resolved.events,
            `Player action: ${playerAction}`
          )

          if (pending.actionLabel || pending.context) {
            const label = pending.actionLabel || pending.context
            updateLastResolvedAction(campaignKey, {
              summary: label,
              domain: pending.domain || 'violence',
              stat: pending.stat || null,
              skill: pending.skill ?? null,
              timestamp: Date.now(),
              keywords: extractKeywords(label)
            })
          }

          return res.json({
            response: narration,
            battle: resolved.state,
            events: resolved.events,
            ui: { showRoll: false },
            pending_check: null
          })
        }

        const intentDetails = pending.intent
          ? `Intent tags: ${pending.intent.tags.join(', ')}. Target: ${pending.intent.target || 'none'}.`
          : ''
        const rollTotal = rollResult.total ?? rollResult.result
        const rollMath =
          typeof rollResult.d20 === 'number'
            ? `d20 ${rollResult.d20} + ${rollResult.bonus ?? 0} = ${rollTotal}`
            : `${rollTotal}`
        const dcText = typeof rollResult.dc === 'number' ? ` vs DC ${rollResult.dc}` : ''
        const outcomeLabel = rollResult.label || pending.context
        const followUp = `Player action: ${playerAction}. ${intentDetails}
Outcome data: ${outcomeLabel} => ${rollMath}${dcText} (OUTCOME=${rollResult.success ? 'SUCCESS' : 'FAIL'}).
Start from the outcome and world reaction. Describe ONLY the new consequences of this result. Do NOT restate the player's prior action or any preparation. Stay strictly diegetic. Do NOT mention rolls, numbers, or mechanics in narration.`

        const characterKey = buildCharacterKey(campaignKey, characterInfo)
        const backstoryArcContext = await buildBackstoryArcContext({
          characterKey,
          characterInfo,
          backstory: characterInfo?.backstory,
          currentTurn
        })

        console.log('Generating DM response for roll outcome:', pending.id)
        const dmResponse = await generateDMResponse(
          followUp,
          characterInfo || {},
          gameContext || '',
          historyMessages,
          sceneState,
          backstoryArcContext || undefined
        )

        if (pending.actionLabel || pending.context) {
          const label = pending.actionLabel || pending.context
          updateLastResolvedAction(campaignKey, {
            summary: label,
            domain: pending.domain || 'other',
            stat: pending.stat || null,
            skill: pending.skill ?? null,
            timestamp: Date.now(),
            keywords: extractKeywords(label)
          })
        }

        console.log('DM response generated successfully, length:', dmResponse.response.length)
        const npcRegistry = listNPCProfiles().map(npc => ({
          id: npc.id,
          name: npc.name,
          dialogueColorId: npc.dialogueColorId
        }))
        const npcPalette = listNPCDialoguePalette()
        return res.json({
          ...dmResponse,
          ui: { showRoll: false },
          pending_check: null,
          npcRegistry,
          npcPalette
        })
      }
    }

    const segments = annotateSegments(segmentMessage(playerAction), gameState.lastResolvedAction || null)

    let decision: any = null
    try {
      decision = await generateIntentDecision({
        rawText: playerAction,
        segments,
        lastResolvedAction: gameState.lastResolvedAction || null,
        sceneContext: null
      })
      console.log('Intent decision:', {
        intentType: decision.intentType,
        domain: decision.domain,
        shouldRoll: decision.shouldRoll,
        actionLabel: decision.actionLabel
      })
    } catch (error: any) {
      console.error('Intent decision failed, using fallback:', error?.message || error)
    }

    const fallbackIntent = classifyIntent(playerAction, {
      selectedTarget,
      sceneParticipants,
      gameContext
    })

    if (!decision) {
      const primarySegment =
        segments.find(segment => segment.hint === 'REQUEST') ||
        segments.find(segment => segment.hint === 'ACTION_NOW') ||
        segments.find(segment => segment.hint !== 'PAST_REF') ||
        segments[0]
      const resolvedCheck = resolveCheck(fallbackIntent, playerAction, gameContext)
      decision = {
        primarySegmentId: primarySegment?.id || 'seg-1',
        intentType: primarySegment?.hint || 'UNKNOWN',
        domain: fallbackIntent.tags[0] || (fallbackIntent.action === 'attack' ? 'violence' : 'other'),
        shouldRoll: Boolean(resolvedCheck) && primarySegment?.hint === 'ACTION_NOW',
        stat: resolvedCheck?.stat || null,
        skill: null,
        dc: typeof resolvedCheck?.difficulty === 'number' ? resolvedCheck.difficulty : null,
        actionLabel: summarizeActionText(primarySegment?.text || playerAction) || summarizeActionText(playerAction),
        narration: ''
      }
    }

    const target = selectedTarget || detectTarget(playerAction, sceneParticipants)
    const pendingCheck = decision.shouldRoll
      ? buildDecisionCheck({
          decision,
          target,
          rawText: playerAction,
          sceneParticipants
        })
      : null

    const activeBattle = getBattle(campaignKey)
    if (pendingCheck?.type === 'attack' && !activeBattle) {
      const playerEntity: CombatEntity = {
        id: 'player',
        type: 'player',
        name: characterInfo?.name || 'Player',
        hp: 20,
        hp_max: 20,
        mp: 0,
        mp_max: 0,
        statuses: []
      }
      const enemyName = pendingCheck.targetLabel || 'Enemy'
      const enemyEntity: CombatEntity = {
        id: 'enemy-0',
        type: 'enemy',
        name: enemyName,
        hp: 12,
        hp_max: 12,
        statuses: []
      }
      startBattle(campaignKey, playerEntity, [enemyEntity])
      console.log('Combat state created for narrative resolution.')
    }

    if (pendingCheck) {
      pendingChecks.set(campaignKey, {
        ...pendingCheck,
        intent: {
          action: fallbackIntent.action,
          tags: fallbackIntent.tags,
          target: fallbackIntent.target
        }
      })
      console.log('Pending check created:', pendingCheck)
      console.log('Check details:', {
        id: pendingCheck.id,
        type: pendingCheck.type,
        stat: pendingCheck.stat,
        difficulty: pendingCheck.difficulty,
        context: pendingCheck.context
      })
    }

    if (pendingCheck) {
      console.log('Skipping DM call until check/combat result is resolved.')
      return res.json({
        response: '',
        requiresRoll: true,
        pending_check: pendingCheck,
        ui: { showRoll: true },
        checkRequest: {
          id: pendingCheck.id,
          type: pendingCheck.type,
          actor: pendingCheck.actor,
          stat: pendingCheck.stat,
          difficulty:
            typeof pendingCheck.difficulty === 'number'
              ? String(pendingCheck.difficulty)
              : pendingCheck.difficulty,
          context: pendingCheck.context,
          on_success: 'resolve',
          on_failure: 'resolve'
        }
      })
    }

    if (decision && decision.shouldRoll === false && decision.intentType !== 'PAST_REF' && decision.intentType !== 'SPEECH') {
      const actionLabel = String(decision.actionLabel || '').trim()
      if (actionLabel) {
        updateLastResolvedAction(campaignKey, {
          summary: actionLabel,
          domain: decision.domain || 'other',
          stat: decision.stat || null,
          skill: decision.skill ?? null,
          timestamp: Date.now(),
          keywords: extractKeywords(actionLabel)
        })
      }
    }

    const characterKey = buildCharacterKey(campaignKey, characterInfo)
    const backstoryArcContext = await buildBackstoryArcContext({
      characterKey,
      characterInfo,
      backstory: characterInfo?.backstory,
      currentTurn
    })

    console.log('Generating DM response for action:', playerAction.substring(0, 100))
    const dmResponse = await generateDMResponse(
      playerAction,
      characterInfo || {},
      gameContext || '',
      historyMessages,
      sceneState,
      backstoryArcContext || undefined
    )

    const responseText = dmResponse.response

    console.log('DM response generated successfully, length:', responseText.length)
    const npcRegistry = listNPCProfiles().map(npc => ({
      id: npc.id,
      name: npc.name,
      dialogueColorId: npc.dialogueColorId
    }))
    const npcPalette = listNPCDialoguePalette()
    res.json({
      ...dmResponse,
      response: responseText,
      requiresRoll: false,
      checkRequest: null,
      pending_check: null,
      ui: { showRoll: false },
      npcRegistry,
      npcPalette
    })
  } catch (error: any) {
    console.error('Error generating DM response:', error)
    console.error('Error stack:', error?.stack)
    const errorMessage = error?.message || 'Failed to generate DM response'
    res.status(500).json({ 
      error: errorMessage,
      details: error?.message || 'Unknown error occurred'
    })
  }
})

// Summarize scene context to reduce history
router.post('/summarize-scene', async (req, res) => {
  try {
    const { history } = req.body

    const historyMessages: ChatCompletionMessage[] = Array.isArray(history)
      ? history
          .map((entry: any) => {
            if (
              !entry ||
              typeof entry.content !== 'string' ||
              !entry.content.trim() ||
              (entry.role !== 'user' && entry.role !== 'assistant' && entry.role !== 'system')
            ) {
              return null
            }
            return {
              role: entry.role,
              content: entry.content
            } as ChatCompletionMessage
          })
          .filter((entry): entry is ChatCompletionMessage => Boolean(entry))
      : []

    if (!historyMessages.length) {
      return res.status(400).json({ error: 'History is required to summarize' })
    }

    const summary = await generateSceneSummary(historyMessages)
    res.json({ summary })
  } catch (error: any) {
    console.error('Error generating scene summary:', error)
    const errorMessage = error?.message || 'Failed to summarize scene'
    res.status(500).json({
      error: errorMessage,
      details: error?.message || 'Unknown error occurred'
    })
  }
})

// Generate status updates from recent scene context
router.post('/status-update', async (req, res) => {
  try {
    const { history, statusState } = req.body

    const historyMessages: ChatCompletionMessage[] = Array.isArray(history)
      ? history
          .map((entry: any) => {
            if (
              !entry ||
              typeof entry.content !== 'string' ||
              !entry.content.trim() ||
              (entry.role !== 'user' && entry.role !== 'assistant' && entry.role !== 'system')
            ) {
              return null
            }
            return {
              role: entry.role,
              content: entry.content
            } as ChatCompletionMessage
          })
          .filter((entry): entry is ChatCompletionMessage => Boolean(entry))
      : []

    if (!historyMessages.length) {
      return res.status(400).json({ error: 'History is required to evaluate status' })
    }

    const normalizedStatusState =
      statusState && typeof statusState === 'object'
        ? statusState
        : { active_statuses: [] }

    const update = await generateStatusUpdate(historyMessages, normalizedStatusState)
    res.json(update)
  } catch (error: any) {
    console.error('Error generating status update:', error)
    const errorMessage = error?.message || 'Failed to generate status update'
    res.status(500).json({
      error: errorMessage,
      details: error?.message || 'Unknown error occurred'
    })
  }
})

// Generate a tailored quest from backstory
router.post('/generate-quest', async (req, res) => {
  try {
    const { backstory, characterName, characterClass } = req.body

    if (!backstory || typeof backstory !== 'string') {
      return res.status(400).json({ error: 'Backstory is required to generate a quest' })
    }

    const quest = await generateQuestFromBackstory(backstory, {
      name: characterName,
      className: characterClass
    })

    res.json(quest)
  } catch (error: any) {
    console.error('Error generating quest from backstory:', error)
    res.status(500).json({
      error: error?.message || 'Failed to generate quest',
      details: 'Check backend logs for more information'
    })
  }
})

// Summarize character backstory into key moments
router.post('/summarize-backstory', async (req, res) => {
  try {
    const { backstory } = req.body

    if (!backstory || typeof backstory !== 'string') {
      return res.status(400).json({ error: 'Backstory is required' })
    }

    const summary = await generateBackstorySummary(backstory)
    res.json({ summary })
  } catch (error: any) {
    console.error('Error generating backstory summary:', error)
    res.status(500).json({
      error: error?.message || 'Failed to summarize backstory',
      details: 'Check backend logs for more information'
    })
  }
})

export default router

