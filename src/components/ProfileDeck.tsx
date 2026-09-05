import { useEffect, useRef, useState } from 'react'
import type { ProfileRecord } from '../api/profiles'
import type { Profile } from '../api/types'
import { MOCK } from '../lib/mock'

interface Props {
  records: ProfileRecord[]
  activeId: string | null
  grinds: Record<string, string>
  onPick: (record: ProfileRecord) => void
}

const CARD_W = 232
const STEP = 54
/** where the first seat starts inside the frame */
const FRONT = 54
const VIEW_W = 110
const VIEW_H = 50

export function profileCurve(profile: Profile | undefined) {
  const steps = profile?.steps ?? []
  if (!steps.length) return ''

  const seconds = steps.map((step) => Math.max(1, step.seconds ?? 6))
  const total = seconds.reduce((sum, s) => sum + s, 0)
  const peak = Math.max(
    6,
    ...steps.map((step) => (step.pump === 'flow' ? (step.flow ?? 0) * 1.4 : step.pressure ?? 0)),
  )

  const points: Array<[number, number]> = []
  let elapsed = 0
  steps.forEach((step, i) => {
    const value = step.pump === 'flow' ? (step.flow ?? 0) * 1.4 : step.pressure ?? 0
    const y = VIEW_H - (Math.max(0, value) / peak) * (VIEW_H - 6) - 3
    points.push([(elapsed / total) * VIEW_W, y])
    elapsed += seconds[i]
    points.push([(elapsed / total) * VIEW_W, y])
  })

  return points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
}

const grindLabel = (value: string | undefined) => `grind ${value && value.trim() ? value : '-'}`

export function ProfileDeck({ records, activeId, grinds, onPick }: Props) {
  const [open, setOpen] = useState(MOCK && window.location.search.includes('fan'))
  const [closing, setClosing] = useState(false)
  const [candidate, setCandidate] = useState<string | null>(null)
  const [anchor, setAnchor] = useState(0)
  const [pan, setPan] = useState(0)
  const rotation = useRef(0)
  const dragging = useRef(false)
  const moved = useRef(false)
  const origin = useRef({ x: 0, y: 0 })
  const badge = useRef<HTMLButtonElement>(null)
  const seats = useRef<Map<string, number>>(new Map())

  const activeIndex = Math.max(0, records.findIndex((r) => r.id === activeId))
  const active = records[activeIndex]

  useEffect(() => {
    if (!open) {
      setCandidate(null)
      return
    }
    const rect = badge.current?.getBoundingClientRect()
    if (rect) setAnchor(rect.top)
  }, [open, records.length])

  if (!records.length) return null

  const cardAt = (clientX: number, clientY: number) => {
    const target = document.elementFromPoint(clientX, clientY)
    const card = target?.closest?.('[data-profile]') as HTMLElement | null
    return card?.dataset.profile ?? null
  }

  const close = () => {
    dragging.current = false
    setClosing(true)
    window.setTimeout(() => {
      setClosing(false)
      setOpen(false)
      setCandidate(null)
      setPan(0)
      rotation.current = 0
      seats.current.clear()
    }, 190)
  }

  const commit = (id: string | null) => {
    close()
    if (!id) return
    const record = records.find((r) => r.id === id)
    if (record && record.id !== activeId) onPick(record)
  }

  // a drag rotates which profile sits in the front seat; the seats never move
  const count = Math.max(1, records.length)
  const wrap = (n: number) => ((n % count) + count) % count
  const middle = Math.floor(count / 2)
  const slot = wrap(activeIndex - Math.round(pan / STEP))
  const highlighted = candidate ?? records[slot]?.id ?? activeId

  return (
    <div className="deckwrap">
      {open && (
        <>
          <div
            className={`deckveil${closing ? ' closing' : ''}`}
            style={{ height: Math.max(0, anchor - 6) }}
            onPointerUp={() => commit(null)}
          />
          <div
            className={`deckfan${closing ? ' closing' : ''}`}
            style={{ bottom: Math.max(0, window.innerHeight - anchor + 14) }}
          >
            <div className="decktrack">
              {records.map((record, i) => {
                // the profile in play holds the middle seat; the rest ring around it
                const seat = wrap(i - slot + middle)
                const on = record.id === highlighted
                // a card that wraps round the back must not slide across the frame
                const jumped = Math.abs(seat - (seats.current.get(record.id) ?? seat)) > 1
                seats.current.set(record.id, seat)
                return (
                  <button
                    key={record.id}
                    data-profile={record.id}
                    className={`deckcard${on ? ' on' : ''}`}
                    style={{
                      left: FRONT + seat * STEP,
                      zIndex: 60 - Math.abs(seat - middle),
                      transition: jumped ? 'none' : undefined,
                      transform: `scale(${seat === middle ? 1 : 0.95})`,
                      animationDelay: `${Math.min(i, 4) * 22}ms`,
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation()
                      commit(record.id)
                    }}
                  >
                    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width={CARD_W - 32} height={54} aria-hidden="true">
                      <path
                        d={profileCurve(record.profile)}
                        fill="none"
                        stroke={on ? 'var(--bar)' : 'var(--grip)'}
                        strokeWidth={on ? 2.2 : 1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="display deckname">{record.profile?.title ?? 'Untitled'}</span>
                    <span className="cap">{grindLabel(grinds[record.id])}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      <button
        className="deckbadge"
        ref={badge}
        onPointerDown={(e) => {
          const rect = badge.current?.getBoundingClientRect()
          if (rect) setAnchor(rect.top)
          badge.current?.setPointerCapture?.(e.pointerId)
          dragging.current = true
          moved.current = false
          origin.current = { x: e.clientX, y: e.clientY }
          rotation.current = pan
          setOpen(true)
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return
          const dx = e.clientX - origin.current.x
          const dy = e.clientY - origin.current.y
          if (!moved.current && Math.hypot(dx, dy) < 8) return
          moved.current = true
          if (Math.abs(dx) > Math.abs(dy)) {
            // one seat per STEP dragged, with a little slack at either end
            setPan(rotation.current + dx)
            setCandidate(null)
            return
          }
          setCandidate(cardAt(e.clientX, e.clientY))
        }}
        onPointerUp={(e) => {
          badge.current?.releasePointerCapture?.(e.pointerId)
          if (!moved.current) {
            dragging.current = false
            return
          }
          commit(cardAt(e.clientX, e.clientY) ?? highlighted)
        }}
        onPointerCancel={() => {
          dragging.current = false
          moved.current = false
        }}
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width={74} height={30} aria-hidden="true">
          <path
            d={profileCurve(active?.profile)}
            fill="none"
            stroke="var(--bar)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="display deckname">{active?.profile?.title ?? 'No profile'}</span>
        <span className="cap">{grindLabel(grinds[active?.id ?? ''])}</span>
        <span className="deckdots">
          {records.map((record, i) => (
            <span key={record.id} className={i === activeIndex ? 'on' : undefined} />
          ))}
        </span>
      </button>
    </div>
  )
}
