import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useEmberCanvas } from '../hooks/useEmberCanvas'

const CHARACTER_KEY        = 'character'
const LEGACY_CHARACTER_KEY = 'dnd-ai-character'
const ACTIVE_CAMPAIGN_KEY  = 'activeCampaignId'

const parseStored = (raw: string | null) => {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

const classIcon = (cls?: string) => {
  const c = (cls || '').toLowerCase()
  if (c.includes('mage')||c.includes('wizard')||c.includes('arcane')) return '🧙'
  if (c.includes('warrior')||c.includes('fighter')) return '⚔️'
  if (c.includes('ranger'))  return '🏹'
  if (c.includes('rogue')||c.includes('thief')) return '🗡️'
  if (c.includes('paladin')) return '🛡️'
  if (c.includes('druid'))   return '🌿'
  if (c.includes('bard'))    return '🎭'
  if (c.includes('cleric'))  return '✨'
  if (c.includes('warlock')) return '🔮'
  return '🎲'
}

const WORLD_SEEDS = [
  { id:'forgotten',  icon:'🏔️', label:'The Forgotten Reaches',  hint:'Ancient ruins, buried gods, fractured kingdoms' },
  { id:'crimson',    icon:'🌊', label:'The Crimson Tides',       hint:'Coastal intrigue, sea monsters, pirate courts' },
  { id:'ashfeld',    icon:'🔥', label:'Ashfeld',                 hint:'Post-war wasteland, dying magic, survival' },
  { id:'silvermere', icon:'🌲', label:'The Silvermere Woods',    hint:'Fey corruption, ancient pacts, hidden paths' },
  { id:'custom',     icon:'◆',  label:'Custom World',            hint:'Describe your own setting below' },
]

export function SessionCreation() {
  const navigate  = useNavigate()
  const { t }     = useI18n()
  const canvasRef = useEmberCanvas({ count: 70 })

  const [sessionName, setSessionName]               = useState('')
  const [sessionDescription, setSessionDescription] = useState('')
  const [selectedSeed, setSelectedSeed]             = useState<string|null>(null)
  const [hoveredSeed, setHoveredSeed]               = useState<string|null>(null)
  const [hasCharacter, setHasCharacter]             = useState(false)
  const [character, setCharacter]                   = useState<{name?:string;class?:string}|null>(null)
  const [visible, setVisible]                       = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(CHARACTER_KEY) || localStorage.getItem(LEGACY_CHARACTER_KEY)
    if (raw) { setHasCharacter(true); setCharacter(parseStored(raw)) }
    else setHasCharacter(false)
    setTimeout(() => setVisible(true), 80)
  }, [])

  const handleStart = () => {
    if (!sessionName.trim()) return
    const sessionId = Date.now().toString()
    const primary   = parseStored(localStorage.getItem(CHARACTER_KEY))
    const legacy    = parseStored(localStorage.getItem(LEGACY_CHARACTER_KEY))
    const base      = primary || legacy
    const session   = { id:sessionId, name:sessionName, description:sessionDescription, worldSeed:selectedSeed||'custom', createdAt:new Date().toISOString(), characterId:base?.id||undefined, characterName:base?.name||undefined }
    localStorage.setItem(`session_${sessionId}`, JSON.stringify(session))
    localStorage.setItem(ACTIVE_CAMPAIGN_KEY, sessionId)
    if (base && typeof base === 'object') {
      const updated = { ...base, activeCampaignId:sessionId, updatedAt:new Date().toISOString() }
      localStorage.setItem(CHARACTER_KEY,        JSON.stringify(updated))
      localStorage.setItem(LEGACY_CHARACTER_KEY, JSON.stringify(updated))
    }
    navigate(`/game/${sessionId}`)
  }

  const fade = (delay: number): React.CSSProperties => ({
    opacity:   visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(12px)',
    transition:`opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
  })

  return (
    <div style={{ position:'relative', width:'100%', minHeight:'100vh', background:'var(--g-ink)', display:'flex', flexDirection:'column', alignItems:'center', overflowX:'hidden' }}>

      <canvas ref={canvasRef} style={{ position:'fixed', inset:0, width:'100%', height:'100%', zIndex:0, pointerEvents:'none' }} />
      <div style={{ position:'fixed', inset:0, zIndex:1, pointerEvents:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")` }} />
      <div style={{ position:'fixed', inset:0, zIndex:2, pointerEvents:'none', background:'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(4,2,7,0.65) 100%)' }} />

      {/* Header */}
      <header style={{ position:'sticky', top:0, width:'100%', zIndex:50, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 24px', height:48, background:'rgba(5,3,8,0.82)', borderBottom:'1px solid var(--g-border)', backdropFilter:'blur(4px)' }}>
        <span style={{ fontFamily:'var(--g-font-display)', fontSize:16, fontWeight:700, color:'var(--g-gold)', letterSpacing:'0.1em', textShadow:'0 0 16px rgba(200,165,74,0.3)', cursor:'pointer', userSelect:'none' }} onClick={() => navigate('/')}>
          Rol<span style={{ color:'var(--g-blood2)' }}>l</span>ia
        </span>
        <span style={{ fontFamily:'var(--g-font-title)', fontSize:9, letterSpacing:'0.3em', color:'rgba(200,165,74,0.35)', textTransform:'uppercase' }}>New Session</span>
        <button className="g-btn-sm" onClick={() => navigate('/')} style={{ fontSize:8 }}>← Menu</button>
      </header>

      {/* Body */}
      <div style={{ position:'relative', zIndex:10, width:'100%', maxWidth:680, padding:'40px 24px 60px', display:'flex', flexDirection:'column', gap:0 }}>

        {/* Title */}
        <div style={{ ...fade(0.1), marginBottom:32 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div style={{ flex:1, height:1, background:'linear-gradient(90deg, rgba(200,165,74,0.2), transparent)' }} />
            <span style={{ fontFamily:'var(--g-font-title)', fontSize:8, letterSpacing:'0.3em', color:'rgba(200,165,74,0.3)', textTransform:'uppercase' }}>Chronicle Setup</span>
          </div>
          <h1 style={{ fontFamily:'var(--g-font-title)', fontWeight:600, fontSize:28, color:'var(--g-parch)', letterSpacing:'0.05em', margin:0 }}>{t('sessionCreation.title')}</h1>
          <p style={{ fontFamily:'var(--g-font-italic)', fontStyle:'italic', fontSize:14, color:'var(--g-parch-faint)', marginTop:6 }}>{t('sessionCreation.subtitle')}</p>
        </div>

        {/* Character card */}
        <div style={{ ...fade(0.2), marginBottom:28 }}>
          {hasCharacter && character ? (
            <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', border:'1px solid rgba(200,165,74,0.2)', background:'rgba(200,165,74,0.03)', clipPath:'var(--g-clip-md)' }}>
              <div style={{ width:44, height:44, border:'1px solid var(--g-border)', background:'rgba(0,0,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, clipPath:'var(--g-clip-sm)', flexShrink:0 }}>
                {classIcon(character.class)}
              </div>
              <div>
                <div style={{ fontFamily:'var(--g-font-title)', fontSize:13, fontWeight:600, color:'var(--g-parch)' }}>{character.name||'Unnamed Hero'}</div>
                <div style={{ fontFamily:'var(--g-font-italic)', fontSize:11, fontStyle:'italic', color:'var(--g-parch-faint)', marginTop:2 }}>{character.class||'Adventurer'} · Ready for adventure</div>
              </div>
              <div style={{ marginLeft:'auto', fontFamily:'var(--g-font-title)', fontSize:8, letterSpacing:'0.1em', color:'var(--g-gold)', border:'1px solid rgba(200,165,74,0.25)', padding:'2px 8px', clipPath:'var(--g-clip-sm)' }}>Active</div>
            </div>
          ) : (
            <div style={{ padding:'12px 16px', border:'1px solid rgba(168,28,48,0.3)', background:'rgba(107,17,34,0.08)', clipPath:'var(--g-clip-md)' }}>
              <span style={{ fontFamily:'var(--g-font-italic)', fontStyle:'italic', fontSize:13, color:'rgba(228,150,150,0.8)' }}>
                {t('sessionCreation.noCharacter')}{' '}
                <span onClick={() => navigate('/character/name')} style={{ color:'var(--g-gold)', cursor:'pointer', textDecoration:'underline', textDecorationStyle:'dotted' }}>{t('sessionCreation.createFirst')}</span>.
              </span>
            </div>
          )}
        </div>

        {/* World seeds */}
        <div style={{ ...fade(0.3), marginBottom:28 }}>
          <div className="g-label-gold" style={{ marginBottom:12 }}>Choose Your World</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
            {WORLD_SEEDS.map(seed => {
              const isActive = selectedSeed === seed.id
              const isHov    = hoveredSeed  === seed.id
              return (
                <button key={seed.id} onClick={() => setSelectedSeed(seed.id)} onMouseEnter={() => setHoveredSeed(seed.id)} onMouseLeave={() => setHoveredSeed(null)} title={seed.hint}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, padding:'14px 8px', border:'1px solid', borderColor:isActive?'var(--g-gold)':isHov?'var(--g-border-h)':'var(--g-border)', background:isActive?'rgba(200,165,74,0.07)':isHov?'rgba(200,165,74,0.03)':'rgba(0,0,0,0.18)', clipPath:'var(--g-clip-md)', cursor:'pointer', transition:'all 0.2s', outline:'none', position:'relative' }}
                >
                  {isActive && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'var(--g-gold)', boxShadow:'0 0 8px rgba(200,165,74,0.5)' }} />}
                  <span style={{ fontSize:20 }}>{seed.icon}</span>
                  <span style={{ fontFamily:'var(--g-font-title)', fontSize:7, letterSpacing:'0.08em', textTransform:'uppercase', color:isActive?'var(--g-gold)':'var(--g-parch-faint)', textAlign:'center', lineHeight:1.4 }}>{seed.label.split(' ').slice(0,2).join(' ')}</span>
                </button>
              )
            })}
          </div>
          {selectedSeed && (
            <div style={{ marginTop:8, fontFamily:'var(--g-font-italic)', fontStyle:'italic', fontSize:12, color:'rgba(200,165,74,0.45)', animation:'g-fade-up 0.3s ease forwards' }}>
              {WORLD_SEEDS.find(s => s.id === selectedSeed)?.hint}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="g-divider" style={{ ...fade(0.33), marginBottom:24 }}><span className="g-divider-icon">◆</span></div>

        {/* Session name */}
        <div style={{ ...fade(0.35), marginBottom:18 }}>
          <label className="g-label" style={{ marginBottom:6 }}>{t('sessionCreation.sessionName')}</label>
          <input autoFocus value={sessionName} onChange={e => setSessionName(e.target.value)} onKeyDown={e => e.key==='Enter' && handleStart()} placeholder={t('sessionCreation.sessionNamePlaceholder')} className="g-input" style={{ fontSize:15, padding:'12px 16px' }} />
        </div>

        {/* Session description */}
        <div style={{ ...fade(0.4), marginBottom:32 }}>
          <label className="g-label" style={{ marginBottom:6 }}>{t('sessionCreation.sessionDescription')}</label>
          <textarea
            value={sessionDescription} onChange={e => setSessionDescription(e.target.value)}
            placeholder={t('sessionCreation.sessionDescriptionPlaceholder')} rows={4}
            style={{ background:'rgba(255,255,255,0.02)', border:'1px solid var(--g-border)', borderBottom:'1px solid rgba(200,165,74,0.28)', color:'var(--g-parch)', fontFamily:'var(--g-font-body)', fontStyle:'italic', fontSize:14, lineHeight:1.7, padding:'12px 16px', outline:'none', resize:'vertical', width:'100%', clipPath:'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))', transition:'border-color 0.2s, background 0.2s' }}
            onFocus={e => { e.target.style.borderBottomColor='var(--g-gold)'; e.target.style.background='rgba(200,165,74,0.025)' }}
            onBlur={e  => { e.target.style.borderBottomColor='rgba(200,165,74,0.28)'; e.target.style.background='rgba(255,255,255,0.02)' }}
          />
        </div>

        {/* Actions */}
        <div style={{ ...fade(0.45), display:'flex', gap:10 }}>
          <button className="g-btn-secondary" onClick={() => navigate('/')} style={{ padding:'12px 20px', fontSize:10 }}>← {t('common.back')}</button>
          <button onClick={handleStart} disabled={!sessionName.trim()} className="g-btn-primary" style={{ flex:1, padding:'12px 24px', fontSize:11, opacity:!sessionName.trim()?0.4:1, cursor:!sessionName.trim()?'not-allowed':'pointer' }}>
            ▶ {t('sessionCreation.start')}
          </button>
        </div>

      </div>
    </div>
  )
}
