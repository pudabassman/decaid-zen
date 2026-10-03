import { useCssPalette } from '../lib/cssPalette'
import { colorWithAlpha } from '../lib/paletteState'
import type { Palette } from '../lib/paletteTokens'
import { useEffect, useRef, useState } from 'react'
import { stackLabels } from '../lib/labelStack'
import type { ShotMeasurement, ShotRecord } from '../api/types'
import { weightCeiling } from '../lib/validation'
import { Overlay } from './Overlay'
import { clockStart } from '../lib/shotClock'

const baseSeries = (colors: Palette, yieldByWeight: boolean, weightMax = 50) => [
  { pick: (m: ShotMeasurement) => m.machine.mixTemperature,
    target: (m: ShotMeasurement) => m.machine.targetMixTemperature, color: colors['temp'], min: 80, max: 100, band: 0.34, width: 1.6, unit: '°', digits: 1 },
  { pick: (m: ShotMeasurement) => m.machine.pressure,
    target: (m: ShotMeasurement) => m.machine.targetPressure, color: colors['bar'], min: 0, max: 12, band: 1, width: 2.2, unit: ' bar', digits: 1 },
  yieldByWeight
    ? { pick: (m: ShotMeasurement) => m.scale?.weight ?? null, target: () => null, color: colors['weight'], min: 0, max: weightMax, band: 1, width: 2.2, unit: ' g', digits: 1 }
    : { pick: (m: ShotMeasurement) => m.volume ?? null, target: () => null, color: colors['weight'], min: 0, max: 80, band: 1, width: 2.2, unit: ' ml', digits: 0 },
  { pick: (m: ShotMeasurement) => m.machine.flow,
    target: (m: ShotMeasurement) => m.machine.targetFlow, color: colors['flow'], min: 0, max: 6, band: 1, width: 1.7, unit: ' ml/s', digits: 1 },
]

/** headroom kept clear at the top of the plot for the caption and swatches */
const PAD_TOP = 38
/** the strip under the plot that carries the second ticks, so nothing sits on the edge */
const PAD_BOTTOM = 18
/** floor and ceiling for the right-hand label gutter */
const PAD_RIGHT_MIN = 40
const PAD_RIGHT_MAX = 84

