import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, ScrollText } from 'lucide-react'
import { deleteSessionFromDB } from '../utils/api'
import { GrimoirePage } from '../components/grimoire/GrimoirePage'
import { GrimoireHeader } from '../components/grimoire/GrimoireHeader'

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
    deleteSessionFromDB(sessionId).catch(error => {
      console.warn('Failed to delete session from DB:', error)
    })
  }

  const createButton = (
    <button
      className="g-btn-secondary"
      style={{ fontSize: 8, padding: '6px 16px' }}
      onClick={() => navigate('/session/create')}
    >
      ◈ New Chronicle
    </button>
  )

  return (
    <GrimoirePage emberCount={80}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <GrimoireHeader centerText="Chronicle of Campaigns" rightSlot={createButton} showNav />

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
                <span className="g-ornament-text">Active Chronicles</span>
                <div className="g-ornament-diamond" />
                <div className="g-ornament-line" />
              </div>
              <p className="g-section-title" style={{ marginBottom: 0, borderBottom: 'none' }}>
                {sessions.length} {sessions.length === 1 ? 'chronicle' : 'chronicles'} found
              </p>
            </div>

            {/* Session list */}
            <div
              className="g-scroll"
              style={{
                maxHeight: 'calc(100vh - 220px)',
                overflowY: 'auto',
                padding: '8px 0',
              }}
            >
              {sessions.length === 0 && (
                <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                  <p className="g-body-italic" style={{ fontSize: 16 }}>
                    No chronicles have been written.<br />Begin a new campaign to forge your legend.
                  </p>
                </div>
              )}

              {sessions.map((session, i) => (
                <div
                  key={session.id}
                  className="g-card g-anim-fade-up"
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
                  onClick={() => openSession(session.id)}
                >
                  {/* Session info */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="g-title" style={{ fontSize: 14, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {session.name || `Campaign ${session.id}`}
                    </p>
                    <p className="g-label" style={{ fontSize: 7, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {session.characterName ? (
                        <>
                          <ScrollText size={9} style={{ opacity: 0.6 }} />
                          {session.characterName}
                        </>
                      ) : (
                        'No bound soul'
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      className="g-btn-primary"
                      style={{ fontSize: 8, padding: '6px 16px' }}
                      onClick={() => openSession(session.id)}
                    >
                      Continue
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
                      onClick={() => deleteSession(session.id)}
                      aria-label={`Delete ${session.name || 'session'}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </GrimoirePage>
  )
}
