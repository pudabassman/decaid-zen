import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { Sample } from '../api/useMachine'

const GUTTER = 200
/** the axis a step opens with when the profile does not say how long it runs */
const MIN_WINDOW = 10
/** never squeeze a step into less than this, however short the profile says it is */
const MIN_STEP = 4
/** how long the view takes to travel from one step to the next */
const SLIDE_MS = 1000

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

const SERIES = [
  { key: 'mix', target: 'targetMix', color: '#d9714f', min: 80, max: 100, band: 0.34, width: 2 },
  { key: 'pressure', target: 'targetPressure', color: '#9fb055', min: 0, max: 12, band: 1, width: 2.4 },
  { key: 'weight', target: null, color: '#d3b06a', min: 0, max: 40, band: 1, width: 2.4 },
  { key: 'flow', target: 'targetFlow', color: '#4fbcc6', min: 0, max: 6, band: 1, width: 2 },
  { key: 'steam', target: null, color: '#d9714f', min: 100, max: 170, band: 1, width: 2.4 },
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
  /** how long the profile expects each step to run, in order */
  steps: number[]
  marks: FrameMark[]
  labels: { key: SeriesKey; value: string; caption: string }[]
}

const yFor = (s: (typeof SERIES)[number], v: number, height: number) => {
  const clamped = Math.max(s.min, Math.min(s.max, v))
  const frac = (clamped - s.min) / (s.max - s.min)
  return s.band === 1 ? (1 - frac) * height : (1 - frac) * height * s.band
}

export function ShotGraph({ samples, live, window: seconds, steps, marks, labels }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [labelY, setLabelY] = useState<Record<string, number>>({})

  // the draw loop reads the latest props through a ref: rebuilding it on every
  // sample would reset the view it is animating ten times a second
  const props = useRef({ live, seconds, steps, marks, labels })
  props.current = { live, seconds, steps, marks, labels }

  useEffect(() => {
    const el = canvas.current
    const wrap = box.current
    if (!el || !wrap) return

    let raf = 0
    let phase = 0
    // the view: its left edge and how many seconds it holds. Both glide together,
    // so a step change is one smooth move rather than a pan and a snap.
    let from = 0
    let span = MIN_WINDOW
    let stable = 0
    // a step change starts a one second glide from where the view is to where it belongs
    let slide: { from: number; span: number; toFrom: number; toSpan: number; at: number } | null = null

    const draw = () => {
      const { live, seconds, steps, marks, labels } = props.current
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
      const data = samples.current
      const now = data.length ? data[data.length - 1].t : seconds

      // the view holds the step in play: its first sample sits on the left edge.
      // a frame only counts once two samples agree, so a flicker cannot yank the view
      const latest = data.length ? data[data.length - 1].frame : 0
      const previous = data.length > 1 ? data[data.length - 2].frame : latest
      if (latest === previous) stable = latest

      let stepStart = 0
      for (let i = data.length - 1; i >= 0; i -= 1) {
        if (data[i].frame !== stable) break
        stepStart = data[i].t
      }

      // a fresh shot starts the view over rather than easing in from the last one
      if (now + 0.5 < from) {
        from = 0
        span = MIN_WINDOW
      }

      const targetFrom = Math.max(0, Math.min(stepStart, now - 0.1))
      // the plan comes from the same step the left edge is using, so the scale
      // never changes ahead of the pan
      const planned = steps[stable - 1] ?? 0
      // the step fills the plot by the time the profile says it ends, and only
      // widens if it runs long
      const targetSpan = Math.max(planned || MIN_WINDOW, MIN_STEP, now - targetFrom)

      // a new destination starts one glide; the same destination keeps the one running
      if (Math.abs(targetFrom - (slide ? slide.toFrom : from)) > 0.05) {
        slide = { from, span, toFrom: targetFrom, toSpan: targetSpan, at: performance.now() }
      }

      if (slide) {
        const p = Math.min(1, (performance.now() - slide.at) / SLIDE_MS)
        const eased = easeInOut(p)
        from = slide.from + (targetFrom - slide.from) * eased
        span = slide.span + (targetSpan - slide.span) * eased
        if (p === 1) slide = null
      } else {
        from = targetFrom
        span = targetSpan
      }
      const xFor = (t: number) => ((t - from) / span) * plot

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
        if (mark.t <= from || mark.t >= from + span) continue
        const x = Math.round(xFor(mark.t)) + 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      ctx.setLineDash([])

      const positions: Record<string, number> = {}

      const visible = new Set(labels.map((l) => l.key))

      // the profile's targets, quiet and dashed behind the live lines
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, -20, plot, h + 40)
      ctx.clip()

      for (const s of SERIES) {
        if (data.length < 2 || !s.target || !visible.has(s.key)) continue
        ctx.save()
        ctx.strokeStyle = `${s.color}3d`
        ctx.lineWidth = 1.3
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        let open = false
        for (const point of data) {
          if (point.t > from + span) break
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
        const drawn: Array<[number, number]> = []
        for (const point of data) {
          if (point.t > from + span) break
          drawn.push([xFor(point.t), yFor(s, point[s.key], h)])
        }


        ctx.save()
        ctx.strokeStyle = s.color
        ctx.lineWidth = s.width
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.shadowColor = s.color
        ctx.shadowBlur = 7
        ctx.shadowOffsetY = 3
        ctx.beginPath()
        drawn.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.stroke()
        ctx.restore()

        const last = data[data.length - 1]
        positions[s.key] = yFor(s, last[s.key], h)
      }

      ctx.restore()

      if (data.length > 1) {
        const lastT = data[data.length - 1].t
        const edge = Math.min(plot, xFor(lastT))

        ctx.strokeStyle = 'rgba(236,231,219,0.22)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(edge + 0.5, 0)
        ctx.lineTo(edge + 0.5, h)
        ctx.stroke()

        // every end point breathes on the same beat, so none looks stalled
        const shown = SERIES.filter((s) => positions[s.key] !== undefined && visible.has(s.key))
        shown.forEach((s) => {
          const y = positions[s.key]
          if (y === undefined) return
          if (live) {
            const local = phase
            const eased = 1 - Math.pow(1 - local, 3)
            ctx.globalAlpha = 0.45 * (1 - local)
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
      const every = span > 40 ? 20 : span > 20 ? 10 : 5
      for (let tick = every; tick < span * 0.93; tick += every) {
        ctx.fillText(`${tick}s`, xFor(from + tick), h + 20)
      }
      ctx.fillStyle = '#b8b1a2'
      ctx.fillText(`${now.toFixed(1)}s`, plot, h + 20)

      setLabelY((prev) => {
        const changed = SERIES.some((s) => Math.abs((prev[s.key] ?? -99) - (positions[s.key] ?? -99)) > 0.75)
        return changed ? positions : prev
      })

      phase = (phase + 1 / 144) % 1
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [samples])

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