export function LastShotGraph({ shot, loading = false, error = false, onRetry, expanded = false }: { shot: ShotRecord | null; loading?: boolean; error?: boolean; onRetry?: () => void; expanded?: boolean }) {
  const colors = useCssPalette()
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)

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

      const plot = Math.max(1, h - PAD_TOP - PAD_BOTTOM)

      // the gutter is only as wide as the widest value that has to live in it
      const measured = shot?.measurements ?? []
      const ceiling = weightCeiling(shot?.workflow?.context?.targetYield ?? 0, Math.max(0, ...measured.map(m => m.scale?.weight ?? 0)), 50)
      const sample = baseSeries(colors, measured.some((m) => (m.scale?.weight ?? 0) > 0), ceiling)
      ctx.font = "11px 'Jost Variable', sans-serif"
      let widest = 0
      for (const s of sample) {
        for (let i = measured.length - 1; i >= 0; i--) {
          const raw = s.pick(measured[i])
          if (raw === null || raw === undefined) continue
          widest = Math.max(widest, ctx.measureText(`${raw.toFixed(s.digits)}${s.unit}`).width)
          break
        }
      }
      const gutterFor = (width: number) =>
        Math.round(Math.min(PAD_RIGHT_MAX, Math.max(PAD_RIGHT_MIN, width + 15)))
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
      // both gutters take the wider of the two, so the plot sits centred
      const gutter = Math.max(gutterFor(widest), widestStart ? gutterFor(widestStart) : 0)
      const padRight = gutter
      const padLeft = widestStart ? gutter : 0
      const plotW = Math.max(1, w - padRight)
      const plotSpan = Math.max(1, plotW - padLeft)



      const points = shot?.measurements ?? []
      if (points.length < 2) return
      const t0 = Date.parse(points[0].machine.timestamp)
      const tEnd = Date.parse(points[points.length - 1].machine.timestamp)
      const span = Math.max(1, (tEnd - t0) / 1000)
      const origin = Math.min(span, Math.max(0, (clockStart(points) - t0) / 1000))
      const shotSpan = span - origin

      const yieldByWeight = points.some((m) => (m.scale?.weight ?? 0) > 0)
      const column: Array<{ y: number; color: string; text: string; weight: number; tick: boolean }> = []

      // what the profile asked for, drawn quietly behind what happened
      for (const s of baseSeries(colors, yieldByWeight, ceiling)) {
        ctx.save()
        ctx.strokeStyle = colorWithAlpha(s.color, .24)
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

      for (const s of baseSeries(colors, yieldByWeight, ceiling)) {
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
            ctx.font = "11px 'Jost Variable', sans-serif"
            ctx.textAlign = 'end'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = colorWithAlpha(s.color, .7)
            ctx.fillText(`${first.toFixed(s.digits)}${s.unit}`, padLeft - 6, yFor(first))
            ctx.textAlign = 'start'
            column.push({
              y: yFor(last),
              color: colorWithAlpha(s.color, .7),
              text: `${last.toFixed(s.digits)}${s.unit}`,
              weight: 0,
              tick: false,
            })
          }

          break
        }
      }

      // every end value is drawn: they stack rather than drop when they meet
      const ends = stackLabels(
        column.filter((label) => label.weight === 1),
        13,
        PAD_TOP + 6,
        h - 6,
      )
      // the quieter target values still give way when one lands on an end value
      const placed = [...ends]
      for (const label of column.filter((entry) => entry.weight === 0)) {
        if (label.y < PAD_TOP + 4 || label.y > h - 4) continue
        if (placed.some((other) => Math.abs(other.y - label.y) < 13)) continue
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
        ctx.font = label.weight ? "11px 'Jost Variable', sans-serif" : "11px 'Jost Variable', sans-serif"
        ctx.fillStyle = label.color
        ctx.fillText(label.text, plotW + 11, label.y)
      }

      ctx.font = "11px 'Jost Variable', sans-serif"
      ctx.textBaseline = 'alphabetic'
      const tickEvery = shotSpan > 45 ? 20 : 10
      for (let t = tickEvery; t <= shotSpan - 4; t += tickEvery) {
        const x = Math.round(padLeft + ((origin + t) / span) * plotSpan) + 0.5
        ctx.strokeStyle = colors['grip']
        ctx.beginPath()
        ctx.moveTo(x, h - PAD_BOTTOM + 6)
        ctx.lineTo(x, h - PAD_BOTTOM)
        ctx.stroke()
        ctx.fillStyle = colors['last-axis-label']
        ctx.textAlign = 'center'
        ctx.fillText(`${t}s`, x, h - 2)
      }
      ctx.fillStyle = colors['last-axis-label']
      ctx.textAlign = 'end'
      ctx.fillText(`${shotSpan.toFixed(0)}s`, plotW - 1, h - 2)
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(wrap)
    let active = true
    document.fonts.ready.then(() => { if (active) draw() })
    return () => { active = false; observer.disconnect() }
  }, [shot, colors])

  return (
    <div ref={box} className="grow shotplot" style={{ position: 'relative', minHeight: 120 }}>
      <canvas ref={canvas} aria-label="Shot graph: brew temperature, pressure, yield and flow over time" role="img" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {shot && !expanded && <button className="plot-expand" aria-label="Expand shot graph" onClick={() => setFull(true)}>⤢</button>}
      {!shot && <div className="graph-empty"><span>{loading ? 'Loading your last shot…' : error ? 'Couldn’t load the shot.' : 'Your next shot starts a new story.'}</span>{error && onRetry && <button className="text-button" onClick={onRetry}>Retry</button>}</div>}
      {full && <Overlay className="graph-overlay" title="Shot details" onClose={() => setFull(false)} footer={<span className="hint">Solid lines: measured · Dashed lines: profile targets</span>}><LastShotGraph shot={shot} expanded /></Overlay>}
    </div>
  )
}
