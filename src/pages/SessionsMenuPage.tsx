import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, UserRound } from 'lucide-react'
import { StarryBackground } from '../components/StarryBackground'

const ACTIVE_CAMPAIGN_KEY = 'activeCampaignId'
const CHARACTER_KEY = 'character'
const LEGACY_CHARACTER_KEY = 'dnd-ai-character'
const CHARACTER_COLLECTION_KEY = 'rollia_characters_v1'
const CAMPAIGN_STATE_KEY_PREFIX = 'campaign_state_'

type StoredCharacter = {
  id: string
  name: string
  class: string
  [key: string]: unknown
}

type StoredSession = {
  id: string
  name: string
  description?: string
  createdAt?: string
  characterId?: string
  characterName?: string
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
  return Array.isArray(list) ? (list as StoredCharacter[]) : []
}

const readSessions = (): StoredSession[] => {
  const result: StoredSession[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key || !key.startsWith('session_')) continue
    const parsed = parseStored(localStorage.getItem(key))
    if (!parsed || typeof parsed !== 'object') continue
    result.push(parsed as StoredSession)
  }
  return result.sort((a, b) => {
    const aStamp = Date.parse(a.createdAt || '')
    const bStamp = Date.parse(b.createdAt || '')
    return (Number.isFinite(bStamp) ? bStamp : 0) - (Number.isFinite(aStamp) ? aStamp : 0)
  })
}

export default function SessionsMenuPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<StoredSession[]>([])
  const [characters, setCharacters] = useState<StoredCharacter[]>([])

  const refresh = useCallback(() => {
    setSessions(readSessions())
    setCharacters(readCharacters())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [refresh])

  const characterById = useMemo(() => {
    const map = new Map<string, StoredCharacter>()
    for (const character of characters) {
      map.set(character.id, character)
    }
    return map
  }, [characters])

  const openSession = (sessionId: string) => {
    const session = sessions.find(entry => entry.id === sessionId)
    if (session?.characterId) {
      const linked = characterById.get(session.characterId)
      if (linked) {
        localStorage.setItem(CHARACTER_KEY, JSON.stringify(linked))
        localStorage.setItem(LEGACY_CHARACTER_KEY, JSON.stringify(linked))
      }
    }
    localStorage.setItem(ACTIVE_CAMPAIGN_KEY, sessionId)
    navigate(`/game/${sessionId}`)
  }

  const deleteSession = (sessionId: string) => {
    localStorage.removeItem(`session_${sessionId}`)
    localStorage.removeItem(`${CAMPAIGN_STATE_KEY_PREFIX}${sessionId}`)
    if (localStorage.getItem(ACTIVE_CAMPAIGN_KEY) === sessionId) {
      localStorage.removeItem(ACTIVE_CAMPAIGN_KEY)
    }
    refresh()
  }

  return (
    <div className="size-full flex items-center justify-center bg-[#1C1B22] relative overflow-hidden py-8">
      <StarryBackground />
      <div className="w-full max-w-4xl rounded-xl border border-[#6C5CE7]/30 bg-slate-800/45 p-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl text-white font-semibold">Sessions</h1>
          <button
            type="button"
            className="text-sm px-3 py-2 rounded-md bg-[#6C5CE7]/20 text-[#d8d2ff] hover:bg-[#6C5CE7]/35"
            onClick={() => navigate('/session/create')}
          >
            Create Session
          </button>
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
          {sessions.length === 0 && (
            <p className="text-[#B8BCC8] text-sm">No sessions created yet.</p>
          )}
          {sessions.map(session => (
            <article
              key={session.id}
              className="rounded-lg border border-[#6C5CE7]/25 bg-[#23222a]/80 px-3 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{session.name || `Campaign ${session.id}`}</p>
                <p className="text-xs text-[#B8BCC8] truncate">
                  {session.characterName ? (
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3.5" />
                      {session.characterName}
                    </span>
                  ) : (
                    'No linked character'
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="text-xs px-2.5 py-1.5 rounded-md bg-[#C6A75E]/85 text-[#1C1B22] hover:bg-[#d7b96f]"
                  onClick={() => openSession(session.id)}
                >
                  Continue
                </button>
                <button
                  type="button"
                  className="p-1.5 rounded-md text-[#f6b1b1] hover:bg-[#8C2F2F]/30"
                  onClick={() => deleteSession(session.id)}
                  aria-label={`Delete ${session.name || 'session'}`}
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

