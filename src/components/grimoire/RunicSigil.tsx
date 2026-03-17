import { useCallback, useEffect, useRef, useState } from 'react'

/* ── Rune definitions ── */
interface Rune {
  name: string
  draw: (ctx: CanvasRenderingContext2D, size: number, alpha: number) => void
}

function line(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  size: number, alpha: number,
) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = `rgba(228,216,194,${alpha})`
  ctx.lineWidth   = size * 0.075
  ctx.lineCap     = 'round'
  ctx.stroke()
}

const RUNES: Rune[] = [
  {
    name: 'Raido · the journey',
    draw: (c, s, a) => {
      line(c, -s*.18,-s*.55, -s*.18,s*.55, s, a)
      line(c, -s*.18,-s*.55,  s*.24,-s*.05, s, a)
      line(c,  s*.24,-s*.05, -s*.18,-s*.05, s, a)
      line(c, -s*.18,-s*.05,  s*.28, s*.55, s, a)
    },
  },
  {
    name: 'Fehu · abundance',
    draw: (c, s, a) => {
      line(c, -s*.15,-s*.55, -s*.15,s*.55, s, a)
      line(c, -s*.15,-s*.42,  s*.28,-s*.12, s, a)
      line(c, -s*.15,-s*.08,  s*.28, s*.18, s, a)
    },
  },
  {
    name: 'Ansuz · the voice',
    draw: (c, s, a) => {
      line(c, -s*.15,-s*.55, -s*.15, s*.55, s, a)
      line(c, -s*.15,-s*.55,  s*.25,-s*.08, s, a)
      line(c,  s*.25,-s*.08, -s*.15,-s*.08, s, a)
      line(c,  s*.25, s*.08, -s*.15, s*.08, s, a)
    },
  },
  {
    name: 'Tiwaz · victory',
    draw: (c, s, a) => {
      line(c,     0,-s*.58,     0,  s*.55, s, a)
      line(c,     0,-s*.58, -s*.3,-s*.18, s, a)
      line(c,     0,-s*.58,  s*.3,-s*.18, s, a)
    },
  },
  {
    name: 'Ehwaz · the steed',
    draw: (c, s, a) => {
      line(c, -s*.2,-s*.55, -s*.2,s*.55, s, a)
      line(c, -s*.2,-s*.55,  s*.2, 0,   s, a)
      line(c, -s*.2, 0,      s*.2,s*.55, s, a)
      line(c,  s*.2,-s*.55,  s*.2,s*.55, s, a)
    },
  },
  {
    name: 'Isa · stillness',
    draw: (c, s, a) => {
      line(c, 0,-s*.58, 0,s*.58, s, a)
      line(c, -s*.18,-s*.55, s*.18,-s*.55, s, a)
      line(c, -s*.18, s*.55, s*.18, s*.55, s, a)
    },
  },
  {
    name: 'Ingwaz · the seed',
    draw: (c, s, a) => {
      line(c,     0,-s*.55,  s*.35, 0,   s, a)
      line(c,  s*.35, 0,      0,  s*.55, s, a)
      line(c,     0, s*.55, -s*.35, 0,   s, a)
      line(c, -s*.35, 0,      0,-s*.55, s, a)
    },
  },
  {
    name: 'Othalan · heritage',
    draw: (c, s, a) => {
      line(c,  0,-s*.55,  s*.32,-s*.05, s, a)
      line(c,  s*.32,-s*.05, 0, s*.22,  s, a)
      line(c,  0, s*.22, -s*.32,-s*.05, s, a)
      line(c, -s*.32,-s*.05, 0,-s*.55,  s, a)
      line(c,  s*.32,-s*.05,  s*.28,s*.55, s, a)
      line(c, -s*.32,-s*.05, -s*.28,s*.55, s, a)
    },
  },
]

/* ── Transition state ── */
type Phase = 'idle' | 'dissolve' | 'flash' | 'emerge'

