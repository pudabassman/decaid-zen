import { useEffect, useRef } from 'react'
import type { ShotMeasurement, ShotRecord } from '../api/types'

const baseSeries = (yieldByWeight: boolean) => [
  { pick: (m: ShotMeasurement) => m.machine.mixTemperature,
    target: (m: ShotMeasurement) => m.machine.targetMixTemperature, color: '#d9714f', min: 80, max: 100, band: 0.34, width: 1.6, unit: '°', digits: 1 },
  { pick: (m: ShotMeasurement) => m.machine.pressure,
    target: (m: ShotMeasurement) => m.machine.targetPressure, color: '#9fb055', min: 0, max: 12, band: 1, width: 2.2, unit: ' bar', digits: 1 },
  yieldByWeight
    ? { pick: (m: ShotMeasurement) => m.scale?.weight ?? null, target: () => null, color: '#d3b06a', min: 0, max: 50, band: 1, width: 2.2, unit: ' g', digits: 1 }
    : { pick: (m: ShotMeasurement) => m.volume ?? null, target: () => null, color: '#d3b06a', min: 0, max: 80, band: 1, width: 2.2, unit: ' ml', digits: 0 },
  { pick: (m: ShotMeasurement) => m.machine.flow,
    target: (m: ShotMeasurement) => m.machine.targetFlow, color: '#4fbcc6', min: 0, max: 6, band: 1, width: 1.7, unit: ' ml/s', digits: 1 },
]

/** headroom kept clear at the top of the plot for the caption and swatches */
/** how far a line's colour bleeds below it */
const SHADOW = 34

const PAD_TOP = 56
/** floor and ceiling for the right-hand label gutter */
const PAD_RIGHT_MIN = 40
const PAD_RIGHT_MAX = 84

