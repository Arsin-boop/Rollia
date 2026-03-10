import fs from 'fs'
import path from 'path'
import { eq } from 'drizzle-orm'
import { db } from '../db/db.js'
import { backstoryArcs } from '../db/schema.js'

export type BackstoryProfile = {
  characterKey: string
  origin: string
  keyEvent: string
  unresolvedConflict: string
  antagonisticForce: string
  witnesses: string[]
  debts: string[]
  artifactsOrMarks: string[]
  emotionalCore: string
  secrecyRules: string[]
  hookTags: string[]
}

export type BackstoryBeat = {
  id: string
  type: 'echo' | 'trace' | 'pressure' | 'revelation' | 'vector' | 'choice' | 'consequence'
  goal: string
  deliveryModes: Array<
    | 'rumor'
    | 'npc'
    | 'letter'
    | 'seal'
    | 'wantedPoster'
    | 'dream'
    | 'artifactReaction'
    | 'patrol'
    | 'bounty'
    | 'coincidence'
  >
  constraints: {
    minTurnsGap: number
    minScenesGap?: number
    maxRevealLevel: 'hint' | 'partial' | 'explicit'
  }
  triggerHints: {
    locationType?: string[]
    npcArchetype?: string[]
    factionPressure?: string[]
    itemUsed?: string[]
    reputationBand?: string[]
  }
  payload: {
    keyNames?: string[]
    symbols?: string[]
    phrases?: string[]
    objects?: string[]
    summary?: string
  }
  used: boolean
  usedAt?: number
}

export type BackstoryArcPlan = {
  characterKey: string
  beats: BackstoryBeat[]
  currentBeatIndex: number
  pressureLevel: number
  lastBeatAt?: number
  nextEligibleAfter: number
  revealedFacts: string[]
  status: 'active' | 'resolved' | 'dormant'
}

const arcStore = new Map<string, { profile: BackstoryProfile; plan: BackstoryArcPlan }>()

const loadStore = () => {
  try {
    const rows = db.select().from(backstoryArcs).all()
    rows.forEach(row => {
      try {
        const profile = JSON.parse(row.profileJson) as BackstoryProfile
        const plan = JSON.parse(row.planJson) as BackstoryArcPlan
        if (profile?.characterKey && plan?.characterKey) {
          arcStore.set(row.characterKey, { profile, plan })
        }
      } catch {
        // Ignore malformed rows
      }
    })
  } catch (error) {
    console.error('Failed to load backstory arc store:', error)
  }
}

