// D&D 5e Dice Rolling Service

export interface DiceRoll {
  type: string // e.g., "d20", "2d6+3", "d20+5"
  result: number
  rolls: number[]
  modifier?: number
  total: number
}

export interface SkillCheck {
  skill: string
  ability: string // STR, DEX, CON, INT, WIS, CHA
  modifier: number
  proficiency: boolean
  roll: DiceRoll
  result: 'success' | 'failure' | 'critical_success' | 'critical_failure'
  dc?: number
}

export interface SavingThrow {
  ability: string
  modifier: number
  proficiency: boolean
  roll: DiceRoll
  result: 'success' | 'failure' | 'critical_success' | 'critical_failure'
  dc?: number
}

/**
 * Roll a single die
 */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

/**
 * Parse and roll dice notation (e.g., "2d6+3", "d20", "1d4-1")
 */
export function rollDice(notation: string): DiceRoll {
  const cleanNotation = notation.trim().toLowerCase()
  
  // Match patterns like: 2d6+3, d20, 1d4-1, 3d8
  const match = cleanNotation.match(/^(\d*)d(\d+)([+-]\d+)?$/)
  
  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`)
  }

  const numDice = match[1] ? parseInt(match[1]) : 1
  const sides = parseInt(match[2])
  const modifier = match[3] ? parseInt(match[3]) : 0

  if (sides < 2 || sides > 100) {
    throw new Error(`Invalid die size: ${sides}`)
  }

  if (numDice < 1 || numDice > 100) {
    throw new Error(`Invalid number of dice: ${numDice}`)
  }

  const rolls: number[] = []
  for (let i = 0; i < numDice; i++) {
    rolls.push(rollDie(sides))
  }

  const result = rolls.reduce((sum, roll) => sum + roll, 0)
  const total = result + modifier

  return {
    type: notation,
    result,
    rolls,
    modifier,
    total
  }
}

/**
 * Roll a d20 with modifier
 */
export function rollD20(modifier: number = 0): DiceRoll {
  const roll = rollDie(20)
  return {
    type: `d20${modifier >= 0 ? '+' : ''}${modifier}`,
    result: roll,
    rolls: [roll],
    modifier,
    total: roll + modifier
  }
}

/**
 * Calculate ability modifier from ability score
 */
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

/**
 * Perform a skill check
 */
export function performSkillCheck(
  skill: string,
  ability: string,
  abilityScore: number,
  proficiencyBonus: number,
  isProficient: boolean,
  dc?: number
): SkillCheck {
  const abilityMod = getAbilityModifier(abilityScore)
  const proficiency = isProficient ? proficiencyBonus : 0
  const modifier = abilityMod + proficiency

  const roll = rollD20(modifier)
  
  let result: 'success' | 'failure' | 'critical_success' | 'critical_failure'
  
  if (roll.rolls[0] === 20) {
    result = 'critical_success'
  } else if (roll.rolls[0] === 1) {
    result = 'critical_failure'
  } else if (dc !== undefined) {
    result = roll.total >= dc ? 'success' : 'failure'
  } else {
    result = roll.total >= 10 ? 'success' : 'failure' // Default DC 10
  }

  return {
    skill,
    ability,
    modifier,
    proficiency: isProficient,
    roll,
    result,
    dc
  }
}

/**
 * Perform a saving throw
 */
export function performSavingThrow(
  ability: string,
  abilityScore: number,
  proficiencyBonus: number,
  isProficient: boolean,
  dc?: number
): SavingThrow {
  const abilityMod = getAbilityModifier(abilityScore)
  const proficiency = isProficient ? proficiencyBonus : 0
  const modifier = abilityMod + proficiency

  const roll = rollD20(modifier)
  
  let result: 'success' | 'failure' | 'critical_success' | 'critical_failure'
  
  if (roll.rolls[0] === 20) {
    result = 'critical_success'
  } else if (roll.rolls[0] === 1) {
    result = 'critical_failure'
  } else if (dc !== undefined) {
    result = roll.total >= dc ? 'success' : 'failure'
  } else {
    result = roll.total >= 10 ? 'success' : 'failure'
  }

  return {
    ability,
    modifier,
    proficiency: isProficient,
    roll,
    result,
    dc
  }
}

/**
 * Roll for damage
 */
export function rollDamage(damageDice: string, modifier: number = 0): DiceRoll {
  return rollDice(`${damageDice}${modifier >= 0 ? '+' : ''}${modifier}`)
}

/**
 * Roll for attack
 */
export function rollAttack(attackBonus: number): {
  roll: DiceRoll
  isHit: boolean
  isCritical: boolean
  ac?: number
} {
  const roll = rollD20(attackBonus)
  const isCritical = roll.rolls[0] === 20
  const isHit = roll.rolls[0] === 20 || (roll.rolls[0] !== 1 && roll.total >= 10) // Default AC 10

  return {
    roll,
    isHit,
    isCritical
  }
}

/**
 * Parse roll notation from text (e.g., "d20+5 Athletics")
 */
export function parseRollFromText(text: string): {
  notation: string
  type?: string
  modifier?: number
} | null {
  // Match patterns like: d20+5, 2d6+3, d20 Athletics, etc.
  const patterns = [
    /(\d*d\d+[+-]?\d*)\s+(\w+)/i, // "d20+5 Athletics"
    /(\d*d\d+[+-]?\d*)/i, // "d20+5"
    /roll\s+(\d*d\d+[+-]?\d*)/i, // "roll d20+5"
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return {
        notation: match[1],
        type: match[2] || undefined
      }
    }
  }

  return null
}

