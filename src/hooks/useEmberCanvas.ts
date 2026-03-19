import { useEffect, useRef } from 'react'

interface EmberOptions {
  count?: number
  includeRunes?: boolean
  spawnYFactor?: number
}

export function useEmberCanvas(options: EmberOptions = {}) {
  const { count = 120, includeRunes = false, spawnYFactor = 1.0 } = options
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const RUNES = [
      'ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ',
      'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛜ', 'ᛞ', 'ᛟ',
    ]

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ─── Ember: реалистичный уголёк от огня ───────────────────────────────
    // Форма: не круг, а вытянутый эллипс / неровный полигон
    // Физика: вылетает снизу с импульсом, затухает по дуге, рандомный drift
    // Цвет: от яркого оранжево-белого (горит) до тёмно-красного (гаснет)
    class Ember {
      x = 0; y = 0
      // Размер: ширина и высота разные — уголёк вытянутый
      rx = 0; ry = 0
      rotation = 0; rotSpeed = 0
      vx = 0; vy = 0
      // Случайное колебание по x (эффект "подхвачен воздухом")
      driftPhase = 0; driftSpeed = 0; driftAmp = 0
      a = 0; ma = 0
      life = 0; ml = 0
      // Стадия горения: 0 = ярко-оранжевый, 1 = красный, 2 = тёмно-серый (тлеет)
      heatPhase = 0
      // Хвост: несколько предыдущих позиций
      trail: Array<{ x: number; y: number; a: number }> = []

      constructor(init = false) { this.reset(init) }

      reset(init = false) {
        const w = canvas!.width
        const h = canvas!.height

        // Угольки вылетают из нижней трети экрана, не из одной точки
        this.x = w * 0.2 + Math.random() * w * 0.6
        this.y = init
          ? Math.random() * h * spawnYFactor
          : h * spawnYFactor + Math.random() * 40

        // Форма угольков: вытянутые или почти круглые, небольшие
        const baseR = Math.random() * 1.6 + 0.5
        this.rx = baseR * (0.4 + Math.random() * 0.6)
        this.ry = baseR * (1.0 + Math.random() * 1.2)

        // Начальный угол наклона
        this.rotation = Math.random() * Math.PI * 2
        // Угольки вращаются медленно, иногда резче
        this.rotSpeed = (Math.random() - 0.5) * 0.035

        // Скорость: вверх (vy отрицательный) + небольшой горизонтальный импульс
        this.vy = -(Math.random() * 0.55 + 0.55)
        this.vx = (Math.random() - 0.5) * 0.18

        // Drift — плавное покачивание влево-вправо, как у горящего уголька
        this.driftPhase = Math.random() * Math.PI * 2
        this.driftSpeed = Math.random() * 0.028 + 0.008
        this.driftAmp = Math.random() * 0.28 + 0.05

        this.a = 0
        this.ma = Math.random() * 0.55 + 0.3
        this.life = 0
        this.ml = Math.random() * 380 + 160

        // heatPhase: чем моложе уголёк — тем горячее (ярче)
        this.heatPhase = 0

        this.trail = []
      }

      // Цвет в зависимости от стадии горения и яркости
      getColor(alpha: number): string {
        const p = this.heatPhase // 0 = горит, 1 = гаснет
        // Горит: ярко-жёлто-оранжевый → красный → тёмно-красный → почти чёрный
        if (p < 0.25) {
          // Ярко горит: от почти-белого через жёлтый к оранжевому
          const t = p / 0.25
          const r = 255
          const g = Math.round(210 - t * 100)  // 210 → 110
          const b = Math.round(80 - t * 75)   // 80  → 5
          return `rgba(${r},${g},${b},${alpha})`
        } else if (p < 0.6) {
          // Оранжево-красный
          const t = (p - 0.25) / 0.35
          const r = Math.round(255 - t * 55)   // 255 → 200
          const g = Math.round(110 - t * 85)   // 110 → 25
          const b = 5
          return `rgba(${r},${g},${b},${alpha})`
        } else {
          // Тлеет: тёмно-красный → почти чёрный с красным отливом
          const t = (p - 0.6) / 0.4
          const r = Math.round(200 - t * 150)  // 200 → 50
          const g = Math.round(25 - t * 20)   // 25  → 5
          const b = 5
          return `rgba(${r},${g},${b},${alpha})`
        }
      }

      tick() {
        this.life++
        const p = this.life / this.ml
        this.heatPhase = p

        // Прозрачность: нарастает быстро, затухает постепенно
        if (p < 0.08) {
          this.a = (p / 0.08) * this.ma
        } else if (p > 0.65) {
          this.a = ((1 - p) / 0.35) * this.ma
        } else {
          this.a = this.ma
        }

        // Мерцание: угольки периодически ярко вспыхивают или гаснут
        const flicker = Math.random()
        if (flicker < 0.035) {
          // Резкий провал — уголёк почти гаснет
          this.a *= 0.05 + Math.random() * 0.15
        } else if (flicker < 0.10) {
          // Небольшое мерцание
          this.a *= 0.45 + Math.random() * 0.4
        }
        // Иногда — яркая вспышка (переохлаждение)
        if (Math.random() < 0.018 && p < 0.4) {
          this.a = Math.min(1, this.a * 1.8)
        }

        // Движение: вверх + drift
        this.driftPhase += this.driftSpeed
        this.x += this.vx + Math.sin(this.driftPhase) * this.driftAmp
        this.y += this.vy

        // Гравитация/замедление: уголёк постепенно замедляется и
        // начинает падать обратно (физика реального угольного пепла)
        this.vy *= 0.998
        if (p > 0.5) this.vy += 0.0012  // лёгкое падение на излёте

        // Вращение
        this.rotation += this.rotSpeed

        // Хвост: запоминаем позиции
        this.trail.push({ x: this.x, y: this.y, a: this.a })
        if (this.trail.length > 5) this.trail.shift()

        if (this.life >= this.ml) this.reset()
      }

      draw() {
        // Рисуем хвост (след угольков)
        for (let i = 0; i < this.trail.length - 1; i++) {
          const tp = i / this.trail.length
          const ta = this.trail[i].a * tp * 0.35
          if (ta < 0.01) continue
          ctx!.save()
          ctx!.translate(this.trail[i].x, this.trail[i].y)
          ctx!.globalAlpha = ta
          ctx!.beginPath()
          ctx!.arc(0, 0, this.rx * 0.5, 0, Math.PI * 2)
          ctx!.fillStyle = this.getColor(1)
          ctx!.fill()
          ctx!.restore()
        }

        // Рисуем сам уголёк — вытянутый эллипс
        ctx!.save()
        ctx!.translate(this.x, this.y)
        ctx!.rotate(this.rotation)
        ctx!.globalAlpha = this.a

        // Внешнее свечение (тёплый ореол)
        if (this.a > 0.08 && this.heatPhase < 0.7) {
          const glowR = Math.max(this.rx, this.ry) * 3.5
          const grd = ctx!.createRadialGradient(0, 0, 0, 0, 0, glowR)
          const glowColor = this.heatPhase < 0.3
            ? `rgba(255,160,30,`
            : `rgba(180,40,8,`
          grd.addColorStop(0, glowColor + (this.a * 0.4) + ')')
          grd.addColorStop(0.5, glowColor + (this.a * 0.1) + ')')
          grd.addColorStop(1, 'rgba(0,0,0,0)')
          ctx!.beginPath()
          ctx!.ellipse(0, 0, glowR, glowR, 0, 0, Math.PI * 2)
          ctx!.fillStyle = grd
          ctx!.fill()
        }

        // Тело угольника: неровный эллипс через bezier
        ctx!.beginPath()
        // Вместо чистого эллипса — слегка "сломанная" форма
        const rx = this.rx
        const ry = this.ry
        const wobble = () => 1 + (Math.random() - 0.5) * 0.18

        ctx!.moveTo(0, -ry * wobble())
        ctx!.bezierCurveTo(
          rx * wobble(), -ry * 0.5 * wobble(),
          rx * wobble(), ry * 0.5 * wobble(),
          0, ry * wobble()
        )
        ctx!.bezierCurveTo(
          -rx * wobble(), ry * 0.5 * wobble(),
          -rx * wobble(), -ry * 0.5 * wobble(),
          0, -ry * wobble()
        )

        ctx!.fillStyle = this.getColor(1)
        ctx!.fill()

        // Белый бликовый центр для горящих угольков
        if (this.heatPhase < 0.3 && this.a > 0.3) {
          ctx!.beginPath()
          ctx!.ellipse(0, -ry * 0.2, rx * 0.4, ry * 0.25, 0, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(255,240,200,${this.a * 0.7})`
          ctx!.fill()
        }

        ctx!.restore()
        ctx!.globalAlpha = 1
      }
    }

    // ─── RuneGlyph без изменений ──────────────────────────────────────────
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
        this.x = Math.random() * canvas!.width
        this.y = init ? Math.random() * canvas!.height : canvas!.height + 30
        this.size = Math.random() * 10 + 8
        this.vy = -(Math.random() * 0.12 + 0.03)
        this.vx = (Math.random() - 0.5) * 0.05
        this.a = 0
        this.ma = Math.random() * 0.055 + 0.015
        this.life = 0
        this.ml = Math.random() * 800 + 400
        this.rotation = Math.random() * Math.PI * 2
        this.rotSpeed = (Math.random() - 0.5) * 0.002
      }

      tick() {
        this.life++
        this.rotation += this.rotSpeed
        const p = this.life / this.ml
        if (p < 0.1) this.a = (p / 0.1) * this.ma
        else if (p > 0.8) this.a = ((1 - p) / 0.2) * this.ma
        else this.a = this.ma
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
    const runes = includeRunes ? Array.from({ length: 22 }, () => new RuneGlyph(true)) : []

    let glowPhase = 0
    let raf: number

    function frame() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      glowPhase += 0.004

      // Центральный туман
      const grad = ctx!.createRadialGradient(
        canvas!.width * 0.5, canvas!.height * 0.5, 0,
        canvas!.width * 0.5, canvas!.height * 0.5, canvas!.width * 0.55,
      )
      grad.addColorStop(0, `rgba(22,10,16,${0.06 + 0.018 * Math.sin(glowPhase)})`)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx!.fillStyle = grad
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height)

      // Огненное свечение снизу
      const firePhase1 = Math.sin(glowPhase * 2.3)
      const firePhase2 = Math.sin(glowPhase * 3.7 + 1.1)
      const glowHeight = canvas!.height * (0.45 + 0.04 * firePhase1)
      const fireGrad = ctx!.createLinearGradient(0, canvas!.height, 0, canvas!.height - glowHeight)
      fireGrad.addColorStop(0, `rgba(200, 80, 15, ${0.38 + 0.10 * firePhase1})`)
      fireGrad.addColorStop(0.18, `rgba(160, 50, 8,  ${0.22 + 0.07 * firePhase2})`)
      fireGrad.addColorStop(0.45, `rgba(100, 18, 4,  ${0.10 + 0.04 * firePhase1})`)
      fireGrad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx!.fillStyle = fireGrad
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height)

      runes.forEach(r => { r.tick(); r.draw() })
      embers.forEach(e => { e.tick(); e.draw() })

      raf = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [count, includeRunes, spawnYFactor])

  return canvasRef
}
