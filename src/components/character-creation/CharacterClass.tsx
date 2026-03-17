import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { generateCustomClass, type CustomClassResponse } from '../../utils/api'
import { CharacterWizardLayout } from './CharacterWizardLayout'

type StatKey = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'
type CharacterStat = { key: StatKey; score: number; bonus: number }

const CLASS_DEFS = [
  { id: 'warrior', icon: '⚔️',  label: 'Warrior' },
  { id: 'mage',    icon: '🧙',  label: 'Mage'    },
  { id: 'paladin', icon: '🛡️', label: 'Paladin' },
  { id: 'rogue',   icon: '🗡️', label: 'Rogue'   },
  { id: 'cleric',  icon: '✨',  label: 'Cleric'  },
  { id: 'warlock', icon: '🔮',  label: 'Warlock' },
]

const PRESET_STATS: Record<string, CharacterStat[]> = {
  warrior: [{key:'STR',score:16,bonus:3},{key:'DEX',score:12,bonus:1},{key:'CON',score:15,bonus:2},{key:'INT',score:10,bonus:0},{key:'WIS',score:11,bonus:0},{key:'CHA',score:10,bonus:0}],
  mage:    [{key:'STR',score:8,bonus:-1},{key:'DEX',score:13,bonus:1},{key:'CON',score:12,bonus:1},{key:'INT',score:16,bonus:3},{key:'WIS',score:14,bonus:2},{key:'CHA',score:10,bonus:0}],
  paladin: [{key:'STR',score:15,bonus:2},{key:'DEX',score:10,bonus:0},{key:'CON',score:14,bonus:2},{key:'INT',score:9,bonus:-1},{key:'WIS',score:12,bonus:1},{key:'CHA',score:16,bonus:3}],
  rogue:   [{key:'STR',score:9,bonus:-1},{key:'DEX',score:16,bonus:3},{key:'CON',score:12,bonus:1},{key:'INT',score:13,bonus:1},{key:'WIS',score:11,bonus:0},{key:'CHA',score:14,bonus:2}],
  cleric:  [{key:'STR',score:11,bonus:0},{key:'DEX',score:10,bonus:0},{key:'CON',score:13,bonus:1},{key:'INT',score:10,bonus:0},{key:'WIS',score:16,bonus:3},{key:'CHA',score:14,bonus:2}],
  warlock: [{key:'STR',score:8,bonus:-1},{key:'DEX',score:14,bonus:2},{key:'CON',score:12,bonus:1},{key:'INT',score:12,bonus:1},{key:'WIS',score:10,bonus:0},{key:'CHA',score:16,bonus:3}],
}

const PRESET_HIT_DIE: Record<string,string> = { warrior:'d10', mage:'d6', paladin:'d10', rogue:'d8', cleric:'d8', warlock:'d8' }
const PRESET_PROFICIENCIES: Record<string,string[]> = {
  warrior: ['All armor','Shields','Simple weapons','Martial weapons'],
  mage:    ['Daggers','Quarterstaffs','Light crossbows'],
  paladin: ['All armor','Shields','Simple weapons','Martial weapons'],
  rogue:   ['Light armor','Simple weapons','Rapiers','Shortswords'],
  cleric:  ['Light armor','Medium armor','Shields','Simple weapons'],
  warlock: ['Light armor','Simple weapons'],
}
const PRESET_LOADOUT: Record<string, { weapon: { name:string; type:string; damage:string; description:string }; armor: { name:string; armorClass:number; description:string } }> = {
  warrior: { weapon:{name:'Longsword',type:'melee',damage:'1d8 slashing',description:'A dependable steel blade.'},armor:{name:'Chain Mail',armorClass:16,description:'Heavy armor of interlocked rings.'} },
  mage:    { weapon:{name:'Arcane Staff',type:'magic',damage:'1d6 force',description:'A focus carved with runes.'},armor:{name:'Apprentice Robes',armorClass:11,description:'Layered robes reinforced with warding thread.'} },
  paladin: { weapon:{name:'Blessed Sword',type:'melee',damage:'1d8 radiant',description:'A sword etched with sacred marks.'},armor:{name:'Plate Harness',armorClass:18,description:'Sanctified plate forged for frontline defense.'} },
  rogue:   { weapon:{name:'Balanced Dagger',type:'melee',damage:'1d4 piercing',description:'A quick blade for close strikes.'},armor:{name:'Shadow Leather',armorClass:13,description:'Flexible leather suited for stealth.'} },
  cleric:  { weapon:{name:'Mace of Oaths',type:'melee',damage:'1d6 bludgeoning',description:'A sanctified mace for holy battles.'},armor:{name:'Scale Vestments',armorClass:14,description:'Blessed scales over ceremonial cloth.'} },
  warlock: { weapon:{name:'Pact Blade',type:'magic',damage:'1d8 necrotic',description:'A weapon bound to a dark bargain.'},armor:{name:'Hexwoven Coat',armorClass:12,description:'A long coat threaded with occult sigils.'} },
}

