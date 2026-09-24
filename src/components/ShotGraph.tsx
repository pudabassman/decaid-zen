import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { Sample } from '../api/useMachine'

const GUTTER = 200
/** the axis moves a chunk at a time, so between chunks nothing already drawn shifts */
const SPAN_CHUNK = 10
/** an adaptive step declares its longest case, so trust the plan only this far */
const SPAN_PLAN_CAP = 20
const SPAN_GROW_MS = 760
/** once the trace stops growing for this long the shot is over and the view fits it */
const SETTLE_MS = 400
/** seconds of the outgoing window the next one keeps, so the trace never restarts empty */
const SLIDE_LEAD = 1.5
/** where the predicted end of the shot should land on the plot */
const FIT_TARGET = 0.95
/** seconds of trace the weight rate is measured over */
const RATE_WINDOW = 2
/** the weight only predicts the end once this much of the target is in the cup */
const POUR_ESTABLISHED = 0.25

/**
 * The step opens on a window wide enough for the whole step the profile describes, rounded
 * up to a chunk, so a step that runs to plan never moves the axis once. Only a step that
 * outlasts its plan widens, and then by a whole chunk.
 */
/**
 * When the shot is expected to end, on the sample clock. Weight wins when the
 * scale is pouring, because an adaptive profile's declared seconds are a ceiling;
 * otherwise the remaining steps stand in.
 */
const endOf = (data: Sample[], targetYield: number, steps: number[], stable: number) => {
  const last = data[data.length - 1]
  if (targetYield > 0 && last.weight >= targetYield * POUR_ESTABLISHED) {
    let first = last
    for (let i = data.length - 1; i >= 0; i -= 1) {
      first = data[i]
      if (last.t - data[i].t >= RATE_WINDOW) break
    }
    const seconds = last.t - first.t
    const rate = seconds > 0.4 ? (last.weight - first.weight) / seconds : 0
    if (rate > 0.15) return capped(last.t, last.t + (targetYield - last.weight) / rate)
  }
  let remaining = 0
  for (let i = stable + 1; i < steps.length; i += 1) remaining += Math.min(steps[i] ?? 0, SPAN_PLAN_CAP)
  return capped(last.t, last.t + remaining)
}

/** An estimate made early is mostly noise; no shot doubles its length from here. */
const capped = (now: number, estimate: number) => Math.min(Math.max(estimate, now), now * 2 + 4)

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

const SERIES = [
  { key: 'mix', target: 'targetMix', color: '#d9714f', min: 80, max: 100, band: 0.34, width: 2 },
  { key: 'pressure', target: 'targetPressure', color: '#9fb055', min: 0, max: 12, band: 1, width: 2.4 },
  { key: 'weight', target: null, color: '#d3b06a', min: 0, max: 40, band: 1, width: 2.4 },
  { key: 'flow', target: 'targetFlow', color: '#4fbcc6', min: 0, max: 6, band: 1, width: 2 },
  { key: 'steam', target: null, color: '#d9714f', min: 100, max: 170, band: 1, width: 2.4 },
] as const

type SeriesKey = (typeof SERIES)[number]['key']

interface Props {
  samples: MutableRefObject<Sample[]>
  origin: MutableRefObject<number | null>
  live: boolean
  window: number
  /** how long the profile expects each step to run, in order */
  steps: number[]
  /** the yield the shot is aiming for, or 0 when nothing is set */
  targetYield: number
  labels: { key: SeriesKey; value: string; caption: string }[]
}

const yFor = (s: (typeof SERIES)[number], v: number, height: number) => {
  const clamped = Math.max(s.min, Math.min(s.max, v))
  const frac = (clamped - s.min) / (s.max - s.min)
  return s.band === 1 ? (1 - frac) * height : (1 - frac) * height * s.band
}

