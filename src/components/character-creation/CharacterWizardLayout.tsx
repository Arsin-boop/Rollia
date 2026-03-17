import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmberCanvas } from '../../hooks/useEmberCanvas'

interface StepMeta {
  number: number
  total:  number
  title:  string
  hint?:  string
}

interface CharacterWizardLayoutProps {
  children:      ReactNode
  step:          StepMeta
  onBack?:       () => void
  onNext?:       () => void
  nextLabel?:    string
  backLabel?:    string
  nextDisabled?: boolean
  nextLoading?:  boolean
  wide?:         boolean
}

const STEP_LABELS = ['Name', 'Class', 'Backstory', 'Appearance', 'Review']

export function CharacterWizardLayout({
  children,
  step,
  onBack,
  onNext,
  nextLabel    = 'Continue →',
  backLabel    = '← Back',
  nextDisabled = false,
  nextLoading  = false,
  wide         = false,
}: CharacterWizardLayoutProps) {
  const navigate  = useNavigate()
  const canvasRef = useEmberCanvas({ count: 60 })

  return (
    <div style={{
      position: 'relative', width: '100%', minHeight: '100vh',
      background: 'var(--g-ink)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      overflowX: 'hidden',
    }}>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} />

      {/* Grain */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")`,
      }} />

      {/* Vignette */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(4,2,7,0.65) 100%)' }} />

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, width: '100%', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 48,
        background: 'rgba(5,3,8,0.82)',
        borderBottom: '1px solid var(--g-border)',
        backdropFilter: 'blur(4px)',
      }}>
        <span
          style={{
            fontFamily: 'var(--g-font-display)', fontSize: 16, fontWeight: 700,
            color: 'var(--g-gold)', letterSpacing: '0.1em',
            textShadow: '0 0 16px rgba(200,165,74,0.3)',
            cursor: 'pointer', userSelect: 'none',
          }}
          onClick={() => navigate('/')}
        >
          Rol<span style={{ color: 'var(--g-blood2)' }}>l</span>ia
        </span>

        {/* Step pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {STEP_LABELS.map((label, i) => {
            const isDone    = i + 1 < step.number
            const isCurrent = i + 1 === step.number
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && (
                  <div style={{ width: 16, height: 1, background: isDone ? 'rgba(200,165,74,0.4)' : 'rgba(200,165,74,0.1)' }} />
                )}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 9px',
                  fontFamily: 'var(--g-font-title)', fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: isCurrent ? 'var(--g-gold)' : isDone ? 'rgba(200,165,74,0.5)' : 'rgba(200,165,74,0.2)',
                  border: '1px solid',
                  borderColor: isCurrent ? 'rgba(200,165,74,0.35)' : isDone ? 'rgba(200,165,74,0.2)' : 'rgba(200,165,74,0.07)',
                  background: isCurrent ? 'rgba(200,165,74,0.06)' : 'transparent',
                  clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                  transition: 'all 0.3s',
                }}>
                  {isDone && <span style={{ fontSize: 7 }}>✓</span>}
                  {label}
                </div>
              </div>
            )
          })}
        </div>

        <button className="g-btn-sm" onClick={() => navigate('/characters')} style={{ fontSize: 8 }}>
          ← Characters
        </button>
      </header>

      {/* Main content */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: wide ? 900 : 600,
        padding: '40px 24px 60px',
        display: 'flex', flexDirection: 'column', gap: 0,
        animation: 'g-fade-up 0.45s ease forwards',
      }}>
        {/* Step title block */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 28, height: 28, flexShrink: 0,
              border: '1px solid rgba(200,165,74,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--g-font-title)', fontSize: 11, color: 'var(--g-gold)',
              clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
              background: 'rgba(200,165,74,0.05)',
            }}>
              {step.number}
            </div>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(200,165,74,0.2), transparent)' }} />
            <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 8, letterSpacing: '0.25em', color: 'rgba(200,165,74,0.3)', textTransform: 'uppercase' }}>
              Step {step.number} of {step.total}
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--g-font-title)', fontWeight: 600, fontSize: 26, color: 'var(--g-parch)', letterSpacing: '0.05em', margin: 0 }}>
            {step.title}
          </h1>
          {step.hint && (
            <p style={{ fontFamily: 'var(--g-font-italic)', fontStyle: 'italic', fontSize: 14, color: 'var(--g-parch-faint)', marginTop: 6, lineHeight: 1.6 }}>
              {step.hint}
            </p>
          )}
        </div>

        {children}

        {/* Footer nav */}
        {(onBack || onNext) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
            {onBack && (
              <button onClick={onBack} className="g-btn-secondary" style={{ padding: '11px 20px', fontSize: 10 }}>
                {backLabel}
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
                disabled={nextDisabled || nextLoading}
                className="g-btn-primary"
                style={{ flex: 1, padding: '11px 24px', fontSize: 10, opacity: nextDisabled ? 0.4 : 1, cursor: nextDisabled ? 'not-allowed' : 'pointer' }}
              >
                {nextLoading ? '...' : nextLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