interface TransState {
  phase:   Phase
  phaseT:  number
  current: number
  next:    number
}

const DISSOLVE_DUR = 0.35
const FLASH_DUR    = 0.12
const EMERGE_DUR   = 0.40
const TAU          = Math.PI * 2
const SIZE         = 200
const CX           = 100
const CY           = 100

export function RunicSigil() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const stateRef   = useRef<TransState>({ phase: 'idle', phaseT: 0, current: 0, next: 1 })
  const shakeRef   = useRef({ x: 0, y: 0, life: 0 })
  const rafRef     = useRef<number>(0)
  const startRef   = useRef<number | null>(null)
  const prevTRef   = useRef<number>(0)

  const [runeName, setRuneName]       = useState(RUNES[0].name)
  const [nameVisible, setNameVisible] = useState(true)
  const [hintFaded, setHintFaded]     = useState(false)

  const handleClick = useCallback(() => {
    const s = stateRef.current
    if (s.phase !== 'idle') return
    s.next   = (s.current + 1) % RUNES.length
    s.phase  = 'dissolve'
    s.phaseT = 0
    shakeRef.current = { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12, life: 8 }
    if (!hintFaded) setHintFaded(true)
  }, [hintFaded])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function draw(t: number) {
      const dt = t - prevTRef.current
      prevTRef.current = t
      const s  = stateRef.current
      const sh = shakeRef.current

      if (sh.life > 0) sh.life--
      if (s.phase !== 'idle') s.phaseT += dt

      if (s.phase === 'dissolve' && s.phaseT >= DISSOLVE_DUR) {
        s.phase = 'flash'; s.phaseT = 0
      } else if (s.phase === 'flash' && s.phaseT >= FLASH_DUR) {
        s.current = s.next
        setNameVisible(false)
        setTimeout(() => { setRuneName(RUNES[s.current].name); setNameVisible(true) }, 80)
        s.phase = 'emerge'; s.phaseT = 0
      } else if (s.phase === 'emerge' && s.phaseT >= EMERGE_DUR) {
        s.phase = 'idle'; s.phaseT = 0
      }

      let runeAlpha = 1, runeScale = 1, flashAlpha = 0, runeIndex = s.current

      if (s.phase === 'dissolve') {
        const p = Math.min(s.phaseT / DISSOLVE_DUR, 1)
        runeAlpha  = 1 - p
        runeScale  = 1 - p * 0.25
        flashAlpha = p * 0.4
      } else if (s.phase === 'flash') {
        const p = Math.min(s.phaseT / FLASH_DUR, 1)
        runeAlpha  = 0
        flashAlpha = 1 - p
        runeIndex  = s.next
      } else if (s.phase === 'emerge') {
        const p    = Math.min(s.phaseT / EMERGE_DUR, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        runeAlpha  = ease
        runeScale  = 0.6 + ease * 0.4
        flashAlpha = (1 - p) * 0.15
      }

      renderSigil(ctx!, t, runeIndex, runeAlpha, runeScale, flashAlpha, sh)
    }

    function loop(now: number) {
      if (!startRef.current) startRef.current = now
      const t = (now - startRef.current) / 1000
      draw(t)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <div
        onClick={handleClick}
        style={{ cursor: 'pointer', userSelect: 'none', transition: 'transform 0.1s' }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
        onMouseUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ display: 'block' }} />
      </div>

      <div style={{
        fontFamily: 'var(--g-font-italic)', fontStyle: 'italic', fontSize: 12,
        letterSpacing: '0.22em', color: 'rgba(200,165,74,0.5)',
        marginTop: 8, minHeight: 18, textAlign: 'center',
        opacity: nameVisible ? 1 : 0, transition: 'opacity 0.25s ease',
      }}>
        {runeName}
      </div>

      <div style={{
        fontFamily: 'var(--g-font-title)', fontSize: 8, letterSpacing: '0.3em',
        textTransform: 'uppercase', color: 'rgba(200,165,74,0.28)',
        marginTop: 6,
        opacity: hintFaded ? 0.12 : 1, transition: 'opacity 1s ease',
      }}>
        click to invoke
      </div>
    </div>
  )
}