export function ShotGraph({ samples, origin, live, window: seconds, steps, targetYield, labels }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [labelY, setLabelY] = useState<Record<string, number>>({})

  // the draw loop reads the latest props through a ref: rebuilding it on every
  // sample would reset the view it is animating ten times a second
  const props = useRef({ live, seconds, steps, targetYield, labels })
  props.current = { live, seconds, steps, targetYield, labels }

  useEffect(() => {
    const el = canvas.current
    const wrap = box.current
    if (!el || !wrap) return

    let raf = 0
    let phase = 0
    // the view: its left edge sits on the step in play, so the step always starts at 0.
    // only the span moves, and only once the trace has filled the plot
    let from = 0
    let span = SPAN_CHUNK
    let stable = 0
    let lastNow = -1
    let lastGrewAt = performance.now()
    let slide: { from: number; span: number; toFrom: number; toSpan: number; at: number } | null = null

    const draw = () => {
      const { live, seconds, steps, targetYield, labels } = props.current
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
      let scan = data.length - 1
      // the newest samples can already belong to the next frame, which is not stable
      // yet; skipping them keeps the view on the step in play instead of snapping to 0
      while (scan >= 0 && data[scan].frame !== stable) scan -= 1
      for (; scan >= 0; scan -= 1) {
        if (data[scan].frame !== stable) break
        stepStart = data[scan].t
      }

      // a fresh shot starts the view over rather than easing in from the last one
      if (now + 0.5 < from) {
        from = 0
        span = SPAN_CHUNK
      }

      // While the trace still has room the view holds absolutely still: a step change
      // on a half-empty plot moves nothing. Only a full plot earns a move, and then
      // the finished steps drop off the left so the step in play starts at 0.
      if (now !== lastNow) {
        lastNow = now
        lastGrewAt = performance.now()
      }

      let targetFrom = slide ? slide.toFrom : from
      let targetSpan = slide ? slide.toSpan : span
      const settled = data.length > 1 && performance.now() - lastGrewAt > SETTLE_MS
      if (settled) {
        // the shot is over: close the gap so the last step ends on the right edge
        targetSpan = Math.max(now - targetFrom, 0.5)
      } else if (data.length > 1 && now - targetFrom >= targetSpan) {
        // The plot is full, so the view moves on by one window. If what is left of the
        // shot would not fill that next window, this one stretches to the end instead,
        // so the shot never finishes in the middle of a fresh window.
        const end = endOf(data, targetYield, steps, stable)
        if (end - now >= SPAN_CHUNK) {
          // the new window opens just behind the live edge, so the trace restarts near
          // the left; a step that began inside that lead-in anchors it instead
          const lead = now - SLIDE_LEAD
          targetFrom = stepStart > lead ? stepStart : Math.max(targetFrom, lead)
          targetSpan = SPAN_CHUNK
        } else {
          targetSpan = Math.max(SPAN_CHUNK, (end - targetFrom) / FIT_TARGET)
        }
      }

      if (Math.abs(targetFrom - (slide ? slide.toFrom : from)) > 0.05 || Math.abs(targetSpan - (slide ? slide.toSpan : span)) > 0.01) {
        slide = { from, span, toFrom: targetFrom, toSpan: targetSpan, at: performance.now() }
      }

      if (slide) {
        const p = Math.min(1, (performance.now() - slide.at) / SPAN_GROW_MS)
        const eased = easeInOut(p)
        from = slide.from + (slide.toFrom - slide.from) * eased
        span = slide.span + (slide.toSpan - slide.span) * eased
        if (p === 1) slide = null
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

      // a boundary is where a step actually changed, not where the profile said it would:
      // an adaptive step that exits on pressure or flow still gets its rule in the right place
      ctx.strokeStyle = '#302d27'
      ctx.setLineDash([1, 5])
      for (let i = 1; i < data.length; i += 1) {
        if (data[i].frame === data[i - 1].frame) continue
        const t = data[i].t
        if (t <= from || t >= from + span) continue
        const x = Math.round(xFor(t)) + 0.5
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
      const clock = origin.current === null ? 0 : Math.max(0, now - origin.current)
      ctx.fillText(`${clock.toFixed(1)}s`, plot, h + 20)

      setLabelY((prev) => {
        const changed = SERIES.some((s) => Math.abs((prev[s.key] ?? -99) - (positions[s.key] ?? -99)) > 0.75)
        return changed ? positions : prev
      })

      phase = (phase + 1 / 144) % 1
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [samples, origin])

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
            top: spread[i] - 16,
            color: SERIES.find((s) => s.key === label.key)?.color,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'baseline',
            gap: 7,
            whiteSpace: 'nowrap',
          }}
        >
          <span className="num" style={{ fontSize: 32, lineHeight: 1 }}>{label.value}</span>
          <span style={{ fontSize: 9, letterSpacing: '0.22em' }}>{label.caption}</span>
        </div>
      ))}
    </div>
  )
}

function spreadLabels(ys: number[], gap = 38) {
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
