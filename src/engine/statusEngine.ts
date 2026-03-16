import type { StatusModifier, StatusTick } from '../types/status'
import { getStatusById } from '../data/statuses'

// ── Runtime Status Instance ──────────────────────────────────────────

export interface ActiveStatus {
  id: string              // matches StatusEffectDef.id
  name: string
  remainingDuration: number  // turns left, -1 = permanent
  stacks: number
  sourceId?: string       // who applied it
  appliedAt: number       // round number when applied
}

export interface TickResult {
  statusId: string
  statusName: string
  effect: StatusTick
  totalAmount: number     // amount * stacks
  expired: boolean
}

// ── Core Functions ───────────────────────────────────────────────────

/**
 * Process all active statuses for one turn tick.
 * Returns the updated statuses list and any tick effects that should be applied.
 */
export const tickStatuses = (
  statuses: ActiveStatus[]
): { updatedStatuses: ActiveStatus[]; tickResults: TickResult[] } => {
  const tickResults: TickResult[] = []
  const updatedStatuses: ActiveStatus[] = []

  for (const status of statuses) {
    const definition = getStatusById(status.id)
    const tick = definition?.tickEffect

    // Apply tick effect if present
    if (tick) {
      tickResults.push({
        statusId: status.id,
        statusName: status.name,
        effect: tick,
        totalAmount: tick.amount * status.stacks,
        expired: status.remainingDuration === 1 // will expire after this tick
      })
    }

    // Reduce duration
    if (status.remainingDuration === -1) {
      // Permanent — keep as-is
      updatedStatuses.push(status)
    } else if (status.remainingDuration > 1) {
      updatedStatuses.push({
        ...status,
        remainingDuration: status.remainingDuration - 1
      })
    }
    // else duration === 1 → expired, don't add to updated list
  }

  return { updatedStatuses, tickResults }
}

/**
 * Apply a new status effect. Handles stacking and replacement.
 */
export const applyStatus = (
  statuses: ActiveStatus[],
  statusId: string,
  sourceId?: string,
  currentRound: number = 0
): ActiveStatus[] => {
  const definition = getStatusById(statusId)
  if (!definition) return statuses

  const existingIndex = statuses.findIndex(s => s.id === statusId)

  if (existingIndex >= 0) {
    const existing = statuses[existingIndex]

    if (definition.canStack) {
      const maxStacks = definition.maxStacks ?? 5
      if (existing.stacks < maxStacks) {
        const updated = [...statuses]
        updated[existingIndex] = {
          ...existing,
          stacks: existing.stacks + 1,
          remainingDuration: definition.duration // refresh duration on stack
        }
        return updated
      }
      return statuses // at max stacks, do nothing
    }

    // Non-stackable: refresh duration
    const updated = [...statuses]
    updated[existingIndex] = {
      ...existing,
      remainingDuration: definition.duration
    }
    return updated
  }

  // New status
  const newStatus: ActiveStatus = {
    id: definition.id,
    name: definition.name,
    remainingDuration: definition.duration,
    stacks: 1,
    sourceId,
    appliedAt: currentRound
  }

  return [...statuses, newStatus]
}

/**
 * Remove a status by ID.
 */
export const removeStatus = (
  statuses: ActiveStatus[],
  statusId: string
): ActiveStatus[] => {
  return statuses.filter(s => s.id !== statusId)
}

/**
 * Remove one stack of a stackable status. Removes entirely if stacks reach 0.
 */
export const removeStack = (
  statuses: ActiveStatus[],
  statusId: string
): ActiveStatus[] => {
  return statuses
    .map(s => {
      if (s.id !== statusId) return s
      const newStacks = s.stacks - 1
      return newStacks > 0 ? { ...s, stacks: newStacks } : null
    })
    .filter((s): s is ActiveStatus => s !== null)
}

/**
 * Get all active stat modifiers from current statuses.
 * Modifiers are summed across all statuses (and stacks).
 */
export const getActiveModifiers = (
  statuses: ActiveStatus[]
): Map<StatusModifier['stat'], number> => {
  const modifiers = new Map<StatusModifier['stat'], number>()

  for (const status of statuses) {
    const definition = getStatusById(status.id)
    if (!definition?.modifiers) continue

    for (const mod of definition.modifiers) {
      const current = modifiers.get(mod.stat) ?? 0
      modifiers.set(mod.stat, current + (mod.value * status.stacks))
    }
  }

  return modifiers
}

/**
 * Check if an entity has a specific restriction from any active status.
 */
export const hasRestriction = (
  statuses: ActiveStatus[],
  restriction: string
): boolean => {
  for (const status of statuses) {
    const definition = getStatusById(status.id)
    if (definition?.restrictions?.includes(restriction)) {
      return true
    }
  }
  return false
}

/**
 * Get all active restrictions.
 */
export const getActiveRestrictions = (
  statuses: ActiveStatus[]
): string[] => {
  const restrictions = new Set<string>()

  for (const status of statuses) {
    const definition = getStatusById(status.id)
    if (definition?.restrictions) {
      for (const r of definition.restrictions) {
        restrictions.add(r)
      }
    }
  }

  return Array.from(restrictions)
}
