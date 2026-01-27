import express from 'express'
import { generateCombatNarration } from '../services/aiService.js'
import { getBattle, resolveAction, startBattle, type CombatEntity } from '../services/combatService.js'

const router = express.Router()

router.post('/start', async (req, res) => {
  try {
    const { campaignId, player, enemies } = req.body

    if (!campaignId || !player || !Array.isArray(enemies)) {
      return res.status(400).json({ error: 'campaignId, player, and enemies are required' })
    }

    const playerEntity: CombatEntity = {
      id: player.id || 'player',
      type: 'player',
      name: player.name || 'Player',
      hp: Number(player.hp ?? 1),
      hp_max: Number(player.hp_max ?? player.hp ?? 1),
      mp: typeof player.mp === 'number' ? player.mp : undefined,
      mp_max: typeof player.mp_max === 'number' ? player.mp_max : undefined,
      statuses: []
    }

    const enemyEntities: CombatEntity[] = enemies.map((enemy: any, index: number) => ({
      id: enemy.id || `enemy-${index}`,
      type: 'enemy',
      name: enemy.name || `Enemy ${index + 1}`,
      hp: Number(enemy.hp ?? 10),
      hp_max: Number(enemy.hp_max ?? enemy.hp ?? 10),
      statuses: []
    }))

    const state = startBattle(String(campaignId), playerEntity, enemyEntities)
    res.json({ battle: state, events: state.log })
  } catch (error: any) {
    console.error('Error starting battle:', error)
    res.status(500).json({ error: error?.message || 'Failed to start battle' })
  }
})

router.post('/action', async (req, res) => {
  try {
    const { campaignId, intent, context, playerSnapshot } = req.body
    if (!campaignId || !intent) {
      return res.status(400).json({ error: 'campaignId and intent are required' })
    }

    const resolved = resolveAction(String(campaignId), intent, playerSnapshot)
    const narration = await generateCombatNarration(resolved.state, resolved.events, context || '')
    res.json({ battle: resolved.state, events: resolved.events, narration })
  } catch (error: any) {
    console.error('Error resolving battle action:', error)
    res.status(500).json({ error: error?.message || 'Failed to resolve action' })
  }
})

router.get('/state/:campaignId', (req, res) => {
  const battle = getBattle(String(req.params.campaignId))
  if (!battle) {
    return res.status(404).json({ error: 'Battle not found' })
  }
  res.json({ battle })
})

export default router
