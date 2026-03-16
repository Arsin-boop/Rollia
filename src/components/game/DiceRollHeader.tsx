import { useState, useEffect } from 'react'
import type { RollState } from '../../types/gameSession'

type DiceRollHeaderProps = {
  roll: RollState
  t: (key: string) => string
}

export const DiceRollHeader = ({ roll, t }: DiceRollHeaderProps) => {
  const [displayValue, setDisplayValue] = useState<number>(() => {
    if (roll.status === 'done') {
      return roll.d20
    }
    return Math.floor(Math.random() * 20) + 1
  })
  const [showStatBonus, setShowStatBonus] = useState(false)
  const [showProfBonus, setShowProfBonus] = useState(false)
  const [showTotal, setShowTotal] = useState(false)
  const [showResult, setShowResult] = useState(false)

  useEffect(() => {
    if (roll.status !== 'rolling') {
      return
    }
    setShowStatBonus(false)
    setShowProfBonus(false)
    setShowTotal(false)
    setShowResult(false)
    const interval = window.setInterval(() => {
      setDisplayValue(Math.floor(Math.random() * 20) + 1)
    }, 50)
    return () => window.clearInterval(interval)
  }, [roll.status, 'startedAt' in roll ? roll.startedAt : 0])

  useEffect(() => {
    if (roll.status !== 'done') {
      return
    }
    setDisplayValue(roll.d20)
    setShowStatBonus(false)
    setShowProfBonus(false)
    setShowTotal(false)
    setShowResult(false)
    const statTimer = window.setTimeout(() => setShowStatBonus(true), 120)
    const profTimer = window.setTimeout(() => setShowProfBonus(true), 320)
    const totalTimer = window.setTimeout(() => setShowTotal(true), 520)
    const raf1 = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setShowResult(true))
    })
    return () => {
      window.clearTimeout(statTimer)
      window.clearTimeout(profTimer)
      window.clearTimeout(totalTimer)
      window.cancelAnimationFrame(raf1)
    }
  }, [roll.status, 'resolvedAt' in roll ? roll.resolvedAt : 0, 'd20' in roll ? roll.d20 : 0])

  if (roll.status === 'idle') {
    return null
  }

  const dcLabel = roll.request.dc ? `DC ${roll.request.dc}` : t('gameSession.dice.dcUnknown')
  const statLine =
    roll.status === 'done'
      ? `${roll.statBonus >= 0 ? '+' : ''}${roll.statBonus} ${roll.request.stat}`
      : ''
  const profLine =
    roll.status === 'done'
      ? `${roll.proficiencyBonus >= 0 ? '+' : ''}${roll.proficiencyBonus} ${t('gameSession.dice.proficiency')}`
      : ''

  return (
    <div className={`roll-inline ${roll.status}`}>
      <div className="roll-inline-header">
        <div className="roll-inline-title">{roll.request.label}</div>
        <div className="roll-inline-meta">
          <span>{roll.request.stat}</span>
          <span className="roll-inline-dot">·</span>
          <span>{dcLabel}</span>
        </div>
      </div>
      <div className="roll-inline-number">
        <span className={`roll-inline-value ${roll.status === 'rolling' ? 'flicker' : ''}`}>
          {displayValue}
        </span>
      </div>
      {roll.status === 'done' && (
        <>
          <div className="roll-inline-breakdown">
            <span className={`roll-inline-line ${showStatBonus ? 'show' : ''}`}>
              {statLine}
            </span>
            <span className={`roll-inline-line ${showProfBonus ? 'show' : ''}`}>
              {profLine}
            </span>
            <span className={`roll-inline-line ${showTotal ? 'show' : ''}`}>
              {t('gameSession.dice.total')} {roll.total}
            </span>
          </div>
          <div
            className={`roll-inline-result ${showResult ? 'show' : ''} ${
              roll.success ? 'success' : 'fail'
            }`}
          >
            {roll.success ? t('gameSession.dice.success') : t('gameSession.dice.fail')}
          </div>
        </>
      )}
    </div>
  )
}
