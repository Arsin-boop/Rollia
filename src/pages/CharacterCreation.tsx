import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  API_ORIGIN,
  generateCustomClass,
  getCharacter,
  saveCharacterAppearance,
  type CustomClassResponse
} from '../utils/api'
import './CharacterCreation.css'

type CharacterData = {
  name: string
  class: string
  classDescription?: string
  customClassData?: CustomClassResponse
  backstory: string
  appearance: string
  abilityDeck?: CharacterAbility[]
}

type CharacterAbility = {
  id: string
  name: string
  description: string
  unlockLevel: number
  requiresEquipment?: string[]
  requiresArtifact?: string[]
}

const STAGES = ['name', 'class', 'backstory', 'appearance', 'review'] as const
type Stage = typeof STAGES[number]

const VANILLA_CLASSES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter',
  'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer',
  'Warlock', 'Wizard'
]

const CHARACTER_STORAGE_KEY = 'dnd-ai-character'
const CHARACTER_ID_KEY = 'dnd-ai-character-id'

const formatStatBonus = (value: number) => {
  const bonus = Math.floor((value - 10) / 2)
  return `${bonus >= 0 ? '+' : ''}${bonus}`
}

const STAT_LABELS: Record<string, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA'
}

const CLASS_PRESETS: Record<string, CustomClassResponse> = {
  Barbarian: {
    className: 'Barbarian',
    stats: { strength: 15, dexterity: 12, constitution: 14, intelligence: 8, wisdom: 10, charisma: 11 },
    hitDie: 'd12',
    proficiencies: ['Light armor', 'Medium armor', 'Shields', 'Simple weapons', 'Martial weapons'],
    features: ['Rage: Enter a primal fury to gain bonus damage and resistances.', 'Reckless Attack: Strike with abandon for advantage at a cost.'],
    description: 'Barbarians are storm-hearted adventurers whose rage channels ancient spirits. Their bodies are scarred maps of the wilds they roam.'
  },
  Bard: {
    className: 'Bard',
    stats: { strength: 9, dexterity: 13, constitution: 11, intelligence: 12, wisdom: 10, charisma: 15 },
    hitDie: 'd8',
    proficiencies: ['Light armor', 'Simple weapons', 'Hand crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
    features: ['Bardic Inspiration: Inspire allies with words or music.', 'Spellcasting: Weave arcane songs to reshape the battlefield.'],
    description: 'Bards are lore-keepers who spin magic with melody. They thrive on stories, secrets, and the emotions of those around them.'
  },
  Cleric: {
    className: 'Cleric',
    stats: { strength: 10, dexterity: 10, constitution: 13, intelligence: 11, wisdom: 15, charisma: 12 },
    hitDie: 'd8',
    proficiencies: ['Light armor', 'Medium armor', 'Shields', 'Simple weapons'],
    features: ['Channel Divinity: Invoke your deity for potent miracles.', 'Divine Domain: Specialize in a sacred path that shapes your spells.'],
    description: 'Clerics are conduits of the divine, balancing steel and scripture. Their presence steadies the party amid darkness.'
  },
  Druid: {
    className: 'Druid',
    stats: { strength: 9, dexterity: 12, constitution: 13, intelligence: 11, wisdom: 15, charisma: 10 },
    hitDie: 'd8',
    proficiencies: ['Light armor', 'Medium armor', 'Shields (non-metal)', 'Clubs', 'Daggers', 'Darts', 'Javelins', 'Maces', 'Quarterstaffs', 'Scimitars', 'Sickles', 'Slings', 'Spears'],
    features: ['Wild Shape: Transform into beasts you have studied.', 'Spellcasting: Command primal forces of nature.'],
    description: 'Druids guard the balance, speaking for forests and storms. Their spells feel like whispers of the wild.'
  },
  Fighter: {
    className: 'Fighter',
    stats: { strength: 14, dexterity: 13, constitution: 14, intelligence: 10, wisdom: 11, charisma: 8 },
    hitDie: 'd10',
    proficiencies: ['All armor', 'Shields', 'Simple weapons', 'Martial weapons'],
    features: ['Fighting Style: Hone a preferred combat technique.', 'Second Wind: Regain vitality in the thick of battle.'],
    description: 'Fighters are disciplined tacticians. They find poetry in steel and strategy.'
  },
  Monk: {
    className: 'Monk',
    stats: { strength: 11, dexterity: 15, constitution: 12, intelligence: 10, wisdom: 14, charisma: 9 },
    hitDie: 'd8',
    proficiencies: ['Simple weapons', 'Shortswords'],
    features: ['Martial Arts: Strike with fluid precision.', 'Ki: Channel inner energy for flurries, defense, or agility.'],
    description: 'Monks master body and spirit through relentless discipline. Every breath is a mantra.'
  },
  Paladin: {
    className: 'Paladin',
    stats: { strength: 14, dexterity: 10, constitution: 13, intelligence: 9, wisdom: 12, charisma: 15 },
    hitDie: 'd10',
    proficiencies: ['All armor', 'Shields', 'Simple weapons', 'Martial weapons'],
    features: ['Lay on Hands: Heal with divine grace.', 'Divine Smite: Empower weapon strikes with radiant force.'],
    description: 'Paladins swear oaths to defend hope. Their resolve shines brightest when the night is longest.'
  },
  Ranger: {
    className: 'Ranger',
    stats: { strength: 11, dexterity: 15, constitution: 12, intelligence: 10, wisdom: 14, charisma: 9 },
    hitDie: 'd10',
    proficiencies: ['Light armor', 'Medium armor', 'Shields', 'Simple weapons', 'Martial weapons'],
    features: ['Favored Enemy: Track and outwit chosen foes.', 'Spellcasting: Wield nature-touched tactics.'],
    description: 'Rangers walk the border between civilization and wilds. They hunt with empathy and precision.'
  },
  Rogue: {
    className: 'Rogue',
    stats: { strength: 9, dexterity: 15, constitution: 12, intelligence: 13, wisdom: 11, charisma: 12 },
    hitDie: 'd8',
    proficiencies: ['Light armor', 'Simple weapons', 'Hand crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
    features: ['Sneak Attack: Exploit openings for devastating strikes.', 'Cunning Action: Reposition swiftly every turn.'],
    description: 'Rogues thrive on wit and timing. They trade brute force for finesse and guile.'
  },
  Sorcerer: {
    className: 'Sorcerer',
    stats: { strength: 8, dexterity: 12, constitution: 13, intelligence: 11, wisdom: 10, charisma: 15 },
    hitDie: 'd6',
    proficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light crossbows'],
    features: ['Font of Magic: Shape spell slots into metamagic fuel.', 'Metamagic: Warp spells to suit the moment.'],
    description: 'Sorcerers wield magic born within. Their personalities are as volatile as their spells.'
  },
  Warlock: {
    className: 'Warlock',
    stats: { strength: 9, dexterity: 12, constitution: 13, intelligence: 11, wisdom: 10, charisma: 15 },
    hitDie: 'd8',
    proficiencies: ['Light armor', 'Simple weapons'],
    features: ['Eldritch Blast: Signature arcane assault.', 'Pact Magic: Bargain-born spells fueled by patrons.'],
    description: 'Warlocks broker pacts with enigmatic patrons. Their power is tinged with otherworldly whispers.'
  },
  Wizard: {
    className: 'Wizard',
    stats: { strength: 8, dexterity: 12, constitution: 12, intelligence: 15, wisdom: 14, charisma: 10 },
    hitDie: 'd6',
    proficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light crossbows'],
    features: ['Arcane Recovery: Regain expended magic after rest.', 'Spellbook: Record and prepare a vast array of spells.'],
    description: 'Wizards are scholarly arcanists whose spellbooks are diaries of discovery.'
  }
}

const DEFAULT_UNLOCK_LEVELS = [1, 3, 5, 7, 9]

const normalizeNameFromFeature = (text: string, index: number) => {
  const [name] = text.split(':')
  const safeName = name?.trim()
  if (safeName && safeName.length <= 60) {
    return safeName
  }
  return `Feature ${index + 1}`
}

const parseRequirementTokens = (tokenText: string) => {
  const requirements: {
    level?: number
    equipment?: string[]
    artifact?: string[]
  } = {}

  tokenText.split(',').map(part => part.trim()).forEach(part => {
    const lower = part.toLowerCase()
    if (lower.startsWith('level')) {
      const numeric = parseInt(part.replace(/\D/g, ''), 10)
      if (!Number.isNaN(numeric)) {
        requirements.level = numeric
      }
    } else if (lower.startsWith('equipment')) {
      const items = part.split(':')[1]?.split('|').map(item => item.trim()).filter(Boolean)
      if (items?.length) {
        requirements.equipment = items
      }
    } else if (lower.startsWith('artifact')) {
      const items = part.split(':')[1]?.split('|').map(item => item.trim()).filter(Boolean)
      if (items?.length) {
        requirements.artifact = items
      }
    }
  })

  return requirements
}

const buildAbilityDeck = (classData: CustomClassResponse): CharacterAbility[] => {
  return classData.features.map((feature, index) => {
    const requirementMatch = feature.match(/\[Requires:(.+?)\]/i)
    const requirements = requirementMatch ? parseRequirementTokens(requirementMatch[1]) : {}
    const description = requirementMatch ? feature.replace(requirementMatch[0], '').trim() : feature.trim()
    const name = normalizeNameFromFeature(description, index)
    const unlockLevel = requirements.level || DEFAULT_UNLOCK_LEVELS[Math.min(index, DEFAULT_UNLOCK_LEVELS.length - 1)]

    return {
      id: `${classData.className.toLowerCase().replace(/\s+/g, '-')}-${index}`,
      name,
      description,
      unlockLevel,
      requiresEquipment: requirements.equipment,
      requiresArtifact: requirements.artifact
    }
  })
}

const computeResources = (classData?: CustomClassResponse) => {
  if (!classData) {
    return { hp: 24, mp: 16 }
  }

  const hitDieValue = Number(classData.hitDie?.replace('d', '')) || 8
  const hp = Math.max(1, hitDieValue + (classData.stats.constitution || 10))
  const mp = Math.max(
    8,
    Math.round(
      ((classData.stats.intelligence || 10) +
        (classData.stats.wisdom || 10) +
        (classData.stats.charisma || 10)) / 3
    )
  )

  return { hp, mp }
}

const CharacterCreation = () => {
  const navigate = useNavigate()
  const [currentStage, setCurrentStage] = useState<Stage>('name')
  const [characterData, setCharacterData] = useState<CharacterData>({
    name: '',
    class: '',
    classDescription: '',
    backstory: '',
    appearance: '',
    abilityDeck: []
  })
  const [characterId, setCharacterId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(CHARACTER_ID_KEY)
  })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarStatus, setAvatarStatus] = useState<'pending' | 'ready' | 'failed' | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [isSavingAppearance, setIsSavingAppearance] = useState(false)
  const [isCustomClass, setIsCustomClass] = useState(false)
  const [isGeneratingClass, setIsGeneratingClass] = useState(false)
  const [classGenerationError, setClassGenerationError] = useState<string | null>(null)
  const [showFullLore, setShowFullLore] = useState(false)
  const [showMoreInfo, setShowMoreInfo] = useState(false)

  const handleNext = async () => {
    const currentIndex = STAGES.indexOf(currentStage)
    if (currentStage === 'appearance') {
      setIsSavingAppearance(true)
      try {
        const response = await saveCharacterAppearance({
          characterId,
          appearance: characterData.appearance,
          name: characterData.name,
          class: characterData.class,
          classDescription: characterData.classDescription,
          backstory: characterData.backstory
        })
        setCharacterId(response.id)
        setAvatarUrl(response.avatarUrl ?? null)
        setAvatarStatus(response.avatarStatus ?? null)
        setAvatarError(response.avatarError ?? null)
        if (typeof window !== 'undefined') {
          localStorage.setItem(CHARACTER_ID_KEY, response.id)
        }
      } catch (error) {
        console.error('Failed to save appearance:', error)
      } finally {
        setIsSavingAppearance(false)
      }
    }
    if (currentIndex < STAGES.length - 1) {
      setCurrentStage(STAGES[currentIndex + 1])
    }
  }

  const handleBack = () => {
    const currentIndex = STAGES.indexOf(currentStage)
    if (currentIndex > 0) {
      setCurrentStage(STAGES[currentIndex - 1])
    }
  }

  const handleFinish = () => {
    const selectedClassData = characterData.customClassData

    if (!selectedClassData) {
      setCurrentStage('class')
      setClassGenerationError('Please select or generate a class before finishing.')
      return
    }

    const abilityDeck = characterData.abilityDeck || buildAbilityDeck(selectedClassData)

    const payload = {
      ...characterData,
      class: selectedClassData.className,
      customClassData: selectedClassData,
      abilityDeck,
      quests: [],
      xp: 0,
      level: 1,
      equipment: [] as string[],
      artifacts: [] as string[],
      isCustomClass,
      resources: computeResources(selectedClassData),
      avatarUrl,
      avatarStatus,
      avatarError,
      characterId
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(payload))
      } catch (error) {
        console.error('Failed to store character profile:', error)
      }
    }

    navigate('/campaign-hub')
  }

  const handleRegenerateAvatar = async () => {
    if (!characterId) return
    setIsSavingAppearance(true)
    try {
      const response = await saveCharacterAppearance({
        characterId,
        appearance: characterData.appearance,
        name: characterData.name,
        class: characterData.class,
        classDescription: characterData.classDescription,
        backstory: characterData.backstory,
        forceRegenerate: true,
        regenNonce: Date.now()
      })
      setAvatarUrl(response.avatarUrl ?? null)
      setAvatarStatus(response.avatarStatus ?? null)
      setAvatarError(response.avatarError ?? null)
    } catch (error) {
      console.error('Failed to regenerate avatar:', error)
    } finally {
      setIsSavingAppearance(false)
    }
  }

  const updateCharacterData = (
    field: keyof CharacterData,
    value: string | CustomClassResponse | CharacterAbility[] | number | undefined
  ) => {
    setCharacterData(prev => ({ ...prev, [field]: value }))
  }


  const handleModeChange = (custom: boolean) => {
    setIsCustomClass(custom)
    setShowFullLore(false)
    setShowMoreInfo(false)
    setClassGenerationError(null)
    setCharacterData(prev => {
      if (custom) {
        return {
          ...prev,
          class: '',
          customClassData: undefined,
          abilityDeck: undefined
        }
      }
      const preset = prev.class && CLASS_PRESETS[prev.class] ? CLASS_PRESETS[prev.class] : undefined
      return {
        ...prev,
        customClassData: preset,
        abilityDeck: preset ? buildAbilityDeck(preset) : undefined
      }
    })
  }

  const handleSelectStandardClass = (className: string) => {
    const preset = CLASS_PRESETS[className]
    updateCharacterData('class', className)
    if (preset) {
      updateCharacterData('customClassData', preset)
      updateCharacterData('abilityDeck', buildAbilityDeck(preset))
      setShowFullLore(false)
      setShowMoreInfo(false)
      setClassGenerationError(null)
    }
  }

  const handleGenerateCustomClass = async () => {
    if (!characterData.classDescription?.trim()) {
      setClassGenerationError('Please enter a class description first')
      return
    }

    setIsGeneratingClass(true)
    setClassGenerationError(null)

    try {
      const classData = await generateCustomClass(characterData.classDescription)
      updateCharacterData('customClassData', classData)
      updateCharacterData('abilityDeck', buildAbilityDeck(classData))
      updateCharacterData('class', classData.className)
      setShowFullLore(false)
      setShowMoreInfo(false)
    } catch (error: any) {
      console.error('Error generating custom class:', error)
      const errorMessage = error?.message || 'Failed to generate custom class. Please try again.'
      setClassGenerationError(errorMessage)
      console.error('Full error details:', error)
    } finally {
      setIsGeneratingClass(false)
    }
  }

  const activeClassData = characterData.customClassData
  const resolvedAvatarUrl =
    avatarUrl && avatarUrl.startsWith('http') ? avatarUrl : avatarUrl ? `${API_ORIGIN}${avatarUrl}` : null

  const shouldPollAvatar =
    currentStage === 'review' && Boolean(characterId) && !avatarUrl && avatarStatus !== 'failed'

  useEffect(() => {
    if (!shouldPollAvatar || !characterId) {
      return undefined
    }
    let cancelled = false
    let intervalId: number | null = null

    const fetchAvatar = async () => {
      try {
        const response = await getCharacter(characterId)
        if (cancelled) return
        setAvatarUrl(response.avatarUrl ?? null)
        setAvatarStatus(response.avatarStatus ?? null)
        setAvatarError(response.avatarError ?? null)
        if (response.avatarUrl || response.avatarStatus === 'failed') {
          if (intervalId) {
            window.clearInterval(intervalId)
            intervalId = null
          }
        }
      } catch (error) {
        console.error('Failed to poll avatar:', error)
        if (intervalId) {
          window.clearInterval(intervalId)
          intervalId = null
        }
      }
    }

    void fetchAvatar()
    intervalId = window.setInterval(fetchAvatar, 2500)

    return () => {
      cancelled = true
      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [avatarStatus, avatarUrl, characterId, currentStage, shouldPollAvatar])

  const previewDescription = useMemo(() => {
    if (!activeClassData?.description) {
      return ''
    }
    if (showFullLore) {
      return activeClassData.description
    }
    const paragraphs = activeClassData.description
      .split('\n')
      .map(part => part.trim())
      .filter(Boolean)
    return paragraphs.slice(0, 2).join('\n\n')
  }, [activeClassData, showFullLore])

  const renderStage = () => {
    switch (currentStage) {
      case 'name':
        return (
          <div className="stage-content">
            <h2>Character Name</h2>
            <p className="stage-description">What is your character's name?</p>
            <input
              type="text"
              placeholder="Enter character name"
              value={characterData.name}
              onChange={(e) => updateCharacterData('name', e.target.value)}
              className="stage-input"
            />
          </div>
        )

      case 'class':
        return (
          <div className="stage-content">
            <h2>Character Class</h2>
            <p className="stage-description">
              Choose a class from the list, or create a custom class with AI assistance
            </p>
            <div className="class-stage-grid">
              <div className="class-panel selection-panel">
                <div className="class-toggle">
                  <button
                    className={!isCustomClass ? 'active' : ''}
                    onClick={() => handleModeChange(false)}
                  >
                    Standard Classes
                  </button>
                  <button
                    className={isCustomClass ? 'active' : ''}
                    onClick={() => handleModeChange(true)}
                  >
                    Custom Class (AI)
                  </button>
                </div>

                {!isCustomClass ? (
                  <div className="class-grid">
                    {VANILLA_CLASSES.map((className) => (
                      <button
                        key={className}
                        className={`class-option ${characterData.class === className ? 'selected' : ''}`}
                        onClick={() => handleSelectStandardClass(className)}
                      >
                        {className}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="custom-class-input">
                    <textarea
                      placeholder="Describe your custom class. The AI will create stats, lore, and abilities based on D&D 5e rules..."
                      value={characterData.classDescription || ''}
                      onChange={(e) => {
                        updateCharacterData('classDescription', e.target.value)
                        setClassGenerationError(null)
                      }}
                      className="stage-textarea"
                      rows={6}
                      disabled={isGeneratingClass}
                    />
                    <p className="hint-text">
                      Example: "A shadow mage who phases through walls and binds foes with starless chains."
                    </p>
                    <button
                      className="generate-class-btn"
                      onClick={handleGenerateCustomClass}
                      disabled={isGeneratingClass || !characterData.classDescription?.trim()}
                    >
                      {isGeneratingClass ? 'Generating...' : 'Generate Class with AI'}
                    </button>
                    {classGenerationError && (
                      <p className="error-text">{classGenerationError}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="class-panel info-panel">
                {activeClassData ? (
                  <div className="class-info-card">
                    <div className="class-info-header">
                      <div>
                        <p className="class-info-label">Selected Class</p>
                        <h3 className="class-info-title">{activeClassData.className}</h3>
                      </div>
                      <div className="class-info-badge">
                        Hit Die: {activeClassData.hitDie || 'd8'}
                      </div>
                    </div>

                    <div className="class-stats-grid">
                      {Object.entries(activeClassData.stats).map(([stat, value]) => (
                        <div className="stat-display" key={stat}>
                          <span className="stat-name">{stat.slice(0, 3).toUpperCase()}</span>
                          <span className="stat-value">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="class-description-card">
                      <p className="class-description">{previewDescription || 'This class is waiting to be described.'}</p>
                      {activeClassData.description && (
                        <button
                          className="lore-toggle"
                          onClick={() => setShowFullLore(prev => !prev)}
                        >
                          {showFullLore ? 'Hide Lore' : 'Show Full Lore'}
                        </button>
                      )}
                    </div>

                    <div className="class-info-actions">
                      <button
                        className="details-toggle"
                        onClick={() => setShowMoreInfo(prev => !prev)}
                      >
                        {showMoreInfo ? 'Hide Details' : 'Show Details'}
                      </button>
                    </div>

                    {showMoreInfo && (
                      <div className="class-info-details">
                        <div>
                          <strong>Proficiencies</strong>
                          {activeClassData.proficiencies.length ? (
                            <ul>
                              {activeClassData.proficiencies.map((prof, idx) => (
                                <li key={idx}>{prof}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>No proficiencies listed.</p>
                          )}
                        </div>
                        <div>
                          <strong>Features & Abilities</strong>
                          {activeClassData.features.length ? (
                            <ul>
                              {activeClassData.features.map((feature, idx) => (
                                <li key={idx}>{feature}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>No features recorded yet.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="preview-placeholder">
                    <p>Select a class or generate one with AI to preview its stats, lore, and abilities.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case 'backstory':
        return (
          <div className="stage-content">
            <h2>Character Backstory</h2>
            <p className="stage-description">Tell us about your character's past and motivations</p>
            <textarea
              placeholder="Write your character's backstory..."
              value={characterData.backstory}
              onChange={(e) => updateCharacterData('backstory', e.target.value)}
              className="stage-textarea"
              rows={10}
            />
          </div>
        )

      case 'appearance':
        return (
          <div className="stage-content">
            <h2>Character Appearance</h2>
            <p className="stage-description">
              Describe how your character looks. We will infer details automatically.
            </p>
            <textarea
              placeholder="Describe your character's appearance..."
              value={characterData.appearance}
              onChange={(e) => updateCharacterData('appearance', e.target.value)}
              className="stage-textarea"
              rows={8}
            />
          </div>
        )

      case 'review':
        return (
          <div className="stage-content review-stage">
            <h2>Character Review</h2>
            <p className="stage-description">Review your character and make any final adjustments</p>
            
            <div className="review-sections">
              <div className="review-section">
                <h3>Avatar</h3>
                <div className="review-avatar">
                  {resolvedAvatarUrl ? (
                    <img src={resolvedAvatarUrl} alt={`${characterData.name || 'Character'} avatar`} />
                  ) : (
                    <div className="avatar-placeholder">
                      {avatarStatus === 'failed'
                        ? 'Avatar generation failed'
                        : 'Generating avatar...'}
                    </div>
                  )}
                </div>
                <button
                  className="nav-btn next-btn"
                  type="button"
                  onClick={handleRegenerateAvatar}
                  disabled={isSavingAppearance}
                >
                  {isSavingAppearance ? 'Regenerating...' : 'Regenerate Avatar'}
                </button>
                {avatarStatus === 'failed' && avatarError && (
                  <p className="avatar-error">{avatarError}</p>
                )}
              </div>
              <div className="review-section">
                <h3>Name</h3>
                <input
                  type="text"
                  value={characterData.name}
                  onChange={(e) => updateCharacterData('name', e.target.value)}
                  className="review-input"
                />
              </div>

              <div className="review-section">
                <h3>Class</h3>
                {characterData.customClassData ? (
                  <div>
                    <p className="review-value">{characterData.customClassData.className}</p>
                    <p className="review-label">Description:</p>
                    <p className="review-text">{characterData.customClassData.description}</p>
                    <div className="review-stats">
                      <div className="review-stats-grid">
                        {Object.entries(characterData.customClassData.stats).map(([stat, value]) => (
                          <div key={stat} className="review-stat-card">
                            <span className="review-stat-name">{STAT_LABELS[stat] || stat}</span>
                            <div className="review-stat-value">{value}</div>
                            <div className="review-stat-bonus">{formatStatBonus(Number(value))}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p><strong>Hit Die:</strong> {characterData.customClassData.hitDie}</p>
                  </div>
                ) : isCustomClass && characterData.classDescription ? (
                  <div>
                    <p className="review-label">Custom Class Description:</p>
                    <textarea
                      value={characterData.classDescription}
                      onChange={(e) => updateCharacterData('classDescription', e.target.value)}
                      className="review-textarea"
                      rows={4}
                    />
                    <p className="hint-text">Generate the class to see stats and features</p>
                  </div>
                ) : (
                  <p className="review-value">{characterData.class || 'Not selected'}</p>
                )}
              </div>

              <div className="review-section">
                <h3>Backstory</h3>
                <textarea
                  value={characterData.backstory}
                  onChange={(e) => updateCharacterData('backstory', e.target.value)}
                  className="review-textarea"
                  rows={6}
                />
              </div>

              <div className="review-section">
                <h3>Appearance</h3>
                <textarea
                  value={characterData.appearance}
                  onChange={(e) => updateCharacterData('appearance', e.target.value)}
                  className="review-textarea"
                  rows={5}
                />
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const canProceed = () => {
    switch (currentStage) {
      case 'name':
        return characterData.name.trim().length > 0
      case 'class':
        return isCustomClass 
          ? (characterData.classDescription?.trim().length || 0) > 0
          : characterData.class.length > 0
      case 'backstory':
        return characterData.backstory.trim().length > 0
      case 'appearance':
        return characterData.appearance.trim().length > 0
      case 'review':
        return true
      default:
        return false
    }
  }

  const stageIndex = STAGES.indexOf(currentStage)

  return (
    <div className="character-creation">
      <div className="creation-container">
        <div className="progress-bar">
          {STAGES.map((stage, index) => (
            <div
              key={stage}
              className={`progress-step ${index <= stageIndex ? 'completed' : ''} ${index === stageIndex ? 'current' : ''}`}
            >
              <div className="step-number">{index + 1}</div>
              <div className="step-label">{stage.charAt(0).toUpperCase() + stage.slice(1)}</div>
            </div>
          ))}
        </div>

        <div className="stage-container">
          {renderStage()}
        </div>

        <div className="navigation-buttons">
          {stageIndex > 0 && (
            <button className="nav-btn back-btn" onClick={handleBack}>
              Back
            </button>
          )}
          <div className="spacer" />
          {stageIndex < STAGES.length - 1 ? (
          <button
            className="nav-btn next-btn"
            onClick={handleNext}
            disabled={!canProceed() || isSavingAppearance}
          >
            {isSavingAppearance ? 'Saving...' : 'Next'}
          </button>
          ) : (
            <button
              className="nav-btn finish-btn"
              onClick={handleFinish}
              disabled={!canProceed()}
            >
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CharacterCreation

