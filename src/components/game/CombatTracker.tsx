import type { CombatState } from '../../utils/api'

interface Props {
  combatState: CombatState
}

export function CombatTracker({ combatState }: Props) {
  const { entities, initiative_order, turn_index, round, phase } = combatState

  // Sort by initiative order if available, otherwise player first
  const sorted = initiative_order.length > 0
    ? initiative_order
        .map(id => entities.find(e => e.id === id))
        .filter((e): e is NonNullable<typeof e> => !!e)
    : [...entities].sort((a, b) => (a.type === 'player' ? -1 : b.type === 'player' ? 1 : 0))

  const activeId = initiative_order[turn_index] ?? null

  return (
    <div style={{ marginTop: 8 }}>
      <div className="g-divider" style={{ marginBottom: 8 }}>
        <span className="g-divider-icon" style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--g-blood2, #a81c30)' }}>
          ⚔ COMBAT — R{round}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {sorted.map((entity, i) => {
          const isActive = entity.id === activeId
          const isDead = entity.hp <= 0
          const hpPct = entity.hp_max > 0 ? Math.max(0, (entity.hp / entity.hp_max) * 100) : 0
          const barColor = entity.type === 'player'
            ? 'var(--g-moss2, #4a9c6a)'
            : hpPct > 50 ? 'var(--g-gold-dim, #9e7e36)' : hpPct > 25 ? '#c0512a' : 'var(--g-blood2, #a81c30)'

          return (
            <div
              key={entity.id}
              style={{
                padding: '5px 8px',
                background: isActive ? 'rgba(200,165,74,0.07)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? 'rgba(200,165,74,0.3)' : 'rgba(255,255,255,0.05)'}`,
                clipPath: 'polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))',
                opacity: isDead ? 0.4 : 1,
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <span style={{
                  fontFamily: 'var(--g-font-title)',
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  color: isActive ? 'var(--g-gold)' : 'var(--g-parch-dim)',
                  minWidth: 14,
                  textAlign: 'center'
                }}>
                  {i + 1}
                </span>
                <span style={{
                  fontFamily: 'var(--g-font-title)',
                  fontSize: 11,
                  color: isDead ? 'rgba(168,28,48,0.6)' : isActive ? 'var(--g-gold)' : 'var(--g-parch-dim)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {isDead ? '✝ ' : isActive ? '▶ ' : ''}{entity.name}
                </span>
                <span style={{
                  fontFamily: 'var(--g-font-body)',
                  fontSize: 11,
                  color: 'var(--g-parch-faint)'
                }}>
                  {entity.hp}/{entity.hp_max}
                </span>
              </div>

              {/* HP bar */}
              <div style={{
                height: 3,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 1,
                overflow: 'hidden',
                marginLeft: 19
              }}>
                <div style={{
                  height: '100%',
                  width: `${hpPct}%`,
                  background: barColor,
                  transition: 'width 0.4s ease',
                  boxShadow: `0 0 4px ${barColor}66`
                }} />
              </div>

              {/* Statuses */}
              {entity.statuses.length > 0 && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3, marginLeft: 19 }}>
                  {entity.statuses.map((s, j) => (
                    <span
                      key={j}
                      style={{
                        fontFamily: 'var(--g-font-title)',
                        fontSize: 8,
                        letterSpacing: '0.08em',
                        padding: '1px 4px',
                        background: 'rgba(168,28,48,0.15)',
                        border: '1px solid rgba(168,28,48,0.3)',
                        color: 'var(--g-blood2, #a81c30)'
                      }}
                    >
                      {s.key}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {phase === 'ended' && (
        <div style={{
          marginTop: 6,
          textAlign: 'center',
          fontFamily: 'var(--g-font-title)',
          fontSize: 9,
          letterSpacing: '0.15em',
          color: 'var(--g-moss2, #4a9c6a)',
          textTransform: 'uppercase'
        }}>
          ✦ Combat ended ✦
        </div>
      )}
    </div>
  )
}