/* ── Canvas renderer ── */
function renderSigil(
  ctx: CanvasRenderingContext2D,
  t: number,
  runeIndex: number,
  runeAlpha: number,
  runeScale: number,
  flashAlpha: number,
  shake: { x: number; y: number; life: number },
) {
  ctx.clearRect(0, 0, SIZE, SIZE)

  const b  = 0.5 + 0.5 * Math.sin(t * 0.72)
  const b2 = 0.5 + 0.5 * Math.sin(t * 0.72 + Math.PI)

  const sx = shake.life > 0 ? shake.x * (shake.life / 8) : 0
  const sy = shake.life > 0 ? shake.y * (shake.life / 8) : 0
  ctx.save()
  ctx.translate(sx, sy)

  // ── Ambient halo ──
  const halo = ctx.createRadialGradient(CX, CY, 65, CX, CY, 100)
  halo.addColorStop(0, `rgba(200,165,74,${(0.06 + 0.04 * b) * (1 + flashAlpha * 2)})`)
  halo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.beginPath(); ctx.arc(CX, CY, 100, 0, TAU); ctx.fillStyle = halo; ctx.fill()

  // ── Outer orbit – 24 dots ──
  ctx.save(); ctx.translate(CX, CY); ctx.rotate(t * 0.055)
  ctx.beginPath(); ctx.arc(0, 0, 88, 0, TAU)
  ctx.strokeStyle = `rgba(200,165,74,${0.09 + 0.05 * b})`; ctx.lineWidth = 0.6
  ctx.setLineDash([1.5, 6]); ctx.stroke(); ctx.setLineDash([])
  for (let i = 0; i < 24; i++) {
    const a    = (i / 24) * TAU
    const isMaj = i % 6 === 0, isMid = i % 3 === 0
    const sz   = isMaj ? 3.4 : isMid ? 1.9 : 0.9
    const al   = (isMaj ? 0.6 + 0.28 * b : isMid ? 0.32 : 0.12) * (1 + flashAlpha * 0.5)
    ctx.beginPath(); ctx.arc(Math.cos(a) * 88, Math.sin(a) * 88, sz, 0, TAU)
    ctx.fillStyle = `rgba(200,165,74,${al})`; ctx.fill()
    if (isMaj) {
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 80, Math.sin(a) * 80)
      ctx.lineTo(Math.cos(a) * 88, Math.sin(a) * 88)
      ctx.strokeStyle = `rgba(200,165,74,${0.35 + 0.2 * b})`; ctx.lineWidth = 0.8; ctx.stroke()
    }
  }
  ctx.restore()

  // ── Counter-spin arc segments ──
  ctx.save(); ctx.translate(CX, CY); ctx.rotate(-t * 0.13)
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * TAU + 0.18, a1 = a0 + TAU / 6 - 0.36
    ctx.beginPath(); ctx.arc(0, 0, 68, a0, a1)
    ctx.strokeStyle = `rgba(200,165,74,${0.18 + 0.1 * b2})`; ctx.lineWidth = 1.1; ctx.stroke()
    ctx.beginPath(); ctx.arc(Math.cos(a0) * 68, Math.sin(a0) * 68, 1.9, 0, TAU)
    ctx.fillStyle = `rgba(200,165,74,${0.5 + 0.2 * b2})`; ctx.fill()
    ctx.beginPath(); ctx.arc(Math.cos(a1) * 68, Math.sin(a1) * 68, 1.9, 0, TAU)
    ctx.fillStyle = `rgba(200,165,74,${0.5 + 0.2 * b2})`; ctx.fill()
  }
  ctx.restore()

  // ── 8-spoke mandala ──
  ctx.save(); ctx.translate(CX, CY); ctx.rotate(t * 0.19)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * 56, Math.sin(a) * 56)
    ctx.lineTo(Math.cos(a) * 65, Math.sin(a) * 65)
    ctx.strokeStyle = `rgba(200,165,74,${0.22 + 0.1 * b})`; ctx.lineWidth = 0.9; ctx.stroke()
    ctx.beginPath(); ctx.arc(Math.cos(a) * 67, Math.sin(a) * 67, 1.6, 0, TAU)
    ctx.fillStyle = `rgba(200,165,74,${0.45 + 0.2 * b})`; ctx.fill()
  }
  ctx.restore()

  // ── Middle ring ──
  ctx.beginPath(); ctx.arc(CX, CY, 54, 0, TAU)
  ctx.strokeStyle = `rgba(200,165,74,${0.1 + 0.06 * b})`; ctx.lineWidth = 0.5; ctx.stroke()

  // ── Hexagram ──
  ctx.save(); ctx.translate(CX, CY); ctx.rotate(t * 0.08)
  for (let tri = 0; tri < 2; tri++) {
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU - Math.PI / 2 + tri * (Math.PI / 3)
      i === 0
        ? ctx.moveTo(Math.cos(a) * 38, Math.sin(a) * 38)
        : ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38)
    }
    ctx.closePath()
    ctx.strokeStyle = `rgba(200,165,74,${0.28 + 0.12 * (tri === 0 ? b : b2)})`
    ctx.lineWidth = 0.9; ctx.stroke()
  }
  ctx.restore()

  // ── 4 cardinal connectors ──
  ctx.save(); ctx.translate(CX, CY); ctx.rotate(-t * 0.04)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28)
    ctx.lineTo(Math.cos(a) * 46, Math.sin(a) * 46)
    ctx.strokeStyle = `rgba(200,165,74,${0.2 + 0.1 * b})`; ctx.lineWidth = 0.7; ctx.stroke()
  }
  ctx.restore()

  // ── Inner blood glow ──
  const intensity = 1 + flashAlpha * 1.5
  const ig = ctx.createRadialGradient(CX, CY, 0, CX, CY, 28)
  ig.addColorStop(0,    `rgba(120,20,38,${(0.65 + 0.28 * b) * intensity})`)
  ig.addColorStop(0.55, `rgba(75,10,22,${(0.4 + 0.15 * b) * intensity})`)
  ig.addColorStop(1,    'rgba(0,0,0,0)')
  ctx.beginPath(); ctx.arc(CX, CY, 28, 0, TAU); ctx.fillStyle = ig; ctx.fill()
  ctx.beginPath(); ctx.arc(CX, CY, 28, 0, TAU)
  ctx.strokeStyle = `rgba(168,28,48,${(0.55 + 0.28 * b) * intensity})`; ctx.lineWidth = 1.2; ctx.stroke()

  // ── Flash burst ──
  if (flashAlpha > 0) {
    const fl = ctx.createRadialGradient(CX, CY, 0, CX, CY, 80)
    fl.addColorStop(0,   `rgba(228,216,194,${flashAlpha * 0.4})`)
    fl.addColorStop(0.3, `rgba(200,165,74,${flashAlpha * 0.18})`)
    fl.addColorStop(1,   'rgba(0,0,0,0)')
    ctx.beginPath(); ctx.arc(CX, CY, 80, 0, TAU); ctx.fillStyle = fl; ctx.fill()
  }

  // ── Rune strokes ──
  ctx.save()
  ctx.translate(CX, CY)
  ctx.scale(runeScale, runeScale)
  const glowStr = (0.5 + 0.35 * b) * (1 + flashAlpha) * runeAlpha
  ctx.shadowColor = `rgba(200,165,74,${glowStr})`
  ctx.shadowBlur  = 14 + 10 * b + flashAlpha * 20
  RUNES[runeIndex].draw(ctx, 22, runeAlpha * (0.82 + 0.15 * b))
  ctx.shadowBlur = 0
  ctx.restore()

  ctx.restore() // shake
}
