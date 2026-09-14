import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { DECK_WINDOW, type ProfileRecord } from '../api/profiles'
import type { Profile } from '../api/types'
import { MOCK } from '../lib/mock'

interface Props {
  records: ProfileRecord[]
  activeId: string | null
  grinds: Record<string, string>
  onPick: (record: ProfileRecord) => void
}

const CARD_W = 232
/** the carousel runs down the screen: one seat every STEP pixels */
const STEP = 106
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

/** the few numbers that tell one profile from another, coloured as the graph draws them */
function profileFacts(profile: Profile | undefined) {
  const steps = profile?.steps ?? []
  const pick = (get: (step: NonNullable<Profile['steps']>[number]) => number | undefined) => {
    const values = steps.map(get).filter((v): v is number => typeof v === 'number' && v > 0)
    return values.length ? Math.max(...values) : undefined
  }
  const temps = steps.map((step) => step.temperature).filter((v): v is number => typeof v === 'number' && v > 0)
  const first = temps[0]
  const last = temps[temps.length - 1]
  // a profile that ramps its temperature says so: 93 → 88
  const temp = first === undefined
    ? undefined
    : Math.abs(first - (last ?? first)) < 0.5
      ? `${first.toFixed(0)}°`
      : `${first.toFixed(0)}\u2192${(last ?? first).toFixed(0)}°`
  const bar = pick((step) => (step.pump === 'pressure' ? step.pressure : undefined))
  const flow = pick((step) => (step.pump === 'flow' ? step.flow : undefined))
  const weight = profile?.target_weight

  return [
    temp !== undefined ? { value: temp, color: 'var(--temp)' } : null,
    bar !== undefined ? { value: `${bar.toFixed(1)} bar`, color: 'var(--bar)' } : null,
    flow !== undefined ? { value: `${flow.toFixed(1)} ml/s`, color: 'var(--flow)' } : null,
    weight ? { value: `${weight.toFixed(0)} g`, color: 'var(--weight)' } : null,
  ].filter(Boolean) as Array<{ value: string; color: string }>
}

