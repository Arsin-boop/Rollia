export type CombatPhase = 'starting' | 'player_turn' | 'enemy_turn' | 'resolving' | 'ended'

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
  phase: CombatPhase
  round: number
  turn_index: number
  initiative_order: string[]
  entities: CombatEntity[]
  log: CombatEvent[]
}

type ActionIntent = {
  action: 'attack' | 'defend' | 'move' | 'item' | 'spell' | 'attempt'
  actor: string
  target?: string | null
  params?: Record<string, any>
  free_text?: string | null
  risk?: 'low' | 'medium' | 'high'
}

const battles = new Map<string, CombatState>()

const rollDie = (faces: number) => Math.floor(Math.random() * faces) + 1

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const appendLog = (state: CombatState, events: CombatEvent[]) => {
  state.log = [...state.log, ...events].slice(-20)
}

export const startBattle = (campaignId: string, player: CombatEntity, enemies: CombatEntity[]): CombatState => {
  const id = `${campaignId}-battle`
  const initiative_order = [player.id, ...enemies.map(enemy => enemy.id)]

  const state: CombatState = {
    id,
    phase: 'player_turn',
    round: 1,
    turn_index: 0,
    initiative_order,
    entities: [player, ...enemies],
    log: []
  }

  const events: CombatEvent[] = [
    { type: 'TURN_START', data: { actor: player.id } }
  ]
  appendLog(state, events)
  battles.set(campaignId, state)
  return state
}

export const getBattle = (campaignId: string): CombatState | null => {
  return battles.get(campaignId) || null
}

const resolveAttack = (
  state: CombatState,
  intent: ActionIntent,
  events: CombatEvent[],
  attackRoll?: { d20?: number; bonus?: number; total?: number }
) => {
  const targetId = intent.target
  if (!targetId) return
  const attacker = state.entities.find(entity => entity.id === intent.actor)
  const target = state.entities.find(entity => entity.id === targetId)
  if (!attacker || !target) return

  const d20 = typeof attackRoll?.d20 === 'number' ? attackRoll.d20 : rollDie(20)
  const bonus =
    typeof attackRoll?.bonus === 'number'
      ? attackRoll.bonus
      : typeof attackRoll?.total === 'number'
        ? attackRoll.total - d20
        : 0
  const total = typeof attackRoll?.total === 'number' ? attackRoll.total : d20 + bonus
  const critical = d20 === 20
  const fumble = d20 === 1
  const ac = 10
  const hit = critical ? true : fumble ? false : total >= ac
  events.push({
    type: 'ATTACK_RESOLVED',
    data: { actor: attacker.id, target: target.id, hit, roll: d20, bonus, total, critical, fumble, ac }
  })

  if (hit) {
    const baseDamage = attacker.type === 'player' ? rollDie(8) + 2 : rollDie(6) + 1
    let damage = critical ? baseDamage * 2 : baseDamage
    if (target.type === 'player') {
      const defending = target.statuses.find(status => status.key === 'defending')
      if (defending) {
        damage = Math.max(1, Math.floor(damage / 2))
      }
    }
    target.hp = clamp(target.hp - damage, 0, target.hp_max)
    events.push({
      type: 'DAMAGE_APPLIED',
      data: { target: target.id, amount: damage, source: attacker.id, remaining_hp: target.hp }
    })
    if (target.hp === 0) {
      events.push({ type: 'ENEMY_DEFEATED', data: { target: target.id } })
    }
  }
}

const resolveDefend = (state: CombatState, intent: ActionIntent, events: CombatEvent[]) => {
  const actor = state.entities.find(entity => entity.id === intent.actor)
  if (!actor) return
  const existing = actor.statuses.find(status => status.key === 'defending')
  if (!existing) {
    actor.statuses.push({ key: 'defending', duration: 1 })
  }
  events.push({ type: 'STATUS_APPLIED', data: { target: actor.id, status_key: 'defending', duration: 'turn' } })
}

