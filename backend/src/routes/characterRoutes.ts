import express from 'express'
import {
  avatarFileExists,
  composeAvatarPrompt,
  computeAppearanceHash,
  generateAvatarPng,
  getAvatarQualityConfig,
  saveAvatarPng,
  validateAvatarGender
} from '../services/avatarService.js'
import { generateAppearanceSpec, generateClassVisualTags, generateCustomClass } from '../services/aiService.js'
import { createCharacterId, getCharacter, upsertCharacter, updateCharacter } from '../services/characterStore.js'

const router = express.Router()
const MAX_APPEARANCE_LENGTH = 4000
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 5
const avatarRateLimit = new Map<string, number[]>()

const getClientIp = (req: express.Request) => {
  return req.ip || req.socket.remoteAddress || 'unknown'
}

const isRateLimited = (ip: string) => {
  const now = Date.now()
  const timestamps = avatarRateLimit.get(ip) || []
  const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    avatarRateLimit.set(ip, recent)
    return true
  }
  recent.push(now)
  avatarRateLimit.set(ip, recent)
  return false
}

const deriveCachedAvatarUrl = (characterId: string, hash: string) => {
  const hashPrefix = hash.slice(0, 10)
  return `/uploads/avatars/${characterId}_${hashPrefix}.png`
}

const generateAvatarForCharacter = async (
  characterId: string,
  appearanceDescription: string,
  appearanceSpec: {
    sex: 'male' | 'female' | 'unknown'
    genderPresentation: 'masculine' | 'feminine' | 'androgynous' | 'unknown'
    ageRange: 'teen' | '20s' | '30s' | '40s' | '50+' | 'unknown'
    hairLength: 'short' | 'medium' | 'long' | 'unknown'
    bodyType: 'slim' | 'average' | 'athletic' | 'muscular' | 'unknown'
    notableFeatures?: string[]
    clothingStyle?: string[]
    palette?: string[]
  },
  hash: string
) => {
  try {
    const { genderRetries } = getAvatarQualityConfig()
    let attempt = 0
    let lastError: string | null = null
    while (attempt <= genderRetries) {
      const strength = attempt > 0 ? 'strong' : 'normal'
      const { prompt, negativePrompt } = composeAvatarPrompt({
        appearanceDescription,
        appearanceSpec,
        forceStrength: strength
      })
      const pngBuffer = await generateAvatarPng(prompt, negativePrompt, hash)
      const validation = await validateAvatarGender(
        pngBuffer,
        appearanceSpec.sex,
        appearanceSpec.genderPresentation
      )
      if (validation.ok) {
        const { avatarUrl } = saveAvatarPng(characterId, hash, pngBuffer)
        updateCharacter(characterId, {
          avatarUrl,
          avatarHash: hash,
          avatarStatus: 'ready',
          avatarError: null
        })
        return
      }
      lastError = `Avatar gender validation failed (${validation.reason})`
      console.warn(lastError)
      attempt += 1
    }
    throw new Error(lastError || 'Avatar gender validation failed')
  } catch (error: any) {
    console.error('Avatar generation failed:', error)
    updateCharacter(characterId, {
      avatarStatus: 'failed',
      avatarError: error?.message || 'Avatar generation failed'
    })
  }
}

// Generate custom class with AI
router.post('/generate-class', async (req, res) => {
  try {
    const { description } = req.body

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ error: 'Class description is required' })
    }

    console.log('Generating custom class for description:', description.substring(0, 100))
    const classData = await generateCustomClass(description)
    console.log('Custom class generated successfully:', classData.className)
    res.json(classData)
  } catch (error: any) {
    console.error('Error generating custom class:', error)
    console.error('Error stack:', error?.stack)
    const errorMessage = error?.message || 'Failed to generate custom class'
    res.status(500).json({ 
      error: errorMessage,
      details: error?.message || 'Unknown error occurred'
    })
  }
})

