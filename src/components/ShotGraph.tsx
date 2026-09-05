import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { Sample } from '../api/useMachine'

const GUTTER = 200
const MIN_WINDOW = 15
const AXIS_TICKS = [10, 20, 30, 40, 50, 60]

const SERIES = [
  { key: 'mix', target: 'targetMix', color: '#d9714f', min: 80, max: 100, band: 0.34, width: 2 },
  { key: 'pressure', target: 'targetPressure', color: '#9fb055', min: 0, max: 12, band: 1, width: 2.4 },
  { key: 'weight', target: null, color: '#d3b06a', min: 0, max: 40, band: 1, width: 2.4 },
  { key: 'flow', target: 'targetFlow', color: '#4fbcc6', min: 0, max: 6, band: 1, width: 2 },
] as const

type SeriesKey = (typeof SERIES)[number]['key']

export interface FrameMark {
  t: number
  label: string
}

interface Props {
  samples: MutableRefObject<Sample[]>
  live: boolean
  window: number
  marks: FrameMark[]
  labels: { key: SeriesKey; value: string; caption: string }[]
}

const yFor = (s: (typeof SERIES)[number], v: number, height: number) => {
  const clamped = Math.max(s.min, Math.min(s.max, v))
  const frac = (clamped - s.min) / (s.max - s.min)
  return s.band === 1 ? (1 - frac) * height : (1 - frac) * height * s.band
}

export function ShotGraph({ samples, live, window: seconds, marks, labels }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [labelY, setLabelY] = useState<Record<string, number>>({})

  useEffect(() => {
    const el = canvas.current
    const wrap = box.current
    if (!el || !wrap) return

    let raf = 0
    let phase = 0

    const draw = () => {
      const dpr = globalThis.devicePixelRatio || 1
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr)
        el.height = Math.round(h * dpr)
      }
      const ctx = el.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const plot = Math.max(60, w - GUTTER)
      const span = Math.max(seconds, MIN_WINDOW)
      const xFor = (t: number) => (t / span) * plot

      ctx.strokeStyle = '#201e1a'
      ctx.lineWidth = 1
      for (const frac of [0, 0.25, 0.5, 0.75]) {
        const y = Math.round(h * frac) + 0.5
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(plot, y)
        ctx.stroke()
      }
      ctx.strokeStyle = '#35322b'
      ctx.beginPath()
      ctx.moveTo(0, h - 0.5)
      ctx.lineTo(plot, h - 0.5)
      ctx.stroke()

      ctx.strokeStyle = '#302d27'
      ctx.setLineDash([1, 5])
      for (const mark of marks) {
        if (mark.t >= span) continue
        const x = Math.round(xFor(mark.t)) + 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      ctx.setLineDash([])

      const data = samples.current
      const positions: Record<string, number> = {}

      const visible = new Set(labels.map((l) => l.key))

      // the profile's targets, quiet and dashed behind the live lines
      for (const s of SERIES) {
        if (data.length < 2 || !s.target || !visible.has(s.key)) continue
        ctx.save()
        ctx.strokeStyle = `${s.color}3d`
        ctx.lineWidth = 1.3
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        let open = false
        for (const point of data) {
          if (point.t > span) break
          const value = point[s.target]
          if (value === undefined) continue
          const x = xFor(point.t)
          const y = yFor(s, value, h)
          if (open) ctx.lineTo(x, y)
          else {
            ctx.moveTo(x, y)
            open = true
          }
        }
        ctx.stroke()
        ctx.restore()
      }

      for (const s of SERIES) {
        if (data.length < 2 || !visible.has(s.key)) continue
        ctx.save()
        ctx.strokeStyle = s.color
        ctx.lineWidth = s.width
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.shadowColor = s.color
        ctx.shadowBlur = 7
        ctx.shadowOffsetY = 3
        ctx.beginPath()
        let started = false
        for (const point of data) {
          if (point.t > span) break
          const x = xFor(point.t)
          const y = yFor(s, point[s.key], h)
          if (started) ctx.lineTo(x, y)
          else {
            ctx.moveTo(x, y)
            started = true
          }
        }
        ctx.stroke()
        ctx.restore()

        const last = data[data.length - 1]
        positions[s.key] = yFor(s, last[s.key], h)
      }

      if (data.length > 1) {
        const lastT = data[data.length - 1].t
        const edge = Math.min(plot, xFor(lastT))

        ctx.strokeStyle = 'rgba(236,231,219,0.22)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(edge + 0.5, 0)
        ctx.lineTo(edge + 0.5, h)
        ctx.stroke()

        SERIES.forEach((s, i) => {
          const y = positions[s.key]
          if (y === undefined || !visible.has(s.key)) return
          if (live) {
            const local = (phase + i * 0.25) % 1
            const eased = 1 - Math.pow(1 - Math.min(local / 0.7, 1), 3)
            ctx.globalAlpha = Math.max(0, 0.5 * (1 - local / 0.7))
            ctx.fillStyle = s.color
            ctx.beginPath()
            ctx.arc(edge, y, 4.5 * (1 + eased * 2.6), 0, Math.PI * 2)
            ctx.fill()
            ctx.globalAlpha = 1
          }
          ctx.fillStyle = s.color
          ctx.beginPath()
          ctx.arc(edge, y, 4.5, 0, Math.PI * 2)
          ctx.fill()
        })
      }

      ctx.fillStyle = '#5d574c'
      ctx.font = "9px 'Jost', sans-serif"
      ctx.textAlign = 'end'
      ctx.fillText('12', -14, 4)
      ctx.fillText('6', -14, h * 0.5 + 4)
      ctx.fillText('0', -14, h + 2)
      ctx.textAlign = 'center'
      for (const tick of AXIS_TICKS) {
        if (tick > span * 0.93) continue
        ctx.fillText(`${tick}s`, xFor(tick), h + 20)
      }
      ctx.fillStyle = '#b8b1a2'
      ctx.fillText(`${span.toFixed(1)}s`, plot, h + 20)

      setLabelY((prev) => {
        const changed = SERIES.some((s) => Math.abs((prev[s.key] ?? -99) - (positions[s.key] ?? -99)) > 0.75)
        return changed ? positions : prev
      })

      phase = (phase + 1 / 144) % 1
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [samples, marks, seconds, live, labels])

  const spread = spreadLabels(labels.map((l) => labelY[l.key] ?? 0))

  return (
    <div ref={box} className="grow" style={{ position: 'relative' }}>
      <canvas ref={canvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {labels.map((label, i) => (
        <div
          key={label.key}
          style={{
            position: 'absolute',
            left: `calc(100% - ${GUTTER - 60}px)`,
            top: spread[i] - 26,
            color: SERIES.find((s) => s.key === label.key)?.color,
            pointerEvents: 'none',
          }}
        >
          <div className="num" style={{ fontSize: 32, lineHeight: 1 }}>{label.value}</div>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', marginTop: 4 }}>{label.caption}</div>
        </div>
      ))}
    </div>
  )
}

function spreadLabels(ys: number[], gap = 46) {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  let prev = -Infinity
  const out = new Array<number>(ys.length)
  for (const entry of order) {
    const y = Math.max(entry.y, prev + gap)
    out[entry.i] = y
    prev = y
  }
  return out
}
