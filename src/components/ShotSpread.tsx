import { useState } from 'react'
import { Overlay } from './Overlay'
import type { Reading } from '../lib/useShotSpread'

const W = 270
const H = 54
const MID = H / 2
const LEFT = 10

const basisLabel: Record<'bean' | 'profile', string> = {
  bean: '',
  profile: ' \u00b7 this profile',
}

const verdictLabel: Record<'steady' | 'long' | 'fast', string> = {
  steady: 'steady',
  long: 'running long',
  fast: 'running fast',
}

export function ShotSpread({ reading }: { reading: Reading }) {
  const [explaining, setExplaining] = useState(false)
  if (!reading.spread) return <EmptySpread />

  const { times, center, band, latest, verdict } = reading.spread
  const single = times.length === 1
  const step = times.length > 1 ? (W - LEFT) / (times.length - 1) : 0
  const x = (i: number) => (single ? W / 2 : LEFT + i * step)
  const widest = Math.max(...times.map((t) => Math.abs(t - center)))
  const scale = (MID - 5) / Math.max(band * 1.5, widest * 1.15)
  const y = (value: number) => MID + (value - center) * scale
  const bandHeight = band * scale * 2

  return (
    <div className="shot-consistency">
      <button className="text-button eyebrow" onClick={() => setExplaining(true)}>Last {times.length}{basisLabel[reading.basis]} · consistency ⓘ</button>
      <div className="row" style={{ alignItems: 'center', gap: 28 }}>
        <svg className="spreadplot" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
          <rect x="0" y={y(center - band)} width={W} height={bandHeight} rx={bandHeight / 2} fill="var(--spread-band)" />
          <line x1="0" y1={MID} x2={W} y2={MID} stroke="var(--spread-line)" strokeWidth="1" strokeDasharray="2 5" />
          {times.map((value, i) => {
            const last = i === times.length - 1
            return (
              <circle
                key={i}
                cx={x(i)}
                cy={y(value)}
                r={last ? 4.5 : 3}
                fill={last ? 'var(--ink)' : 'var(--axis-label)'}
              />
            )
          })}
        </svg>
        <div className="spread-reading">
          <span className="num" style={{ fontSize: 44, lineHeight: 1 }}>{latest.toFixed(1)}</span>
          <div className="spread-caption">
            <span className="cap" style={{ color: 'var(--axis-label)' }}>&plusmn; {band}</span>
            <span className="cap">s &middot; {single ? 'one shot' : verdictLabel[verdict]}</span>
          </div>
        </div>
      </div>
      {explaining && <Overlay title="Your recent rhythm" onClose={() => setExplaining(false)}><p>This compares the duration of your last {times.length} shots {reading.basis === 'profile' ? 'with this profile' : 'with this coffee and profile'}.</p><p>The bright dot is the latest shot. The band shows the usual range (±{band} seconds). Steady timing can help you spot changes in grind or preparation; it isn’t a taste score.</p></Overlay>}
    </div>
  )
}

function EmptySpread() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
      <span className="cap">No shots yet &middot; this bean + profile</span>
      <div className="row" style={{ alignItems: 'center', gap: 28 }}>
        <svg className="spreadplot" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
          <line x1="0" y1={MID} x2={W} y2={MID} stroke="var(--spread-empty)" strokeWidth="1" strokeDasharray="2 5" />
        </svg>
        <div className="spread-reading">
          <span className="num" style={{ fontSize: 44, lineHeight: 1, color: 'var(--axis-label)' }}>&ndash;&ndash;</span>
          <div className="spread-caption">
            <span className="cap">s</span>
          </div>
        </div>
      </div>
    </div>
  )
}
