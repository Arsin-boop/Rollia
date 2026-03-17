import { useNavigate, useLocation } from 'react-router-dom'

interface GrimoireHeaderProps {
  centerText?: string
  rightSlot?: React.ReactNode
  showNav?: boolean
}

export function GrimoireHeader({
  centerText,
  rightSlot,
  showNav = true,
}: GrimoireHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="g-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          className="g-header-logo"
          onClick={() => navigate('/')}
          role="link"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') navigate('/') }}
          aria-label="Go to home"
        >
          Rol<span className="g-header-logo-accent">l</span>ia
        </span>

        {centerText && (
          <>
            <div style={{ width: 1, height: 20, background: 'rgba(200,165,74,0.3)' }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              fontFamily: 'var(--g-font-title)',
              fontSize: 9,
              letterSpacing: '0.22em',
              color: '#c8a54a',
              textTransform: 'uppercase',
            }}>
              <div className="g-pulse-dot" />
              <span>{centerText}</span>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {showNav && (
          <>
            <button
              className={`g-nav-btn${isActive('/characters') ? ' g-nav-btn-active' : ''}`}
              onClick={() => navigate('/characters')}
            >
              Characters
            </button>
            <button
              className={`g-nav-btn${isActive('/sessions') ? ' g-nav-btn-active' : ''}`}
              onClick={() => navigate('/sessions')}
            >
              Sessions
            </button>
          </>
        )}
        {rightSlot}
      </div>
    </header>
  )
}
