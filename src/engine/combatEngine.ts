import type { DamageType, DamageInstance, DamageResistance, DamageResult } from '../types/damage'
import { applyResistances } from '../types/damage'
import { modFromScore } from '../utils/math'
import { rollDice, rollSingle } from '../utils/random'

// ── Types ────────────────────────────────────────────────────────────

export type CombatPhase = 'initiative' | 'playerTurn' | 'enemyTurn' | 'resolution' | 'ended'

export interface CombatEntity {
  id: string
  name: string
  type: 'player' | 'enemy' | 'ally'
  hp: number
  hpMax: number
  mp: number
  mpMax: number
  ac: number
  stats: {
    strength: number
    dexterity: number
    constitution: number
    intelligence: number
    wisdom: number
    charisma: number
  }
  initiative: number
  resistances: DamageResistance[]
  isAlive: boolean
}

export interface CombatAction {
  type: 'attack' | 'spell' | 'skill' | 'item' | 'defend' | 'move' | 'flee'
  actorId: string
  targetId?: string
  weaponDamage?: string       // dice notation, e.g. "1d8+3"
  weaponDamageType?: DamageType
  spellId?: string
  skillId?: string
  itemId?: string
  freeText?: string
}

export interface CombatTurnResult {
  actorId: string
  targetId?: string
  actionType: CombatAction['type']
  attackRoll?: number
  hit: boolean
  damage?: DamageResult
  healing?: number
  narrative: string
}

export interface CombatState {
  phase: CombatPhase
  round: number
  turnOrder: string[]          // entity IDs sorted by initiative
  currentTurnIndex: number
  entities: Map<string, CombatEntity>
  log: CombatTurnResult[]
}

// ── Initiative ───────────────────────────────────────────────────────

export const rollInitiative = (entities: CombatEntity[]): CombatEntity[] => {
  return entities.map(entity => ({
    ...entity,
    initiative: rollSingle(20) + modFromScore(entity.stats.dexterity)
  }))
}

export const sortByInitiative = (entities: CombatEntity[]): CombatEntity[] => {
  return [...entities].sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative
    // Tie-break: higher DEX goes first
    return modFromScore(b.stats.dexterity) - modFromScore(a.stats.dexterity)
  })
}

// ── Combat State Machine ─────────────────────────────────────────────

export const createCombatState = (entities: CombatEntity[]): CombatState => {
  const withInitiative = rollInitiative(entities)
  const sorted = sortByInitiative(withInitiative)
  const entityMap = new Map(sorted.map(e => [e.id, e]))

  return {
    phase: 'initiative',
    round: 1,
    turnOrder: sorted.map(e => e.id),
    currentTurnIndex: 0,
    entities: entityMap,
    log: []
  }
}

export const getCurrentEntity = (state: CombatState): CombatEntity | undefined => {
  const id = state.turnOrder[state.currentTurnIndex]
  return id ? state.entities.get(id) : undefined
}

export const advanceTurn = (state: CombatState): CombatState => {
  const aliveOrder = state.turnOrder.filter(id => {
    const entity = state.entities.get(id)
    return entity?.isAlive
  })

  if (aliveOrder.length === 0) {
    return { ...state, phase: 'ended' }
  }

  let nextIndex = state.currentTurnIndex + 1
  let nextRound = state.round

  if (nextIndex >= state.turnOrder.length) {
    nextIndex = 0
    nextRound += 1
  }

  // Skip dead entities
  let attempts = 0
  while (attempts < state.turnOrder.length) {
    const nextId = state.turnOrder[nextIndex]
    const entity = state.entities.get(nextId!)
    if (entity?.isAlive) break
    nextIndex = (nextIndex + 1) % state.turnOrder.length
    if (nextIndex === 0) nextRound += 1
    attempts++
  }

  const nextEntity = state.entities.get(state.turnOrder[nextIndex]!)
  const nextPhase: CombatPhase = nextEntity?.type === 'player' ? 'playerTurn' : 'enemyTurn'

  return {
    ...state,
    round: nextRound,
    currentTurnIndex: nextIndex,
    phase: nextPhase
  }
}

// ── Attack Resolution ────────────────────────────────────────────────

