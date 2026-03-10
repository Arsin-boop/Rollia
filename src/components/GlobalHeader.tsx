import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import './GlobalHeader.css'

export function GlobalHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()
  const isGameRoute = location.pathname.startsWith('/game/')
  const isHomeRoute = location.pathname === '/'
  const isCharactersRoute = location.pathname === '/characters'
  const isSessionsRoute = location.pathname === '/sessions'
  const isSessionCreateRoute = location.pathname === '/session/create'
  const isVisible =
    isGameRoute || isHomeRoute || isCharactersRoute || isSessionsRoute || isSessionCreateRoute

  if (!isVisible) {
    return null
  }

  const campaignName = isGameRoute ? 'The Gilded Griffin' : ''

  const handleExport = () => {
    if (!isGameRoute) return
    window.dispatchEvent(new CustomEvent('rollia:export-log'))
  }

  return (
    <header className="global-header">
      <div className="global-header-left">
        <span
          className="global-header-brand"
          onClick={() => navigate('/')}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              navigate('/')
            }
          }}
          role="link"
          tabIndex={0}
          aria-label="Go to home"
        >
          ROLLIA
        </span>
      </div>
      <div className="global-header-center">{campaignName}</div>
      <div className="global-header-right">
        <button
          type="button"
          className={`global-header-link ${isCharactersRoute ? 'active' : ''}`}
          onClick={() => navigate('/characters')}
        >
          Characters
        </button>
        <button
          type="button"
          className={`global-header-link ${isSessionsRoute ? 'active' : ''}`}
          onClick={() => navigate('/sessions')}
        >
          Sessions
        </button>
        {isGameRoute && (
          <button type="button" className="global-header-export" onClick={handleExport}>
            {t('gameSession.exportLog')}
          </button>
        )}
      </div>
    </header>
  )
}
