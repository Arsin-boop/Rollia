import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { CharacterWizardLayout } from './CharacterWizardLayout'

export function CharacterName() {
  const navigate = useNavigate()
  const { t }    = useI18n()
  const [name, setName] = useState(localStorage.getItem('characterName') || '')

  const handleNext = () => {
    if (!name.trim()) return
    localStorage.setItem('characterName', name.trim())
    navigate('/character/class')
  }

  return (
    <CharacterWizardLayout
      step={{ number: 1, total: 5, title: t('characterName.title'), hint: t('characterName.step') }}
      onNext={handleNext}
      nextDisabled={!name.trim()}
      nextLabel={t('common.next') + ' →'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="g-label" style={{ marginBottom: 4 }}>
          {t('characterName.label')}
        </label>
        <div style={{ position: 'relative' }}>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNext()}
            placeholder={t('characterName.placeholder')}
            className="g-input"
            style={{ fontSize: 16, padding: '12px 16px' }}
          />
        </div>
        <p style={{ fontFamily: 'var(--g-font-italic)', fontStyle: 'italic', fontSize: 12, color: 'rgba(200,165,74,0.35)', marginTop: 4 }}>
          This name will echo through every tale that follows.
        </p>
      </div>
    </CharacterWizardLayout>
  )
}