export function LastShotGraph({ shot }: { shot: ShotRecord | null }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = canvas.current
    const wrap = box.current
    if (!el || !wrap) return

    const draw = () => {
      const dpr = globalThis.devicePixelRatio || 1
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      if (w === 0 || h === 0) return
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      const ctx = el.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const plot = Math.max(1, h - PAD_TOP)

      // the gutter is only as wide as the widest value that has to live in it
      const measured = shot?.measurements ?? []
      const sample = baseSeries(measured.some((m) => (m.scale?.weight ?? 0) > 0))
      ctx.font = "11px 'Jost', sans-serif"
      let widest = 0
      for (const s of sample) {
        for (let i = measured.length - 1; i >= 0; i--) {
          const raw = s.pick(measured[i])
          if (raw === null || raw === undefined) continue
          widest = Math.max(widest, ctx.measureText(`${raw.toFixed(s.digits)}${s.unit}`).width)
          break
        }
      }
      const padRight = Math.round(
        Math.min(PAD_RIGHT_MAX, Math.max(PAD_RIGHT_MIN, widest + 15)),
      )
      // and a left gutter for the target start values
      let widestStart = 0
      for (const s of sample) {
        for (const point of measured) {
          const raw = s.target(point)
          if (raw === null || raw === undefined) continue
          widestStart = Math.max(widestStart, ctx.measureText(`${raw.toFixed(s.digits)}${s.unit}`).width)
          break
        }
      }
      const padLeft = widestStart ? Math.round(widestStart + 12) : 0
      const plotW = Math.max(1, w - padRight)
      const plotSpan = Math.max(1, plotW - padLeft)



      const points = shot?.measurements ?? []
      if (points.length < 2) return
      const t0 = Date.parse(points[0].machine.timestamp)
      const tEnd = Date.parse(points[points.length - 1].machine.timestamp)
      const span = Math.max(1, (tEnd - t0) / 1000)

      const yieldByWeight = points.some((m) => (m.scale?.weight ?? 0) > 0)
      const column: Array<{ y: number; color: string; text: string; weight: number; tick: boolean }> = []

      // what the profile asked for, drawn quietly behind what happened
      for (const s of baseSeries(yieldByWeight)) {
        ctx.save()
        ctx.strokeStyle = `${s.color}3d`
        ctx.lineWidth = 1.2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        let open = false
        for (const point of points) {
          const raw = s.target(point)
          if (raw === null || raw === undefined) continue
          const t = (Date.parse(point.machine.timestamp) - t0) / 1000
          const value = Math.max(s.min, Math.min(s.max, raw))
          const frac = (value - s.min) / (s.max - s.min)
          const y =
            s.band === 1 ? PAD_TOP + (1 - frac) * plot : PAD_TOP + (1 - frac) * plot * s.band
          const x = padLeft + (t / span) * plotSpan
          if (open) ctx.lineTo(x, y)
          else {
            ctx.moveTo(x, y)
            open = true
          }
        }
        ctx.stroke()
        ctx.restore()
      }

      for (const s of baseSeries(yieldByWeight)) {
        const drawn: Array<[number, number]> = []
        for (const point of points) {
          const raw = s.pick(point)
          if (raw === null || raw === undefined) continue
          const t = (Date.parse(point.machine.timestamp) - t0) / 1000
          const value = Math.max(s.min, Math.min(s.max, raw))
          const frac = (value - s.min) / (s.max - s.min)
          const y =
            s.band === 1
              ? PAD_TOP + (1 - frac) * plot
              : PAD_TOP + (1 - frac) * plot * s.band
          drawn.push([padLeft + (t / span) * plotSpan, y])
        }

        if (drawn.length > 1) {
          // a short wash under the line, in its own colour, gone within SHADOW px
          const top = Math.min(...drawn.map(([, y]) => y))
          const fade = ctx.createLinearGradient(0, top, 0, top + SHADOW)
          fade.addColorStop(0, `${s.color}26`)
          fade.addColorStop(1, `${s.color}00`)
          ctx.save()
          ctx.fillStyle = fade
          ctx.beginPath()
          ctx.moveTo(drawn[0][0], drawn[0][1])
          for (const [x, y] of drawn.slice(1)) ctx.lineTo(x, y)
          for (let i = drawn.length - 1; i >= 0; i--) {
            ctx.lineTo(drawn[i][0], Math.min(h, drawn[i][1] + SHADOW))
          }
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }

        ctx.save()
        ctx.strokeStyle = s.color
        ctx.lineWidth = s.width
        ctx.lineJoin = 'round'
        ctx.shadowColor = s.color
        ctx.shadowBlur = 6
        ctx.shadowOffsetY = 2
        ctx.beginPath()
        drawn.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.stroke()
        ctx.restore()

        const yFor = (value: number) => {
          const clamped = Math.max(s.min, Math.min(s.max, value))
          const frac = (clamped - s.min) / (s.max - s.min)
          return s.band === 1 ? PAD_TOP + (1 - frac) * plot : PAD_TOP + (1 - frac) * plot * s.band
        }

        for (let i = points.length - 1; i >= 0; i--) {
          const raw = s.pick(points[i])
          if (raw === null || raw === undefined) continue

          column.push({
            y: yFor(raw),
            color: s.color,
            text: `${raw.toFixed(s.digits)}${s.unit}`,
            weight: 1,
            tick: false,
          })

          const targets = points.map((point) => s.target(point)).filter((v) => v !== null && v !== undefined) as number[]
          if (targets.length) {
            const first = targets[0]
            const last = targets[targets.length - 1]
            ctx.font = "10px 'Jost', sans-serif"
            ctx.textAlign = 'end'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = `${s.color}7a`
            ctx.fillText(`${first.toFixed(s.digits)}${s.unit}`, padLeft - 6, yFor(first))
            ctx.textAlign = 'start'
            column.push({
              y: yFor(last),
              color: `${s.color}7a`,
              text: `${last.toFixed(s.digits)}${s.unit}`,
              weight: 0,
              tick: false,
            })
          }

          break
        }
      }

      // end values claim their place first; a scale mark too close to one is dropped
      column.sort((a, b) => b.weight - a.weight || a.y - b.y)
      const placed: typeof column = []
      for (const label of column) {
        if (label.y < PAD_TOP + 4 || label.y > h - 4) continue
        if (placed.some((other) => Math.abs(other.y - label.y) < 12)) continue
        placed.push(label)
      }

      ctx.textAlign = 'start'
      ctx.textBaseline = 'middle'
      for (const label of placed) {
        if (label.tick) {
          ctx.strokeStyle = label.color
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(plotW, Math.round(label.y) + 0.5)
          ctx.lineTo(plotW + 7, Math.round(label.y) + 0.5)
          ctx.stroke()
        }
        ctx.font = label.weight ? "11px 'Jost', sans-serif" : "9px 'Jost', sans-serif"
        ctx.fillStyle = label.color
        ctx.fillText(label.text, plotW + 11, label.y)
      }

      ctx.font = "10px 'Jost', sans-serif"
      ctx.textBaseline = 'alphabetic'
      const tickEvery = span > 45 ? 20 : 10
      for (let t = tickEvery; t <= span - 4; t += tickEvery) {
        const x = Math.round(padLeft + (t / span) * plotSpan) + 0.5
        ctx.strokeStyle = '#45413a'
        ctx.beginPath()
        ctx.moveTo(x, h)
        ctx.lineTo(x, h - 7)
        ctx.stroke()
        ctx.fillStyle = '#7d7669'
        ctx.textAlign = 'center'
        ctx.fillText(`${t}s`, x, h - 12)
      }
      ctx.fillStyle = '#7d7669'
      ctx.textAlign = 'end'
      ctx.fillText(`${span.toFixed(0)}s`, plotW - 1, h - 12)
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [shot])

  return (
    <div ref={box} className="grow" style={{ position: 'relative', minHeight: 120 }}>
      <canvas ref={canvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {!shot && (
        <div className="cap" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          No shot data
        </div>
      )}
    </div>
  )
}
