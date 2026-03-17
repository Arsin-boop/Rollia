import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useEmberCanvas } from '../hooks/useEmberCanvas'
import { RunicSigil } from './grimoire/RunicSigil'

const CHARACTER_KEY      = 'character'
const LEGACY_CHARACTER_KEY = 'dnd-ai-character'
const ACTIVE_CAMPAIGN_KEY  = 'activeCampaignId'

const parseStored = (raw: string | null) => {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

interface MenuItem {
  key: string
  label: string
  labelRu: string
  action: () => void
  primary?: boolean
}

export function Home() {
  const navigate = useNavigate()
  const { t, language, setLanguage } = useI18n()
  const canvasRef = useEmberCanvas({ count: 180, includeRunes: true })
  const [continueCampaignId, setContinueCampaignId] = useState<string | null>(null)
  const [hoveredItem, setHoveredItem]               = useState<string | null>(null)
  const [visible, setVisible]                       = useState(false)

  useEffect(() => {
    const readState = () => {
      const primary   = parseStored(localStorage.getItem(CHARACTER_KEY))
      const legacy    = parseStored(localStorage.getItem(LEGACY_CHARACTER_KEY))
      const character = primary || legacy
      if (!character || typeof character !== 'object') { setContinueCampaignId(null); return }
      const campaignId =
        (character as { activeCampaignId?: string | null }).activeCampaignId ||
        localStorage.getItem(ACTIVE_CAMPAIGN_KEY)
      if (!campaignId) { setContinueCampaignId(null); return }
      const hasSession = Boolean(localStorage.getItem(`session_${campaignId}`))
      setContinueCampaignId(hasSession ? campaignId : null)
    }
    readState()
    window.addEventListener('storage', readState)
    return () => window.removeEventListener('storage', readState)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const menuItems: MenuItem[] = [
    ...(continueCampaignId ? [{
      key: 'continue',
      label: 'Continue Journey',
      labelRu: 'Продолжить путь',
      action: () => navigate(`/game/${continueCampaignId}`),
      primary: true,
    }] : []),
    { key: 'new-tale',   label: 'Begin a New Tale', labelRu: 'Начать новую историю', action: () => navigate('/character/name') },
    { key: 'characters', label: 'My Characters',    labelRu: 'Мои персонажи',         action: () => navigate('/characters') },
    { key: 'sessions',   label: 'Sessions',         labelRu: 'Сессии',                action: () => navigate('/sessions') },
  ]

  const fade = (delay: number): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 1.2s ease ${delay}s, transform 1.2s ease ${delay}s`,
  })

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', minHeight: '100vh',
      overflow: 'hidden', background: 'var(--g-ink)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Ember canvas */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} />

      {/* Grain */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
      }} />

      {/* Vignette */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(4,2,7,0.75) 100%)',
      }} />

      <SideDeco side="left"  visible={visible} />
      <SideDeco side="right" visible={visible} />

      {/* Language switcher */}
      <div style={{ position: 'fixed', top: 16, right: 20, zIndex: 50, opacity: visible ? 1 : 0, transition: 'opacity 1s ease 1.8s' }}>
        <select
          value={language}
          onChange={e => setLanguage(e.target.value as 'en' | 'ru')}
          style={{
            background: 'rgba(10,8,14,0.9)', border: '1px solid var(--g-border)',
            color: 'var(--g-parch-faint)', fontFamily: 'var(--g-font-title)',
            fontSize: 9, letterSpacing: '0.15em', padding: '5px 10px',
            outline: 'none', cursor: 'pointer', clipPath: 'var(--g-clip-sm)',
          }}
        >
          <option value="en">EN</option>
          <option value="ru">RU</option>
        </select>
      </div>

      {/* Stage */}
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Runic sigil */}
        <div style={{ ...fade(0.1), marginBottom: 12 }}>
          <RunicSigil />
        </div>

        {/* Top ornament */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32, ...fade(0.3) }}>
          <div style={{ width: 100, height: 1, background: 'linear-gradient(90deg, transparent, var(--g-gold-dim))' }} />
          <div style={{ width: 6, height: 6, background: 'var(--g-gold)', transform: 'rotate(45deg)', boxShadow: '0 0 8px var(--g-gold)' }} />
          <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 9, letterSpacing: '0.35em', color: 'var(--g-parch-faint)', textTransform: 'uppercase' }}>
            The Arcane Chronicle
          </span>
          <div style={{ width: 6, height: 6, background: 'var(--g-gold)', transform: 'rotate(45deg)', boxShadow: '0 0 8px var(--g-gold)' }} />
          <div style={{ width: 100, height: 1, background: 'linear-gradient(270deg, transparent, var(--g-gold-dim))' }} />
        </div>

        {/* Logo + tagline */}
        <div style={{ ...fade(0.5), marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--g-font-italic)', fontSize: 13, fontStyle: 'italic', color: 'var(--g-parch-faint)', letterSpacing: '0.12em', marginBottom: 8 }}>
            An AI Dungeon Master
          </div>
          <LogoTitle />
          <div style={{ fontFamily: 'var(--g-font-italic)', fontSize: 14, fontStyle: 'italic', color: 'var(--g-parch-faint)', marginTop: 12, letterSpacing: '0.08em' }}>
            {t('home.tagline')}
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: 320, margin: '36px 0 40px', opacity: visible ? 1 : 0, transition: 'opacity 1.2s ease 0.9s' }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, var(--g-gold-dim))' }} />
          <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 11, color: 'var(--g-gold)', letterSpacing: '0.3em' }}>✦</span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(270deg, transparent, var(--g-gold-dim))' }} />
        </div>

        {/* Menu */}
        <nav style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, ...fade(1.1) }}>
          {menuItems.map(item => (
            <MenuItemButton key={item.key} item={item} hovered={hoveredItem === item.key} onHover={setHoveredItem} lang={language} />
          ))}
        </nav>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 28px', borderTop: '1px solid rgba(200,165,74,0.08)',
        opacity: visible ? 1 : 0, transition: 'opacity 1s ease 1.6s',
      }}>
        <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 8, letterSpacing: '0.25em', color: 'var(--g-parch-faint)', opacity: 0.45, textTransform: 'uppercase' }}>v0.9 · Arcane Build</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--g-gold-dim)', opacity: 0.4 }} />)}
        </div>
        <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 8, letterSpacing: '0.25em', color: 'var(--g-parch-faint)', opacity: 0.45, textTransform: 'uppercase' }}>Powered by Groq · Qwen 3</span>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function LogoTitle() {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <h1 style={{
        fontFamily: 'var(--g-font-display)', fontWeight: 900,
        fontSize: 'clamp(56px, 9vw, 108px)', lineHeight: 1,
        color: 'var(--g-parch)', letterSpacing: '0.04em',
        animation: 'g-flicker 7s ease-in-out infinite', margin: 0,
      }}>
        Rol<span style={{ color: 'var(--g-blood2)', textShadow: '0 0 30px var(--g-blood-glow)' }}>l</span>ia
      </h1>
      {/* Shimmer overlay */}
      <h1 aria-hidden style={{
        position: 'absolute', inset: 0, margin: 0,
        fontFamily: 'var(--g-font-display)', fontWeight: 900,
        fontSize: 'clamp(56px, 9vw, 108px)', lineHeight: 1, letterSpacing: '0.04em',
        background: 'linear-gradient(105deg, transparent 30%, rgba(200,165,74,0.55) 48%, rgba(232,200,100,0.75) 50%, rgba(200,165,74,0.55) 52%, transparent 70%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
        animation: 'g-shimmer 5s ease-in-out 2s infinite',
        pointerEvents: 'none',
      }}>Rollia</h1>
    </div>
  )
}

function MenuItemButton({ item, hovered, onHover, lang }: {
  item: MenuItem; hovered: boolean; onHover: (k: string | null) => void; lang: string
}) {
  const label = lang === 'ru' ? item.labelRu : item.label
  return (
    <button
      onClick={item.action}
      onMouseEnter={() => onHover(item.key)}
      onMouseLeave={() => onHover(null)}
      style={{
        position: 'relative', width: 260,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '13px 24px',
        fontFamily: 'var(--g-font-title)', fontSize: 13,
        letterSpacing: hovered ? '0.28em' : '0.2em', textTransform: 'uppercase',
        color: item.primary
          ? (hovered ? 'var(--g-parch)' : 'var(--g-gold)')
          : (hovered ? 'var(--g-parch)' : 'var(--g-parch-dim)'),
        background: hovered ? 'rgba(200,165,74,0.06)' : 'transparent',
        border: '1px solid',
        borderColor: item.primary
          ? (hovered ? 'var(--g-gold)' : 'rgba(200,165,74,0.28)')
          : (hovered ? 'rgba(200,165,74,0.35)' : 'rgba(200,165,74,0.12)'),
        clipPath: 'var(--g-clip-md)', cursor: 'pointer',
        transition: 'color 0.25s, letter-spacing 0.25s, background 0.25s, border-color 0.25s',
        outline: 'none',
      }}
    >
      <span style={{
        position: 'absolute', left: 18, color: 'var(--g-blood2)', fontSize: 12,
        opacity: hovered ? 1 : 0, transform: hovered ? 'translateX(0)' : 'translateX(-6px)',
        transition: 'opacity 0.2s, transform 0.2s',
      }}>›</span>
      {label}
    </button>
  )
}

function SideDeco({ side, visible }: { side: 'left' | 'right'; visible: boolean }) {
  return (
    <div style={{
      position: 'fixed', top: '50%', [side]: 24,
      transform: 'translateY(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      zIndex: 15, opacity: visible ? 0.6 : 0, transition: 'opacity 1.5s ease 1.8s',
    }}>
      <div style={{ width: 1, height: 60, background: 'linear-gradient(180deg, transparent, var(--g-gold-dim), transparent)' }} />
      <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 7, letterSpacing: '0.3em', color: 'var(--g-parch-faint)', textTransform: 'uppercase', writingMode: 'vertical-rl', opacity: 0.4 }}>
        {side === 'left' ? 'Est. MMX' : 'Rollia'}
      </span>
      <div style={{ width: 1, height: 60, background: 'linear-gradient(180deg, transparent, var(--g-gold-dim), transparent)' }} />
    </div>
  )
}