const migrateLegacyBackstoryArcs = () => {
  try {
    const legacyPath = path.join(process.cwd(), 'data', 'backstory_arcs.json')
    if (!fs.existsSync(legacyPath)) return
    const raw = fs.readFileSync(legacyPath, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, { profile: BackstoryProfile; plan: BackstoryArcPlan }>
    if (!parsed || typeof parsed !== 'object') return

    Object.entries(parsed).forEach(([characterKey, payload]) => {
      if (!characterKey || !payload?.profile || !payload?.plan) return
      const existing = db
        .select()
        .from(backstoryArcs)
        .where(eq(backstoryArcs.characterKey, characterKey))
        .all()
      if (existing.length) return

      db.insert(backstoryArcs)
        .values({
          characterKey,
          profileJson: JSON.stringify(payload.profile),
          planJson: JSON.stringify(payload.plan),
          updatedAt: Date.now()
        })
        .run()
    })
  } catch (error) {
    console.error('Failed to migrate legacy backstory_arcs.json:', error)
  }
}

const hashString = (value: string): number => {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const pickGap = (seed: string, min = 4, max = 10) => {
  const range = Math.max(1, max - min + 1)
  return min + (hashString(seed) % range)
}

export const getBackstoryArc = (characterKey: string) => {
  return arcStore.get(characterKey) || null
}

export const saveBackstoryArc = (
  characterKey: string,
  profile: BackstoryProfile,
  plan: BackstoryArcPlan
) => {
  arcStore.set(characterKey, { profile, plan })
  try {
    db.insert(backstoryArcs)
      .values({
        characterKey,
        profileJson: JSON.stringify(profile),
        planJson: JSON.stringify(plan),
        updatedAt: Date.now()
      })
      .onConflictDoUpdate({
        target: backstoryArcs.characterKey,
        set: {
          profileJson: JSON.stringify(profile),
          planJson: JSON.stringify(plan),
          updatedAt: Date.now()
        }
      })
      .run()
  } catch (error) {
    console.error('Failed to persist backstory arc:', error)
  }
}

export const normalizeBackstoryArc = (
  characterKey: string,
  profile: Partial<BackstoryProfile>,
  plan: Partial<BackstoryArcPlan>,
  currentTurn: number
): { profile: BackstoryProfile; plan: BackstoryArcPlan } => {
  const normalizedProfile: BackstoryProfile = {
    characterKey,
    origin: profile.origin || 'unknown',
    keyEvent: profile.keyEvent || 'unknown',
    unresolvedConflict: profile.unresolvedConflict || 'unknown',
    antagonisticForce: profile.antagonisticForce || 'unknown',
    witnesses: profile.witnesses || [],
    debts: profile.debts || [],
    artifactsOrMarks: profile.artifactsOrMarks || [],
    emotionalCore: profile.emotionalCore || 'unknown',
    secrecyRules: profile.secrecyRules || [],
    hookTags: profile.hookTags || []
  }

  const rawBeats = Array.isArray(plan.beats) ? plan.beats : []
  const normalizedBeats: BackstoryBeat[] = rawBeats.map((beat, index) => ({
    id: beat.id || `${characterKey}-beat-${index + 1}`,
    type: beat.type || 'echo',
    goal: beat.goal || 'surface a backstory echo',
    deliveryModes: beat.deliveryModes?.length ? beat.deliveryModes : ['rumor'],
    constraints: {
      minTurnsGap: beat.constraints?.minTurnsGap ?? pickGap(`${characterKey}-${index}`),
      minScenesGap: beat.constraints?.minScenesGap,
      maxRevealLevel: beat.constraints?.maxRevealLevel || 'hint'
    },
    triggerHints: beat.triggerHints || {},
    payload: beat.payload || {},
    used: Boolean(beat.used),
    usedAt: beat.usedAt
  }))

  const baseGap = 3 + (hashString(characterKey) % 4)
  const normalizedPlan: BackstoryArcPlan = {
    characterKey,
    beats: normalizedBeats,
    currentBeatIndex: plan.currentBeatIndex ?? 0,
    pressureLevel: plan.pressureLevel ?? 10,
    lastBeatAt: plan.lastBeatAt,
    nextEligibleAfter: plan.nextEligibleAfter ?? currentTurn + baseGap,
    revealedFacts: plan.revealedFacts || [],
    status: plan.status || 'active'
  }

  return { profile: normalizedProfile, plan: normalizedPlan }
}

export const getEligibleBeat = (plan: BackstoryArcPlan, currentTurn: number) => {
  if (plan.status !== 'active') {
    return null
  }
  if (currentTurn < plan.nextEligibleAfter) {
    return null
  }

  const beats = plan.beats
  let index = Math.max(0, plan.currentBeatIndex)
  while (index < beats.length && beats[index]?.used) {
    index += 1
  }
  if (!beats[index]) {
    return null
  }
  return beats[index]
}

export const markBeatUsed = (
  plan: BackstoryArcPlan,
  beat: BackstoryBeat,
  currentTurn: number
) => {
  const beatIndex = plan.beats.findIndex(entry => entry.id === beat.id)
  if (beatIndex === -1) {
    return plan
  }
  const updatedBeats = plan.beats.map(entry =>
    entry.id === beat.id ? { ...entry, used: true, usedAt: currentTurn } : entry
  )
  const nextBeat = updatedBeats.find(entry => !entry.used)
  const nextGap = nextBeat?.constraints?.minTurnsGap ?? 5
  const nextEligibleAfter = currentTurn + Math.max(1, nextGap)
  const revealedFacts = [...plan.revealedFacts]
  if (beat.payload?.summary) {
    revealedFacts.push(beat.payload.summary)
  } else if (beat.goal) {
    revealedFacts.push(beat.goal)
  }
  return {
    ...plan,
    beats: updatedBeats,
    currentBeatIndex: Math.min(beatIndex + 1, updatedBeats.length - 1),
    lastBeatAt: currentTurn,
    nextEligibleAfter,
    pressureLevel: Math.min(100, plan.pressureLevel + 5),
    revealedFacts
  }
}

migrateLegacyBackstoryArcs()
loadStore()
