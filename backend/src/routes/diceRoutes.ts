import express from 'express'
import {
  rollDice,
  rollD20,
  performSkillCheck,
  performSavingThrow,
  rollDamage,
  rollAttack,
  getAbilityModifier
} from '../services/diceService.js'

const router = express.Router()

// Roll dice with notation
router.post('/roll', (req, res) => {
  try {
    const { notation } = req.body

    if (!notation || typeof notation !== 'string') {
      return res.status(400).json({ error: 'Dice notation is required (e.g., "d20", "2d6+3")' })
    }

    const result = rollDice(notation)
    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid dice notation' })
  }
})

// Roll a d20
router.post('/roll-d20', (req, res) => {
  try {
    const { modifier = 0 } = req.body
    const result = rollD20(Number(modifier))
    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid modifier' })
  }
})

// Perform a skill check
router.post('/skill-check', (req, res) => {
  try {
    const {
      skill,
      ability,
      abilityScore,
      proficiencyBonus,
      isProficient,
      dc
    } = req.body

    if (!skill || !ability || abilityScore === undefined) {
      return res.status(400).json({ error: 'Skill, ability, and abilityScore are required' })
    }

    const result = performSkillCheck(
      skill,
      ability,
      Number(abilityScore),
      Number(proficiencyBonus || 0),
      Boolean(isProficient),
      dc !== undefined ? Number(dc) : undefined
    )

    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid skill check parameters' })
  }
})

// Perform a saving throw
router.post('/saving-throw', (req, res) => {
  try {
    const {
      ability,
      abilityScore,
      proficiencyBonus,
      isProficient,
      dc
    } = req.body

    if (!ability || abilityScore === undefined) {
      return res.status(400).json({ error: 'Ability and abilityScore are required' })
    }

    const result = performSavingThrow(
      ability,
      Number(abilityScore),
      Number(proficiencyBonus || 0),
      Boolean(isProficient),
      dc !== undefined ? Number(dc) : undefined
    )

    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid saving throw parameters' })
  }
})

// Roll damage
router.post('/damage', (req, res) => {
  try {
    const { damageDice, modifier = 0 } = req.body

    if (!damageDice || typeof damageDice !== 'string') {
      return res.status(400).json({ error: 'Damage dice notation is required (e.g., "1d8", "2d6")' })
    }

    const result = rollDamage(damageDice, Number(modifier))
    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid damage dice notation' })
  }
})

// Roll attack
router.post('/attack', (req, res) => {
  try {
    const { attackBonus = 0 } = req.body
    const result = rollAttack(Number(attackBonus))
    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid attack bonus' })
  }
})

// Get ability modifier
router.post('/ability-modifier', (req, res) => {
  try {
    const { abilityScore } = req.body

    if (abilityScore === undefined) {
      return res.status(400).json({ error: 'Ability score is required' })
    }

    const modifier = getAbilityModifier(Number(abilityScore))
    res.json({ abilityScore: Number(abilityScore), modifier })
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid ability score' })
  }
})

export default router

