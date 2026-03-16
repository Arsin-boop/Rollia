import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { deleteCharacterFromDB, getCharactersFromDB, type CharacterRecord } from '../utils/api'
import { GrimoirePage } from '../components/grimoire/GrimoirePage'
import { GrimoireHeader } from '../components/grimoire/GrimoireHeader'

const CHARACTER_KEY = 'character'
const LEGACY_CHARACTER_KEY = 'dnd-ai-character'
const CHARACTER_COLLECTION_KEY = 'rollia_characters_v1'

type StoredCharacter = {
  id: string
  name?: string
  class?: string
  updatedAt?: string
  activeCampaignId?: string | null
  [key: string]: unknown
}

const parseStored = (raw: string | null) => {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const readCharacters = (): StoredCharacter[] => {
  const list = parseStored(localStorage.getItem(CHARACTER_COLLECTION_KEY))
  const normalized = Array.isArray(list) ? list.filter(Boolean) : []
  const primary = parseStored(localStorage.getItem(CHARACTER_KEY))
  const legacy = parseStored(localStorage.getItem(LEGACY_CHARACTER_KEY))
  const current = (primary || legacy) as StoredCharacter | null
  if (!current || typeof current !== 'object' || !current.id) {
    return normalized as StoredCharacter[]
  }
  const next = [...normalized]
  const index = next.findIndex((entry: StoredCharacter) => entry.id === current.id)
  if (index >= 0) {
    next[index] = { ...next[index], ...current }
  } else {
    next.unshift(current)
  }
  localStorage.setItem(CHARACTER_COLLECTION_KEY, JSON.stringify(next))
  return next as StoredCharacter[]
}

export default function CharactersMenuPage() {
  const navigate = useNavigate()
  const [characters, setCharacters] = useState<StoredCharacter[]>([])

  const normalizeFromDb = (items: CharacterRecord[]): StoredCharacter[] => {
    return items.map(item => ({
      ...item,
      name: item.name || 'Unnamed Hero',
      class: item.class || 'Adventurer'
    }))
  }

  const refresh = useCallback(async () => {
    try {
      const fromDb = normalizeFromDb(await getCharactersFromDB())
      setCharacters(fromDb)
      localStorage.setItem(CHARACTER_COLLECTION_KEY, JSON.stringify(fromDb))
    } catch (error) {
      console.warn('Failed to load characters from DB, using local storage fallback:', error)
      setCharacters(readCharacters())
    }
  }, [])

  useEffect(() => {
    void refresh()
    const handleStorage = () => { void refresh() }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [refresh])

  const activeCharacterId = useMemo(() => {
    const current = parseStored(localStorage.getItem(CHARACTER_KEY)) as StoredCharacter | null
    return current?.id || null
  }, [characters])

  const selectCharacter = (characterId: string) => {
    const selected = characters.find(entry => entry.id === characterId)
    if (!selected) return
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(selected))
    localStorage.setItem(LEGACY_CHARACTER_KEY, JSON.stringify(selected))
    refresh()
  }

  const deleteCharacter = (characterId: string) => {
    const next = characters.filter(entry => entry.id !== characterId)
    localStorage.setItem(CHARACTER_COLLECTION_KEY, JSON.stringify(next))
    const current = parseStored(localStorage.getItem(CHARACTER_KEY)) as StoredCharacter | null
    if (current?.id === characterId) {
      if (next[0]) {
        localStorage.setItem(CHARACTER_KEY, JSON.stringify(next[0]))
        localStorage.setItem(LEGACY_CHARACTER_KEY, JSON.stringify(next[0]))
      } else {
        localStorage.removeItem(CHARACTER_KEY)
        localStorage.removeItem(LEGACY_CHARACTER_KEY)
      }
    }
    refresh()
    deleteCharacterFromDB(characterId).catch(error => {
      console.warn('Failed to delete character from DB:', error)
    })
  }

  const createButton = (
    <button
      className="g-btn-secondary"
      style={{ fontSize: 8, padding: '6px 16px' }}
      onClick={() => navigate('/character/name')}
    >
      ✦ Summon New
    </button>
  )

  return (
    <GrimoirePage emberCount={80}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <GrimoireHeader centerText="Codex of Heroes" rightSlot={createButton} showNav />

        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '32px 24px',
          overflowY: 'auto',
        }}>
          <div
            className="g-panel g-anim-fade-up"
            style={{
              width: '100%',
              maxWidth: 640,
              clipPath: 'var(--g-clip-lg)',
            }}
          >
            {/* Panel header */}
            <div className="g-panel-section" style={{ padding: '16px 20px 12px' }}>
              <div className="g-ornament" style={{ marginBottom: 10 }}>
                <div className="g-ornament-line" />
                <div className="g-ornament-diamond" />
                <span className="g-ornament-text">Bound Souls</span>
                <div className="g-ornament-diamond" />
                <div className="g-ornament-line" />
              </div>
              <p className="g-section-title" style={{ marginBottom: 0, borderBottom: 'none' }}>
                {characters.length} {characters.length === 1 ? 'soul' : 'souls'} recorded
              </p>
            </div>

            {/* Character list */}
            <div
              className="g-scroll"
              style={{
                maxHeight: 'calc(100vh - 220px)',
                overflowY: 'auto',
                padding: '8px 0',
              }}
            >
              {characters.length === 0 && (
                <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                  <p className="g-body-italic" style={{ fontSize: 16 }}>
                    No souls have been bound yet.<br />Summon your first hero to begin.
                  </p>
                </div>
              )}

              {characters.map((character, i) => {
                const isActive = activeCharacterId === character.id
                return (
                  <div
                    key={character.id}
                    className={`g-card g-anim-fade-up ${isActive ? 'g-card-active' : ''}`}
                    style={{
                      margin: '6px 16px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      animationDelay: `${i * 0.06}s`,
                      opacity: 0,
                    }}
                    onClick={() => selectCharacter(character.id)}
                  >
                    {/* Character info */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p className="g-title" style={{ fontSize: 14, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {character.name || 'Unnamed Hero'}
                      </p>
                      <p className="g-label" style={{ fontSize: 7 }}>
                        {character.class || 'Adventurer'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        className="g-btn-sm"
                        style={isActive ? {
                          borderColor: 'var(--g-gold)',
                          color: 'var(--g-gold)',
                          background: 'rgba(200,165,74,0.08)',
                        } : {}}
                        onClick={() => selectCharacter(character.id)}
                      >
                        {isActive ? '✦ Chosen' : 'Select'}
                      </button>
                      <button
                        type="button"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--g-blood2)',
                          opacity: 0.7,
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'var(--g-transition)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
                        onClick={() => deleteCharacter(character.id)}
                        aria-label={`Delete ${character.name || 'character'}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </GrimoirePage>
  )
}
