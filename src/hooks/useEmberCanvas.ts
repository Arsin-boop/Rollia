import { useEffect, useRef } from 'react'

interface EmberOptions {
  count?: number
  includeRunes?: boolean
}

export function useEmberCanvas(options: EmberOptions = {}) {
  const { count = 120, includeRunes = false } = options
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const COLORS = [
      'rgba(200,165,74,',
      'rgba(180,145,55,',
      'rgba(122,21,37,',
      'rgba(180,90,30,',
    ]

    const RUNES = [
      'ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᚺ','ᚾ',
      'ᛁ','ᛃ','ᛇ','ᛈ','ᛉ','ᛊ','ᛏ','ᛒ','ᛖ','ᛗ','ᛚ','ᛜ','ᛞ','ᛟ',
    ]

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    class Ember {
      x = 0; y = 0; r = 0
      vx = 0; vy = 0
      a = 0; ma = 0
      life = 0; ml = 0
      color = ''
      tw = 0; ts = 0

      constructor(init = false) { this.reset(init) }

      reset(init = false) {
        this.x  = Math.random() * canvas!.width
        this.y  = init ? Math.random() * canvas!.height : canvas!.height + 5
        this.r  = Math.random() * 2.2 + 0.6
        this.vy = -(Math.random() * 0.35 + 0.07)
        this.vx = (Math.random() - 0.5) * 0.12
        this.a  = 0
        this.ma = Math.random() * 0.45 + 0.55
        this.life = 0
        this.ml = Math.random() * 450 + 220
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)]
        this.tw = Math.random() * Math.PI * 2
        this.ts = Math.random() * 0.022 + 0.007
      }

      tick() {
        this.life++
        this.tw += this.ts
        const p = this.life / this.ml
        if (p < 0.12)      this.a = (p / 0.12) * this.ma
        else if (p > 0.72) this.a = ((1 - p) / 0.28) * this.ma
        else               this.a = this.ma

        // Random flicker: occasional sharp dips in brightness
        const flicker = Math.random()
        if (flicker < 0.04) {
          this.a *= 0.08 + Math.random() * 0.25   // резкий провал
        } else if (flicker < 0.12) {
          this.a *= 0.5 + Math.random() * 0.35    // частичное мигание
        } else {
          this.a *= 0.82 + 0.18 * Math.sin(this.tw)  // мягкая пульсация
        }

        this.x += this.vx
        this.y += this.vy
        if (this.life >= this.ml) this.reset()
      }

      draw() {
        ctx!.beginPath()
        ctx!.arc(this.x, this.y, this.r, 0, Math.PI * 2)
        ctx!.fillStyle = this.color + this.a + ')'
        ctx!.fill()
      }
    }

    class RuneGlyph {
      x = 0; y = 0
      char = ''
      size = 0
      vx = 0; vy = 0
      a = 0; ma = 0
      life = 0; ml = 0
      rotation = 0; rotSpeed = 0

      constructor(init = false) { this.reset(init) }

      reset(init = false) {
        this.char = RUNES[Math.floor(Math.random() * RUNES.length)]
        this.x    = Math.random() * canvas!.width
        this.y    = init ? Math.random() * canvas!.height : canvas!.height + 30
        this.size = Math.random() * 10 + 8
        this.vy   = -(Math.random() * 0.12 + 0.03)
        this.vx   = (Math.random() - 0.5) * 0.05
        this.a    = 0
        this.ma   = Math.random() * 0.055 + 0.015
        this.life = 0
        this.ml   = Math.random() * 800 + 400
        this.rotation  = Math.random() * Math.PI * 2
        this.rotSpeed  = (Math.random() - 0.5) * 0.002
      }

      tick() {
        this.life++
        this.rotation += this.rotSpeed
        const p = this.life / this.ml
        if (p < 0.1)       this.a = (p / 0.1) * this.ma
        else if (p > 0.8)  this.a = ((1 - p) / 0.2) * this.ma
        else               this.a = this.ma
        this.x += this.vx
        this.y += this.vy
        if (this.life >= this.ml) this.reset()
      }

      draw() {
        ctx!.save()
        ctx!.translate(this.x, this.y)
        ctx!.rotate(this.rotation)
        ctx!.font = `${this.size}px serif`
        ctx!.fillStyle = `rgba(200,165,74,${this.a})`
        ctx!.textAlign = 'center'
        ctx!.textBaseline = 'middle'
        ctx!.fillText(this.char, 0, 0)
        ctx!.restore()
      }
    }

    const embers = Array.from({ length: count }, () => new Ember(true))
    const runes  = includeRunes ? Array.from({ length: 22 }, () => new RuneGlyph(true)) : []

    let glowPhase = 0
    let raf: number

    function frame() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      glowPhase += 0.004

      const grad = ctx.createRadialGradient(
        canvas!.width * 0.5, canvas!.height * 0.5, 0,
        canvas!.width * 0.5, canvas!.height * 0.5, canvas!.width * 0.55,
      )
      grad.addColorStop(0, `rgba(22,10,16,${0.06 + 0.018 * Math.sin(glowPhase)})`)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, canvas!.width, canvas!.height)

      // Campfire glow — full bottom edge
      const firePhase1 = Math.sin(glowPhase * 2.3)
      const firePhase2 = Math.sin(glowPhase * 3.7 + 1.1)
      const glowHeight = canvas!.height * (0.45 + 0.04 * firePhase1)
      const fireGrad = ctx.createLinearGradient(0, canvas!.height, 0, canvas!.height - glowHeight)
      fireGrad.addColorStop(0,    `rgba(200, 80, 15, ${0.38 + 0.10 * firePhase1})`)
      fireGrad.addColorStop(0.18, `rgba(160, 50, 8,  ${0.22 + 0.07 * firePhase2})`)
      fireGrad.addColorStop(0.45, `rgba(100, 18, 4,  ${0.10 + 0.04 * firePhase1})`)
      fireGrad.addColorStop(1,    'rgba(0,0,0,0)')
      ctx.fillStyle = fireGrad
      ctx.fillRect(0, 0, canvas!.width, canvas!.height)

      runes.forEach(r => { r.tick(); r.draw() })
      embers.forEach(e => { e.tick(); e.draw() })

      raf = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [count, includeRunes])

  return canvasRef
}