router.post('/appearance', async (req, res) => {
  try {
    const {
      characterId,
      appearance,
      name,
      class: className,
      classDescription,
      backstory,
      forceRegenerate,
      regenNonce
    } = req.body

    if (!appearance || (typeof appearance !== 'string' && typeof appearance !== 'object')) {
      return res.status(400).json({ error: 'Appearance is required' })
    }

    const appearanceText = typeof appearance === 'string' ? appearance : JSON.stringify(appearance)
    if (appearanceText.length > MAX_APPEARANCE_LENGTH) {
      return res.status(400).json({ error: 'Appearance is too long' })
    }

    const id = characterId || createCharacterId()
    const { appearanceSpec, warnings } = await generateAppearanceSpec(appearanceText)
    const standardClassTags: Record<string, string[]> = {
      Barbarian: ['rugged fur collar', 'intense presence', 'scar hints'],
      Bard: ['ornate trim', 'confident charm', 'subtle musical motif pin'],
      Cleric: ['holy pendant', 'soft radiant rim light', 'calm authority'],
      Druid: ['natural motifs', 'leaf-like ornament', 'earthy aura'],
      Fighter: ['battle-worn collar', 'disciplined gaze', 'practical armor accents'],
      Monk: ['simple wraps', 'focused eyes', 'minimal ornamentation'],
      Paladin: ['regal high collar', 'polished metal accents', 'resolute expression'],
      Ranger: ['weathered cloak collar', 'outdoorsy tones', 'quiet vigilance'],
      Rogue: ['shadowed collar', 'sleek leather accents', 'alert eyes'],
      Sorcerer: ['inner glow', 'elemental highlights', 'confident presence'],
      Warlock: ['occult symbols', 'eerie ember glow', 'pact-mark hints'],
      Wizard: ['arcane sigil glow', 'refined cloak', 'mystical focus near hands']
    }
    const fallbackTags = className ? standardClassTags[className] : undefined
    const classTags =
      classDescription && className
        ? await generateClassVisualTags(className, classDescription)
        : fallbackTags || []
    const hash = computeAppearanceHash(appearanceText, 'v3', {
      appearanceSpec,
      className,
      classTags,
      regenNonce: forceRegenerate ? regenNonce || Date.now() : undefined
    })

    const composedPrompt = composeAvatarPrompt({
      appearanceDescription: appearanceText,
      appearanceSpec,
      className,
      classTags
    })

    const record = upsertCharacter(id, {
      name,
      class: className,
      classDescription,
      backstory,
      appearance: appearanceText,
      appearanceDescription: appearanceText,
      appearanceSpec,
      appearanceSpecMeta: {
        confidence: appearanceSpec.confidence || 0,
        warnings
      },
      derivedAvatarClassTags: classTags,
      avatarPrompt: composedPrompt,
      updatedAt: new Date().toISOString()
    })

    if (!forceRegenerate && record.avatarHash === hash && record.avatarUrl && avatarFileExists(id, hash)) {
      const ready = updateCharacter(id, { avatarStatus: 'ready', avatarError: null })
      return res.json({ ...ready })
    }

    if (!forceRegenerate && record.avatarHash === hash && avatarFileExists(id, hash)) {
      const avatarUrl = deriveCachedAvatarUrl(id, hash)
      const ready = updateCharacter(id, { avatarUrl, avatarStatus: 'ready', avatarError: null })
      return res.json({ ...ready })
    }

    const ip = getClientIp(req)
    if (isRateLimited(ip)) {
      updateCharacter(id, { avatarStatus: 'failed', avatarError: 'Rate limit exceeded' })
      return res.status(429).json({ error: 'Too many avatar generation requests' })
    }

    if (!process.env.MODELSLAB_KEY) {
      updateCharacter(id, { avatarStatus: 'failed', avatarError: 'MODELSLAB_KEY is not configured' })
      return res.status(500).json({ error: 'MODELSLAB_KEY is not configured' })
    }

    updateCharacter(id, {
      avatarStatus: 'pending',
      avatarError: null,
      avatarHash: hash,
      avatarUrl: null
    })

    void generateAvatarForCharacter(id, appearanceText, appearanceSpec, hash)

    const updated = getCharacter(id)
    return res.json({ ...updated })
  } catch (error: any) {
    console.error('Error saving appearance:', error)
    res.status(500).json({ error: error?.message || 'Failed to save appearance' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const character = getCharacter(req.params.id)
    if (!character) {
      return res.status(404).json({ error: 'Character not found' })
    }
    return res.json(character)
  } catch (error: any) {
    console.error('Error fetching character:', error)
    res.status(500).json({ error: error?.message || 'Failed to load character' })
  }
})

export default router