const resolveAttempt = (state: CombatState, intent: ActionIntent, events: CombatEvent[]) => {
  events.push({
    type: 'ATTEMPT_ACTION',
    data: {
      actor: intent.actor,
      target: intent.target || null,
      intent: intent.free_text || ''
    }
  })
}

const clearExpiredStatuses = (entity: CombatEntity, events: CombatEvent[]) => {
  const remaining = entity.statuses
    .map(status => ({ ...status, duration: status.duration - 1 }))
    .filter(status => status.duration > 0)

  entity.statuses.forEach(status => {
    if (!remaining.find(next => next.key === status.key)) {
      events.push({ type: 'STATUS_REMOVED', data: { target: entity.id, status_key: status.key } })
    }
  })

  entity.statuses = remaining
}

const resolveEnemyTurn = (state: CombatState, events: CombatEvent[]) => {
  const player = state.entities.find(entity => entity.type === 'player')
  if (!player) return
  const enemies = state.entities.filter(entity => entity.type === 'enemy' && entity.hp > 0)

  enemies.forEach(enemy => {
    events.push({ type: 'TURN_START', data: { actor: enemy.id } })
    resolveAttack(state, { action: 'attack', actor: enemy.id, target: player.id }, events)
  })

  events.push({ type: 'TURN_START', data: { actor: player.id } })
}

const checkCombatEnd = (state: CombatState, events: CombatEvent[]) => {
  const player = state.entities.find(entity => entity.type === 'player')
  const enemiesAlive = state.entities.some(entity => entity.type === 'enemy' && entity.hp > 0)

  if (!player || player.hp <= 0) {
    state.phase = 'ended'
    events.push({ type: 'COMBAT_ENDED', data: { result: 'defeat' } })
    return true
  }

  if (!enemiesAlive) {
    state.phase = 'ended'
    events.push({ type: 'COMBAT_ENDED', data: { result: 'victory' } })
    return true
  }

  return false
}

export const resolveAction = (
  campaignId: string,
  intent: ActionIntent,
  playerSnapshot?: { hp?: number; mp?: number },
  rollOverrides?: { attackRoll?: { d20?: number; bonus?: number; total?: number } }
) => {
  const state = battles.get(campaignId)
  if (!state) {
    throw new Error('Battle not found')
  }

  const player = state.entities.find(entity => entity.type === 'player')
  if (playerSnapshot && player) {
    if (typeof playerSnapshot.hp === 'number') {
      player.hp = clamp(playerSnapshot.hp, 0, player.hp_max)
    }
    if (typeof playerSnapshot.mp === 'number' && typeof player.mp === 'number' && typeof player.mp_max === 'number') {
      player.mp = clamp(playerSnapshot.mp, 0, player.mp_max)
    }
  }

  const events: CombatEvent[] = []
  events.push({ type: 'TURN_START', data: { actor: intent.actor } })

  switch (intent.action) {
    case 'attack':
      resolveAttack(state, intent, events, rollOverrides?.attackRoll)
      break
    case 'defend':
      resolveDefend(state, intent, events)
      break
    case 'move':
      events.push({ type: 'MOVE_RESOLVED', data: { actor: intent.actor, target: intent.target || null, params: intent.params || {} } })
      break
    case 'item':
      events.push({ type: 'ITEM_USED', data: { actor: intent.actor, params: intent.params || {} } })
      break
    case 'spell':
      events.push({ type: 'SPELL_CAST', data: { actor: intent.actor, params: intent.params || {} } })
      break
    case 'attempt':
    default:
      resolveAttempt(state, intent, events)
      break
  }

  if (!checkCombatEnd(state, events)) {
    state.phase = 'enemy_turn'
    resolveEnemyTurn(state, events)
    state.round += 1
    state.phase = 'player_turn'
    state.entities.forEach(entity => clearExpiredStatuses(entity, events))
    checkCombatEnd(state, events)
  }

  appendLog(state, events)
  battles.set(campaignId, state)
  return { state, events }
}
