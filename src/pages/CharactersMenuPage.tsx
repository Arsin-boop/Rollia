import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { StarryBackground } from '../components/StarryBackground'
import { deleteCharacterFromDB, getCharactersFromDB, type CharacterRecord } from '../utils/api'

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
    const handleStorage = () => {
      void refresh()
    }
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

  return (
    <div className="size-full flex items-center justify-center bg-[#1C1B22] relative overflow-hidden py-8">
      <StarryBackground />
      <div className="w-full max-w-4xl rounded-xl border border-[#6C5CE7]/30 bg-slate-800/45 p-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl text-white font-semibold">Characters</h1>
          <button
            type="button"
            className="text-sm px-3 py-2 rounded-md bg-[#6C5CE7]/20 text-[#d8d2ff] hover:bg-[#6C5CE7]/35"
            onClick={() => navigate('/character/name')}
          >
            Create Character
          </button>
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
          {characters.length === 0 && (
            <p className="text-[#B8BCC8] text-sm">No saved characters yet.</p>
          )}
          {characters.map(character => (
            <article
              key={character.id}
              className="rounded-lg border border-[#6C5CE7]/25 bg-[#23222a]/80 px-3 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{character.name || 'Unnamed Hero'}</p>
                <p className="text-xs text-[#B8BCC8] truncate">{character.class || 'Adventurer'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className={`text-xs px-2.5 py-1.5 rounded-md ${
                    activeCharacterId === character.id
                      ? 'bg-[#C6A75E]/85 text-[#1C1B22]'
                      : 'bg-[#6C5CE7]/20 text-[#d8d2ff] hover:bg-[#6C5CE7]/35'
                  }`}
                  onClick={() => selectCharacter(character.id)}
                >
                  {activeCharacterId === character.id ? 'Selected' : 'Select'}
                </button>
                <button
                  type="button"
                  className="p-1.5 rounded-md text-[#f6b1b1] hover:bg-[#8C2F2F]/30"
                  onClick={() => deleteCharacter(character.id)}
                  aria-label={`Delete ${character.name || 'character'}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
