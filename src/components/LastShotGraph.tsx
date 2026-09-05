import { useEffect, useRef } from 'react'
import type { ShotMeasurement, ShotRecord } from '../api/types'

const baseSeries = (yieldByWeight: boolean) => [
  { pick: (m: ShotMeasurement) => m.machine.mixTemperature, color: '#d9714f', min: 80, max: 100, band: 0.34, width: 1.6 },
  { pick: (m: ShotMeasurement) => m.machine.pressure, color: '#9fb055', min: 0, max: 12, band: 1, width: 2.2 },
  yieldByWeight
    ? { pick: (m: ShotMeasurement) => m.scale?.weight ?? null, color: '#d3b06a', min: 0, max: 50, band: 1, width: 2.2 }
    : { pick: (m: ShotMeasurement) => m.volume ?? null, color: '#d3b06a', min: 0, max: 80, band: 1, width: 2.2 },
  { pick: (m: ShotMeasurement) => m.machine.flow, color: '#4fbcc6', min: 0, max: 6, band: 1, width: 1.7 },
]

/** headroom kept clear at the top of the plot for the caption and swatches */
const PAD_TOP = 56
/** the only y values worth naming: the pressure line's mid and high marks */
const GRID_BARS = [4, 8]

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
      const barY = (bar: number) => PAD_TOP + (1 - bar / 12) * plot

      ctx.strokeStyle = '#201e1a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, PAD_TOP + 0.5)
      ctx.lineTo(w, PAD_TOP + 0.5)
      ctx.stroke()
      for (const bar of GRID_BARS) {
        const y = Math.round(barY(bar)) + 0.5
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
      ctx.font = "10px 'Jost', sans-serif"
      ctx.textAlign = 'start'
      ctx.textBaseline = 'middle'
      GRID_BARS.forEach((bar, i) => {
        const y = Math.round(barY(bar)) + 0.5
        ctx.strokeStyle = '#45413a'
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(8, y)
        ctx.stroke()
        ctx.fillStyle = '#7d7669'
        ctx.fillText(i === GRID_BARS.length - 1 ? `${bar} bar` : `${bar}`, 13, y)
      })

      const points = shot?.measurements ?? []
      if (points.length < 2) return
      const t0 = Date.parse(points[0].machine.timestamp)
      const tEnd = Date.parse(points[points.length - 1].machine.timestamp)
      const span = Math.max(1, (tEnd - t0) / 1000)

      const yieldByWeight = points.some((m) => (m.scale?.weight ?? 0) > 0)
      for (const s of baseSeries(yieldByWeight)) {
        ctx.save()
        ctx.strokeStyle = s.color
        ctx.lineWidth = s.width
        ctx.lineJoin = 'round'
        ctx.shadowColor = s.color
        ctx.shadowBlur = 6
        ctx.shadowOffsetY = 2
        ctx.beginPath()
        let started = false
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
          const x = (t / span) * w
          if (started) ctx.lineTo(x, y)
          else {
            ctx.moveTo(x, y)
            started = true
          }
        }
        ctx.stroke()
        ctx.restore()
      }

      ctx.font = "10px 'Jost', sans-serif"
      ctx.textBaseline = 'alphabetic'
      const tickEvery = span > 45 ? 20 : 10
      for (let t = tickEvery; t <= span - 4; t += tickEvery) {
        const x = Math.round((t / span) * w) + 0.5
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
      ctx.fillText(`${span.toFixed(0)}s`, w - 1, h - 12)
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
