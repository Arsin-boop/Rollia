import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CharacterWizardLayout } from './CharacterWizardLayout'
import { API_ORIGIN, getCharacter, saveCharacterAppearance } from '../../utils/api'
import { useI18n } from '../../i18n'
import type { CustomClassResponse } from '../../utils/api'

const CHARACTER_COLLECTION_KEY = 'rollia_characters_v1'
const CUSTOM_CLASS_DATA_KEY    = 'characterCustomClassData'

const upsertCharacterCollection = (payload: Record<string, unknown>) => {
  try {
    const raw    = localStorage.getItem(CHARACTER_COLLECTION_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    const list   = Array.isArray(parsed) ? parsed : []
    const id     = String(payload.id || '')
    if (!id) return
    const next  = [...list]
    const index = next.findIndex((entry: any) => entry && entry.id === id)
    if (index >= 0) next[index] = { ...next[index], ...payload }
    else next.unshift(payload)
    localStorage.setItem(CHARACTER_COLLECTION_KEY, JSON.stringify(next))
  } catch (error) {
    console.error('Failed to update characters collection:', error)
  }
}

export function CharacterReview() {
  const navigate = useNavigate()
  const { t }    = useI18n()
  const [character, setCharacter] = useState({ id: '', name: '', class: '', backstory: '', appearance: '', avatarUrl: '' })
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'pending' | 'ready' | 'failed'>('idle')
  const [avatarError, setAvatarError]   = useState('')

  const resolveAvatarUrl = (url?: string | null) => {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    return `${API_ORIGIN}${url}`
  }

  useEffect(() => {
    let cancelled = false

    const loadAndGenerateAvatar = async () => {
      const name              = localStorage.getItem('characterName') || ''
      const characterClass    = localStorage.getItem('characterClass') || ''
      const backstory         = localStorage.getItem('characterBackstory') || ''
      const appearance        = localStorage.getItem('characterAppearance') || ''
      const existingCharacterId = localStorage.getItem('characterId') || ''

      if (!name || !characterClass || !backstory || !appearance) { navigate('/character/name'); return }

      setCharacter({ id: existingCharacterId, name, class: characterClass, backstory, appearance, avatarUrl: '' })

      try {
        setAvatarStatus('pending')
        setAvatarError('')
        const record = await saveCharacterAppearance({ characterId: existingCharacterId || null, appearance, name, class: characterClass, backstory })
        if (cancelled) return
        localStorage.setItem('characterId', record.id)
        const initialUrl = resolveAvatarUrl(record.avatarUrl)
        setCharacter(prev => ({ ...prev, id: record.id, avatarUrl: initialUrl }))
        if (record.avatarStatus === 'ready' && initialUrl) { setAvatarStatus('ready'); return }
        if (record.avatarStatus === 'failed') { setAvatarStatus('failed'); setAvatarError(record.avatarError || t('characterReview.avatarFailed')); return }

        for (let i = 0; i < 20; i++) {
          if (cancelled) return
          await new Promise(resolve => setTimeout(resolve, 1500))
          const polled    = await getCharacter(record.id)
          if (cancelled) return
          const polledUrl = resolveAvatarUrl(polled.avatarUrl)
          if (polledUrl) setCharacter(prev => ({ ...prev, avatarUrl: polledUrl }))
          if (polled.avatarStatus === 'ready' && polledUrl) { setAvatarStatus('ready'); return }
          if (polled.avatarStatus === 'failed') { setAvatarStatus('failed'); setAvatarError(polled.avatarError || t('characterReview.avatarFailed')); return }
        }
        setAvatarStatus('failed')
        setAvatarError(t('characterReview.avatarTimedOut'))
      } catch (error: any) {
        if (cancelled) return
        setAvatarStatus('failed')
        setAvatarError(error?.message || t('characterReview.avatarFailed'))
      }
    }

    void loadAndGenerateAvatar()
    return () => { cancelled = true }
  }, [navigate])

  const handleConfirm = () => {
    const rawStats = localStorage.getItem('characterStats')
    let mappedStats = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }
    if (rawStats) {
      try {
        const parsed = JSON.parse(rawStats) as Array<{ key: string; score: number }>
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            const key   = (entry.key || '').toUpperCase()
            const score = Number(entry.score) || 10
            if (key === 'STR') mappedStats.strength     = score
            if (key === 'DEX') mappedStats.dexterity    = score
            if (key === 'CON') mappedStats.constitution = score
            if (key === 'INT') mappedStats.intelligence = score
            if (key === 'WIS') mappedStats.wisdom       = score
            if (key === 'CHA') mappedStats.charisma     = score
          }
        }
      } catch {}
    }

    let savedClassData: CustomClassResponse | null = null
    const rawCustomClassData = localStorage.getItem(CUSTOM_CLASS_DATA_KEY)
    if (rawCustomClassData) {
      try { savedClassData = JSON.parse(rawCustomClassData) as CustomClassResponse } catch {}
    }

    const resolvedClassData: CustomClassResponse = savedClassData || {
      className: character.class, stats: mappedStats,
      hitDie: 'd8', proficiencies: [], features: [], description: `${character.class} profile`,
    }

    const equipment: string[] = []
    const inventoryItems: Array<{ id:string; name:string; description:string; tags:string[]; damage?:string; armorClass?:number; slot?:'weapon'|'armor'; equipped?:boolean }> = []
    const toSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-')

    if (resolvedClassData.startingWeapon?.name) {
      equipment.push(resolvedClassData.startingWeapon.name)
      inventoryItems.push({ id:`weapon-${toSlug(resolvedClassData.startingWeapon.name)||'starter-weapon'}`, name:resolvedClassData.startingWeapon.name, description:resolvedClassData.startingWeapon.description||'A starting weapon tailored to your class.', tags:Array.isArray(resolvedClassData.startingWeapon.tags)&&resolvedClassData.startingWeapon.tags.length?resolvedClassData.startingWeapon.tags:['equipment','weapon'], damage:resolvedClassData.startingWeapon.damage||'1d6', slot:'weapon', equipped:true })
    }
    if (resolvedClassData.startingArmor?.name) {
      equipment.push(resolvedClassData.startingArmor.name)
      inventoryItems.push({ id:`armor-${toSlug(resolvedClassData.startingArmor.name)||'starter-armor'}`, name:resolvedClassData.startingArmor.name, description:resolvedClassData.startingArmor.description||'A starting armor set tailored to your class.', tags:Array.isArray(resolvedClassData.startingArmor.tags)&&resolvedClassData.startingArmor.tags.length?resolvedClassData.startingArmor.tags:['equipment','armor'], armorClass:Number.isFinite(resolvedClassData.startingArmor.armorClass)?resolvedClassData.startingArmor.armorClass:12, slot:'armor', equipped:true })
    }

    const payload = { id:character.id, name:character.name, class:character.class, backstory:character.backstory, appearance:character.appearance, avatarUrl:character.avatarUrl||null, avatarStatus, classDescription:character.class, customClassData:resolvedClassData, xp:0, level:1, equipment, inventoryItems, artifacts:[], activeCampaignId:null, updatedAt:new Date().toISOString() }
    localStorage.setItem('character', JSON.stringify(payload))
    localStorage.setItem('dnd-ai-character', JSON.stringify(payload))
    upsertCharacterCollection(payload as unknown as Record<string, unknown>)
    navigate('/session/create')
  }

  return (
    <CharacterWizardLayout
      step={{ number: 5, total: 5, title: t('characterReview.title'), hint: t('characterReview.step') }}
      onBack={() => navigate('/character/appearance')}
      onNext={handleConfirm}
      nextLabel={t('characterReview.confirm')}
      backLabel={'← ' + t('common.back')}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Portrait */}
        <div>
          <div className="g-label-gold" style={{ marginBottom: 10 }}>{t('characterReview.portrait')}</div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid var(--g-border)', background:'rgba(0,0,0,0.2)', clipPath:'var(--g-clip-lg)', padding:20, minHeight:160 }}>
            {character.avatarUrl ? (
              <img src={character.avatarUrl} alt={`${character.name || 'Character'} portrait`} style={{ width:160, height:160, objectFit:'cover', clipPath:'var(--g-clip-md)', border:'1px solid rgba(200,165,74,0.2)' }} />
            ) : (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:48, marginBottom:10, opacity:0.4 }}>🎨</div>
                <p style={{ fontFamily:'var(--g-font-italic)', fontStyle:'italic', fontSize:13, color:'var(--g-parch-faint)' }}>
                  {avatarStatus === 'pending' ? t('characterReview.generatingPortrait') : t('characterReview.noPortrait')}
                </p>
                {avatarStatus === 'pending' && (
                  <div style={{ marginTop:8, display:'flex', gap:4, justifyContent:'center' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width:4, height:4, borderRadius:'50%', background:'var(--g-gold)', opacity:0.5, animation:`g-blink 1.2s ease ${i*0.2}s infinite` }} />)}
                  </div>
                )}
                {avatarStatus === 'failed' && avatarError && (
                  <div style={{ marginTop: 10, padding: '10px 14px', border: '1px solid rgba(255,80,80,0.25)', background: 'rgba(255,80,80,0.06)', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}>
                    <p style={{ fontFamily:'var(--g-font-title)', fontSize:11, color:'rgba(255,100,100,0.9)', letterSpacing:'0.08em', marginBottom:8 }}>{avatarError}</p>
                    <button
                      onClick={() => navigate(0)}
                      style={{ fontFamily:'var(--g-font-title)', fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', border:'1px solid rgba(255,100,100,0.35)', color:'rgba(255,140,140,0.85)', background:'transparent', padding:'5px 14px', cursor:'pointer', clipPath:'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))', transition:'all 0.2s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,100,100,0.6)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,100,100,0.08)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,100,100,0.35)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      ↺ Retry
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <ReviewField label={t('characterReview.name')}  value={character.name}  />
          <ReviewField label={t('characterReview.class')} value={character.class} capitalize />
        </div>
        <ReviewField label={t('characterReview.backstory')}   value={character.backstory}   multiline />
        <ReviewField label={t('characterReview.appearance')}  value={character.appearance}   multiline />
      </div>
    </CharacterWizardLayout>
  )
}

function ReviewField({ label, value, multiline, capitalize }: { label:string; value:string; multiline?:boolean; capitalize?:boolean }) {
  return (
    <div>
      <div className="g-label-gold" style={{ marginBottom:6 }}>{label}</div>
      <div style={{
        fontFamily: multiline ? 'var(--g-font-body)' : 'var(--g-font-title)',
        fontStyle: multiline ? 'italic' : 'normal',
        fontSize: multiline ? 14 : 15,
        lineHeight: multiline ? 1.7 : 1.4,
        color: 'var(--g-parch-dim)',
        textTransform: capitalize ? 'capitalize' : 'none',
        padding: '10px 14px',
        border: '1px solid var(--g-border)',
        background: 'rgba(0,0,0,0.15)',
        clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
      }}>
        {value || '—'}
      </div>
    </div>
  )
}