const statBonus  = (s: number) => Math.floor((s - 10) / 2)
const hashSeed   = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 } return Math.abs(h) }
const pickBySeed = (seed: number, vals: string[], offset: number) => vals[(seed + offset) % vals.length]

const buildCustomStats = (seed: string): CharacterStat[] => {
  const vals = ['STR','DEX','CON','INT','WIS','CHA'].map(key => ({ key: key as StatKey, score: 10, bonus: 0 }))
  let state = hashSeed(seed || 'custom')
  for (let i = 0; i < 16; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    const idx = state % vals.length
    if (vals[idx].score < 17) vals[idx].score++
  }
  return vals.map(s => ({ ...s, bonus: statBonus(s.score) }))
}

const buildCustomDesc = (name: string, seed: string, lang: 'en' | 'ru') => {
  const h = hashSeed(`${name}:${seed}`)
  const origins = lang === 'ru'
    ? ['закалён в приграничных стычках','обучен в закрытых залах','вырос между гильдейскими контрактами','отточен в храмовых рядах']
    : ['forged in border skirmishes','trained in shuttered halls','raised between guild contracts','honed in shrine courts']
  const styles = lang === 'ru'
    ? ['контролирует темп боя','побеждает точными ударами','ломает построения врага','удерживает ключевые угрозы']
    : ['controls battle tempo','wins through precision','breaks enemy formations','locks down key threats']
  if (lang === 'ru') return `${name} ${pickBySeed(h, origins, 1)}. В бою ${pickBySeed(h, styles, 3)}.`
  return `The ${name} is ${pickBySeed(h, origins, 1)}. In battle, this class ${pickBySeed(h, styles, 3)}.`
}