export function ProfileDeck({ records, activeId, grinds, onPick }: Props) {
  const [open, setOpen] = useState(MOCK && window.location.search.includes('fan'))
  const [closing, setClosing] = useState(false)
  const [candidate, setCandidate] = useState<string | null>(null)
  const [anchor, setAnchor] = useState({ top: 0, right: 0, height: 0 })
  const [pan, setPan] = useState(0)
  const rotation = useRef(0)
  const dragging = useRef(false)
  const moved = useRef(false)
  const origin = useRef({ x: 0, y: 0 })
  const badge = useRef<HTMLButtonElement>(null)
  /** true while the finger that opened the deck is still down */
  const holding = useRef(false)
  const previousSlot = useRef(0)

  const activeIndex = Math.max(0, records.findIndex((r) => r.id === activeId))
  const active = records[activeIndex]

  const count = Math.max(1, records.length)
  const wrap = (n: number) => ((n % count) + count) % count
  const visible = Math.min(DECK_WINDOW, count)
  const middle = Math.floor((visible - 1) / 2)
  /** where a record sits relative to the one in play, negative to the left */
  const offset = (i: number, from: number) => {
    const raw = wrap(i - from)
    return raw > count / 2 ? raw - count : raw
  }
  const seated = (signed: number) => signed >= -middle && signed <= visible - 1 - middle
  // seats run down the screen, so dragging down walks back up the ring
  const slot = wrap(activeIndex - Math.round(pan / STEP))
  const cameFrom = previousSlot.current
  const highlighted = candidate ?? records[slot]?.id ?? activeId

  useEffect(() => {
    if (!open) {
      setCandidate(null)
      return
    }
    const rect = badge.current?.getBoundingClientRect()
    if (rect) setAnchor({ top: rect.top, right: rect.left, height: rect.height })
  }, [open, records.length])

  useEffect(() => {
    previousSlot.current = slot
  }, [slot])

  if (!records.length) return null

  const cardAt = (clientX: number, clientY: number) => {
    const target = document.elementFromPoint(clientX, clientY)
    const card = target?.closest?.('[data-profile]') as HTMLElement | null
    return card?.dataset.profile ?? null
  }

  const close = () => {
    dragging.current = false
    holding.current = false
    setClosing(true)
    window.setTimeout(() => {
      setClosing(false)
      setOpen(false)
      setCandidate(null)
      setPan(0)
      rotation.current = 0
      previousSlot.current = 0
    }, 190)
  }

  const startDrag = (e: ReactPointerEvent, el: HTMLElement | null) => {
    const rect = badge.current?.getBoundingClientRect()
    if (rect) setAnchor({ top: rect.top, right: rect.left, height: rect.height })
    el?.setPointerCapture?.(e.pointerId)
    dragging.current = true
    moved.current = false
    origin.current = { x: e.clientX, y: e.clientY }
    rotation.current = pan
  }

  const moveDrag = (e: ReactPointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - origin.current.x
    const dy = e.clientY - origin.current.y
    if (!moved.current && Math.hypot(dx, dy) < 8) return
    moved.current = true
    if (Math.abs(dy) >= Math.abs(dx)) {
      setPan(rotation.current + dy)
      setCandidate(null)
      return
    }
    setCandidate(cardAt(e.clientX, e.clientY))
  }

  const commit = (id: string | null) => {
    close()
    if (!id) return
    const record = records.find((r) => r.id === id)
    if (record && record.id !== activeId) onPick(record)
  }


  return (
    <div className="deckwrap">
      {open && (
        <>
          <div
            className={`deckveil${closing ? ' closing' : ''}`}
            onPointerUp={() => commit(null)}
          />
          <div
            className={`deckfan${closing ? ' closing' : ''}`}
            style={{
              top: '50%',
              transform: 'translateY(-50%)',
              right: Math.max(6, window.innerWidth - anchor.right / 2 - CARD_W / 2),
            }}
            onPointerDown={(e) => startDrag(e, e.currentTarget)}
            onPointerMove={moveDrag}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture?.(e.pointerId)
              dragging.current = false
              // the fan holds the pointer capture, so a tap on a card lands here
              if (!moved.current) {
                const tapped = cardAt(e.clientX, e.clientY)
                if (tapped) commit(tapped)
                return
              }
              // a held finger picks on release; after a tap the wheel keeps spinning
              if (holding.current) commit(highlighted)
            }}
          >
            <div className="decktrack">
              {records.map((record, i) => {
                // the profile in play holds the middle seat; up to four more ring around it
                const signed = offset(i, slot)
                if (!seated(signed)) return null
                const seat = signed + middle
                const on = record.id === highlighted
                // a card that wraps round the back fades in there rather than sliding across
                const before = offset(i, cameFrom)
                const warped = !seated(before) || Math.abs(seat - (before + middle)) > 1
                return (
                  <button
                    key={record.id}
                    data-profile={record.id}
                    className={`deckcard${on ? ' on' : ''}${warped ? ' warp' : ''}`}
                    style={{
                      top: (seat - middle) * STEP,
                      zIndex: 60 - Math.abs(seat - middle),
                      transform: `translateY(-50%) scale(${seat === middle ? 1 : 0.94})`,
                      opacity: seat === middle ? 1 : 0.72,
                      animationDelay: `${Math.min(i, 4) * 22}ms`,
                    }}
                    onPointerUp={(e) => {
                      if (moved.current) return
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
                    <span className="deckfacts">
                      {profileFacts(record.profile).map((fact) => (
                        <span key={fact.value} className="num" style={{ color: fact.color }}>
                          {fact.value}
                        </span>
                      ))}
                    </span>
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
          startDrag(e, badge.current)
          holding.current = true
          setOpen(true)
        }}
        onPointerMove={moveDrag}
        onPointerUp={(e) => {
          badge.current?.releasePointerCapture?.(e.pointerId)
          if (!moved.current) {
            // a plain tap leaves the wheel open to spin; the next tap picks
            dragging.current = false
            holding.current = false
            return
          }
          commit(cardAt(e.clientX, e.clientY) ?? highlighted)
        }}
        onPointerCancel={() => {
          dragging.current = false
          moved.current = false
          holding.current = false
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
        <span className="deckdots">
          {Array.from({ length: visible }, (_, k) => {
            const first = Math.min(Math.max(activeIndex - middle, 0), count - visible)
            return <span key={k} className={first + k === activeIndex ? 'on' : undefined} />
          })}
        </span>
      </button>
    </div>
  )
}
