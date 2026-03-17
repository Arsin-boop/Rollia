import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { CharacterWizardLayout } from './CharacterWizardLayout'

export function CharacterBackstory() {
  const navigate = useNavigate()
  const { t }    = useI18n()
  const [backstory, setBackstory] = useState(localStorage.getItem('characterBackstory') || '')

  const handleNext = () => {
    if (!backstory.trim()) return
    localStorage.setItem('characterBackstory', backstory.trim())
    navigate('/character/appearance')
  }

  return (
    <CharacterWizardLayout
      step={{ number: 3, total: 5, title: t('characterBackstory.title'), hint: t('characterBackstory.step') }}
      onBack={() => navigate('/character/class')}
      onNext={handleNext}
      nextDisabled={!backstory.trim()}
      nextLabel={t('common.next') + ' →'}
      backLabel={'← ' + t('common.back')}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="g-label" style={{ marginBottom: 4 }}>
          {t('characterBackstory.label')}
        </label>
        <textarea
          autoFocus
          value={backstory}
          onChange={e => setBackstory(e.target.value)}
          placeholder={t('characterBackstory.placeholder')}
          rows={8}
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--g-border)',
            borderBottom: '1px solid rgba(200,165,74,0.28)',
            color: 'var(--g-parch)',
            fontFamily: 'var(--g-font-body)',
            fontStyle: 'italic',
            fontSize: 15,
            lineHeight: 1.75,
            padding: '14px 16px',
            outline: 'none',
            resize: 'vertical',
            width: '100%',
            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
            transition: 'border-color 0.2s, background 0.2s',
          }}
          onFocus={e => { e.target.style.borderBottomColor = 'var(--g-gold)'; e.target.style.background = 'rgba(200,165,74,0.025)' }}
          onBlur={e  => { e.target.style.borderBottomColor = 'rgba(200,165,74,0.28)'; e.target.style.background = 'rgba(255,255,255,0.02)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <p style={{ fontFamily: 'var(--g-font-italic)', fontStyle: 'italic', fontSize: 12, color: 'rgba(200,165,74,0.35)' }}>
            What drove you to this path?
          </p>
          <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(200,165,74,0.25)' }}>
            {backstory.length} chars
          </span>
        </div>
      </div>
    </CharacterWizardLayout>
  )
}