export function CharacterClass() {
  const navigate = useNavigate()
  const { language, t } = useI18n()
  const [selected, setSelected]           = useState('')
  const [customInput, setCustomInput]     = useState('')
  const [customDesc, setCustomDesc]       = useState('')
  const [customStats, setCustomStats]     = useState<CharacterStat[] | null>(null)
  const [generatedData, setGeneratedData] = useState<CustomClassResponse | null>(null)
  const [isGenerating, setIsGenerating]   = useState(false)
  const [hovered, setHovered]             = useState('')

  const mapStats = (s: CustomClassResponse['stats']): CharacterStat[] =>
    (['STR','DEX','CON','INT','WIS','CHA'] as StatKey[]).map((key, i) => {
      const src = ['strength','dexterity','constitution','intelligence','wisdom','charisma'][i] as keyof typeof s
      const score = Number(s[src] || 10)
      return { key, score, bonus: statBonus(score) }
    })

  const handleGenerate = async () => {
    if (!customInput.trim()) return
    setIsGenerating(true)
    try {
      const data = await generateCustomClass(customInput.trim())
      setGeneratedData(data)
      setCustomDesc(data.description || buildCustomDesc(customInput, Date.now().toString(), language))
      setCustomStats(mapStats(data.stats))
      setSelected(`custom_${(data.className || customInput).toLowerCase()}`)
    } catch {
      const seed = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`
      setCustomDesc(buildCustomDesc(customInput, seed, language))
      setCustomStats(buildCustomStats(`${customInput}:${seed}`))
      setGeneratedData(null)
      setSelected(`custom_${customInput.toLowerCase()}`)
    } finally { setIsGenerating(false) }
  }

  const handleNext = () => {
    if (!selected) return
    if (selected.startsWith('custom_')) {
      const name = generatedData?.className || customInput
      localStorage.setItem('characterClass', name)
      if (customStats) localStorage.setItem('characterStats', JSON.stringify(customStats))
      if (generatedData) localStorage.setItem('characterCustomClassData', JSON.stringify(generatedData))
      else localStorage.removeItem('characterCustomClassData')
    } else {
      localStorage.setItem('characterClass', selected)
      const ps = PRESET_STATS[selected]
      if (ps) localStorage.setItem('characterStats', JSON.stringify(ps))
      else localStorage.removeItem('characterStats')
      const ld = PRESET_LOADOUT[selected]
      const cd: CustomClassResponse = {
        className: selected, hitDie: PRESET_HIT_DIE[selected] || 'd8',
        proficiencies: PRESET_PROFICIENCIES[selected] || [], features: [],
        description: `${selected} profile`,
        stats: { strength: ps?.find(s=>s.key==='STR')?.score||10, dexterity: ps?.find(s=>s.key==='DEX')?.score||10, constitution: ps?.find(s=>s.key==='CON')?.score||10, intelligence: ps?.find(s=>s.key==='INT')?.score||10, wisdom: ps?.find(s=>s.key==='WIS')?.score||10, charisma: ps?.find(s=>s.key==='CHA')?.score||10 },
        startingWeapon: ld ? { ...ld.weapon, tags: ['equipment','weapon'] } : undefined,
        startingArmor:  ld ? { ...ld.armor,  tags: ['equipment','armor']  } : undefined,
      }
      localStorage.setItem('characterCustomClassData', JSON.stringify(cd))
    }
    navigate('/character/backstory')
  }

  const activeStats = selected && !selected.startsWith('custom_') ? PRESET_STATS[selected] : customStats

  return (
    <CharacterWizardLayout
      step={{ number: 2, total: 5, title: t('characterClass.title'), hint: t('characterClass.step') }}
      onBack={() => navigate('/character/name')}
      onNext={handleNext}
      nextDisabled={!selected}
      nextLabel={t('common.next') + ' →'}
      backLabel={'← ' + t('common.back')}
      wide
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Preset class grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {CLASS_DEFS.map(cls => {
            const isActive = selected === cls.id
            const isHov    = hovered === cls.id
            return (
              <button
                key={cls.id}
                onClick={() => setSelected(cls.id)}
                onMouseEnter={() => setHovered(cls.id)}
                onMouseLeave={() => setHovered('')}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 10, padding: '20px 12px',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--g-gold)' : isHov ? 'var(--g-border-h)' : 'var(--g-border)',
                  background: isActive ? 'rgba(200,165,74,0.07)' : isHov ? 'rgba(200,165,74,0.03)' : 'rgba(0,0,0,0.18)',
                  clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
                  cursor: 'pointer', transition: 'all 0.2s', outline: 'none', position: 'relative',
                }}
              >
                {isActive && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--g-gold)', boxShadow: '0 0 8px rgba(200,165,74,0.5)' }} />
                )}
                <span style={{ fontSize: 30, filter: isActive ? 'drop-shadow(0 0 8px rgba(200,165,74,0.4))' : 'none', transition: 'filter 0.2s' }}>
                  {cls.icon}
                </span>
                <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: isActive ? 'var(--g-gold)' : 'var(--g-parch-dim)' }}>
                  {cls.label}
                </span>
                {isActive && activeStats && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', marginTop: 4 }}>
                    {activeStats.slice(0,3).map(s => (
                      <span key={s.key} style={{ fontFamily: 'var(--g-font-title)', fontSize: 8, letterSpacing: '0.1em', color: 'rgba(200,165,74,0.6)', border: '1px solid rgba(200,165,74,0.2)', padding: '1px 5px', clipPath: 'polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)' }}>
                        {s.key} {s.bonus >= 0 ? '+' : ''}{s.bonus}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Stats preview */}
        {activeStats && (
          <div style={{ animation: 'g-fade-up 0.3s ease forwards' }}>
            <div className="g-divider" style={{ marginBottom: 14 }}><span className="g-divider-icon">✦</span></div>
            <div className="g-label-gold" style={{ marginBottom: 10 }}>Attributes</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6 }}>
              {activeStats.map(s => (
                <div key={s.key} style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 4px', border:'1px solid var(--g-border)', background:'rgba(200,165,74,0.025)', clipPath:'var(--g-clip-sm)' }}>
                  <span style={{ fontFamily:'var(--g-font-title)', fontSize:16, fontWeight:600, color:'var(--g-gold)', lineHeight:1 }}>{s.score}</span>
                  <span style={{ fontFamily:'var(--g-font-title)', fontSize:8, color:'var(--g-blood2)', marginTop:1 }}>{s.bonus >= 0 ? '+' : ''}{s.bonus}</span>
                  <span style={{ fontSize:7, letterSpacing:'0.12em', color:'var(--g-parch-faint)', textTransform:'uppercase', marginTop:2 }}>{s.key}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom class */}
        <div style={{ border: '1px solid var(--g-border)', background: 'rgba(0,0,0,0.15)', clipPath: 'var(--g-clip-md)', padding: '18px 20px' }}>
          <div className="g-label-gold" style={{ marginBottom: 6 }}>✦ {t('characterClass.customTitle')}</div>
          <p style={{ fontFamily: 'var(--g-font-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--g-parch-faint)', marginBottom: 12, lineHeight: 1.5 }}>
            {t('characterClass.customHint')}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              placeholder={t('characterClass.customPlaceholder')}
              className="g-input"
              style={{ flex: 1 }}
            />
            <button
              onClick={handleGenerate}
              disabled={!customInput.trim() || isGenerating}
              className="g-btn-primary"
              style={{ padding: '9px 16px', fontSize: 9, opacity: !customInput.trim() ? 0.4 : 1, whiteSpace: 'nowrap' }}
            >
              {isGenerating ? '...' : t('characterClass.generate')}
            </button>
          </div>

          {customDesc && (
            <div style={{ marginTop: 14, animation: 'g-fade-up 0.35s ease forwards' }}>
              <div style={{ fontFamily: 'var(--g-font-title)', fontSize: 12, color: 'var(--g-gold)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'capitalize' }}>
                {generatedData?.className || customInput}
              </div>
              <p style={{ fontFamily: 'var(--g-font-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--g-parch-dim)', lineHeight: 1.65 }}>
                {customDesc}
              </p>
              {customStats && (
                <div style={{ marginTop: 12 }}>
                  <div className="g-label-gold" style={{ marginBottom: 8 }}>{t('characterClass.suggestedStats')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 5 }}>
                    {customStats.map(s => (
                      <div key={s.key} style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'7px 3px', border:'1px solid var(--g-border)', background:'rgba(200,165,74,0.025)', clipPath:'var(--g-clip-sm)' }}>
                        <span style={{ fontFamily:'var(--g-font-title)', fontSize:15, fontWeight:600, color:'var(--g-gold)', lineHeight:1 }}>{s.score}</span>
                        <span style={{ fontFamily:'var(--g-font-title)', fontSize:8, color:'var(--g-blood2)', marginTop:1 }}>{s.bonus >= 0 ? '+' : ''}{s.bonus}</span>
                        <span style={{ fontSize:7, letterSpacing:'0.12em', color:'var(--g-parch-faint)', textTransform:'uppercase', marginTop:1 }}>{s.key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </CharacterWizardLayout>
  )
}
