export type DamageType =
  | 'slashing'
  | 'piercing'
  | 'bludgeoning'
  | 'fire'
  | 'cold'
  | 'lightning'
  | 'thunder'
  | 'poison'
  | 'acid'
  | 'necrotic'
  | 'radiant'
  | 'force'
  | 'psychic'

export interface DamageInstance {
  type: DamageType
  amount: number
  source: string
  isCritical?: boolean
}

export interface DamageResistance {
  type: DamageType
  factor: number // 0 = immune, 0.5 = resistant, 1 = normal, 2 = vulnerable
}

export interface DamageResult {
  instances: DamageInstance[]
  totalRaw: number
  totalEffective: number
  resistancesApplied: DamageResistance[]
  isCritical: boolean
}

export const applyResistances = (
  instances: DamageInstance[],
  resistances: DamageResistance[]
): DamageResult => {
  const resistanceMap = new Map(resistances.map(r => [r.type, r.factor]))
  let totalRaw = 0
  let totalEffective = 0
  let isCritical = false
  const applied: DamageResistance[] = []

  for (const instance of instances) {
    totalRaw += instance.amount
    if (instance.isCritical) isCritical = true
    const factor = resistanceMap.get(instance.type) ?? 1
    const effective = Math.floor(instance.amount * factor)
    totalEffective += effective
    if (factor !== 1) {
      applied.push({ type: instance.type, factor })
    }
  }

  return {
    instances,
    totalRaw,
    totalEffective,
    resistancesApplied: applied,
    isCritical
  }
}
