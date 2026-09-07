import type { Reading } from '../lib/useShotSpread'

const W = 270
const H = 54
const MID = H / 2
const LEFT = 10

const verdictLabel: Record<'steady' | 'long' | 'fast', string> = {
  steady: 'steady',
  long: 'running long',
  fast: 'running fast',
}

export function ShotSpread({ reading }: { reading: Reading }) {
  const { times, center, band, latest, verdict } = reading.spread
  const step = times.length > 1 ? (W - LEFT) / (times.length - 1) : 0
  const widest = Math.max(...times.map((t) => Math.abs(t - center)))
  const scale = (MID - 5) / Math.max(band * 1.5, widest * 1.15)
  const y = (value: number) => MID + (value - center) * scale
  const bandHeight = band * scale * 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
      <span className="cap">Last {times.length}</span>
      <div className="row" style={{ alignItems: 'center', gap: 28 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
          <rect x="0" y={y(center - band)} width={W} height={bandHeight} rx={bandHeight / 2} fill="rgba(211,176,106,0.22)" />
          <line x1="0" y1={MID} x2={W} y2={MID} stroke="rgba(211,176,106,0.55)" strokeWidth="1" strokeDasharray="2 5" />
          {times.map((value, i) => {
            const last = i === times.length - 1
            return (
              <circle
                key={i}
                cx={LEFT + i * step}
                cy={y(value)}
                r={last ? 4.5 : 3}
                fill={last ? 'var(--ink)' : 'var(--axis-label)'}
              />
            )
          })}
        </svg>
        <div className="row" style={{ gap: 10, alignItems: 'stretch', height: 44 }}>
          <span className="num" style={{ fontSize: 44, lineHeight: 1 }}>{latest.toFixed(1)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <span className="cap" style={{ color: 'var(--axis-label)' }}>&plusmn; {band}</span>
            <span className="cap">s &middot; {verdictLabel[verdict]}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