export const resolveMeleeAttack = (
  attacker: CombatEntity,
  target: CombatEntity,
  weaponDamage: string = '1d6',
  damageType: DamageType = 'slashing'
): CombatTurnResult => {
  const attackBonus = modFromScore(attacker.stats.strength) + 2 // +2 proficiency base
  const attackRoll = rollSingle(20)
  const totalAttack = attackRoll + attackBonus
  const isCritical = attackRoll === 20
  const isCritFail = attackRoll === 1
  const hit = isCritFail ? false : (isCritical || totalAttack >= target.ac)

  if (!hit) {
    return {
      actorId: attacker.id,
      targetId: target.id,
      actionType: 'attack',
      attackRoll: totalAttack,
      hit: false,
      narrative: `${attacker.name} swings at ${target.name} but misses${isCritFail ? ' badly' : ''}.`
    }
  }

  const damageRoll = rollDice(weaponDamage)
  const critMultiplier = isCritical ? 2 : 1
  const strMod = Math.max(0, modFromScore(attacker.stats.strength))
  const totalDamage = (damageRoll.total * critMultiplier) + strMod

  const instance: DamageInstance = {
    type: damageType,
    amount: totalDamage,
    source: attacker.name,
    isCritical
  }

  const damageResult = applyResistances([instance], target.resistances)

  return {
    actorId: attacker.id,
    targetId: target.id,
    actionType: 'attack',
    attackRoll: totalAttack,
    hit: true,
    damage: damageResult,
    narrative: `${attacker.name} strikes ${target.name}${isCritical ? ' with a critical hit' : ''} for ${damageResult.totalEffective} ${damageType} damage.`
  }
}

export const resolveSpellAttack = (
  caster: CombatEntity,
  target: CombatEntity,
  damageFormula: string = '2d6',
  damageType: DamageType = 'fire',
  spellName: string = 'Spell'
): CombatTurnResult => {
  const spellMod = modFromScore(caster.stats.intelligence) + 2
  const attackRoll = rollSingle(20)
  const totalAttack = attackRoll + spellMod
  const isCritical = attackRoll === 20
  const hit = attackRoll === 1 ? false : (isCritical || totalAttack >= target.ac)

  if (!hit) {
    return {
      actorId: caster.id,
      targetId: target.id,
      actionType: 'spell',
      attackRoll: totalAttack,
      hit: false,
      narrative: `${caster.name} casts ${spellName} at ${target.name}, but it fizzles.`
    }
  }

  const damageRoll = rollDice(damageFormula)
  const critMultiplier = isCritical ? 2 : 1
  const totalDamage = damageRoll.total * critMultiplier

  const instance: DamageInstance = {
    type: damageType,
    amount: totalDamage,
    source: `${caster.name} (${spellName})`,
    isCritical
  }

  const damageResult = applyResistances([instance], target.resistances)

  return {
    actorId: caster.id,
    targetId: target.id,
    actionType: 'spell',
    attackRoll: totalAttack,
    hit: true,
    damage: damageResult,
    narrative: `${caster.name} casts ${spellName}${isCritical ? ' (critical!)' : ''}, dealing ${damageResult.totalEffective} ${damageType} damage to ${target.name}.`
  }
}

// ── Combat End Check ─────────────────────────────────────────────────

export type CombatOutcome = 'ongoing' | 'victory' | 'defeat' | 'draw'

export const checkCombatEnd = (state: CombatState): CombatOutcome => {
  const entities = Array.from(state.entities.values())
  const playersAlive = entities.filter(e => (e.type === 'player' || e.type === 'ally') && e.isAlive)
  const enemiesAlive = entities.filter(e => e.type === 'enemy' && e.isAlive)

  if (enemiesAlive.length === 0 && playersAlive.length > 0) return 'victory'
  if (playersAlive.length === 0 && enemiesAlive.length > 0) return 'defeat'
  if (playersAlive.length === 0 && enemiesAlive.length === 0) return 'draw'
  return 'ongoing'
}

// ── Apply Damage to Entity ───────────────────────────────────────────

export const applyDamageToEntity = (
  state: CombatState,
  entityId: string,
  amount: number
): CombatState => {
  const entity = state.entities.get(entityId)
  if (!entity) return state

  const newHp = Math.max(0, entity.hp - amount)
  const updatedEntity: CombatEntity = {
    ...entity,
    hp: newHp,
    isAlive: newHp > 0
  }

  const newEntities = new Map(state.entities)
  newEntities.set(entityId, updatedEntity)

  return { ...state, entities: newEntities }
}

export const applyHealingToEntity = (
  state: CombatState,
  entityId: string,
  amount: number
): CombatState => {
  const entity = state.entities.get(entityId)
  if (!entity || !entity.isAlive) return state

  const newHp = Math.min(entity.hpMax, entity.hp + amount)
  const updatedEntity: CombatEntity = { ...entity, hp: newHp }

  const newEntities = new Map(state.entities)
  newEntities.set(entityId, updatedEntity)

  return { ...state, entities: newEntities }
}
