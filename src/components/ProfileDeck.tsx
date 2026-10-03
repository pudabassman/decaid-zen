import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { DECK_WINDOW, type ProfileRecord } from '../api/profiles'
import type { Profile } from '../api/types'
import { MOCK } from '../lib/mock'
import { CAROUSEL_STEP as STEP, cardAppearance, carouselSeats, restingPan, wrapIndex } from '../lib/carouselMotion'

interface Props {
  records: ProfileRecord[]
  activeId: string | null
  grinds: Record<string, string>
  onPick: (record: ProfileRecord) => void
}

const CARD_W = 292
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
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })
  const shell = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)
  const dialogId = useId()
  const rotation = useRef(0)
  const dragging = useRef(false)
  const moved = useRef(false)
  const origin = useRef({ x: 0, y: 0 })
  const badge = useRef<HTMLButtonElement>(null)
  /** true while the finger that opened the deck is still down */
  const holding = useRef(false)
  const originProfile = useRef<string | null>(null)
  const panRef = useRef(0)
  const targetPan = useRef(0)
  const paintFrame = useRef(0)
  const settleFrame = useRef(0)
  const wheelTimer = useRef<number | undefined>(undefined)
  const velocity = useRef(0)
  const lastMove = useRef({ y: 0, time: 0 })
  const contents = useMemo(() => records.map(record => ({ curve: profileCurve(record.profile), facts: profileFacts(record.profile) })), [records])

  const activeIndex = records.findIndex((r) => r.id === activeId)
  const active = activeIndex < 0 ? undefined : records[activeIndex]

  const count = Math.max(1, records.length)
  const wrap = (value: number) => wrapIndex(value, count)
  const visible = Math.min(viewport.height < 720 ? 3 : DECK_WINDOW, count)
  const middle = Math.floor((visible - 1) / 2)
  const openingIndex = records.findIndex(record => record.id === originProfile.current)
  const baseIndex = Math.max(0, openingIndex < 0 ? activeIndex : openingIndex)
  const center = baseIndex - pan / STEP
  const slot = wrap(Math.round(center))
  const highlighted = candidate ?? records[slot]?.id ?? activeId
  const currentChoice = () => candidate ?? records[wrap(Math.round(baseIndex - panRef.current / STEP))]?.id ?? activeId

  const cancelMotion = () => {
    cancelAnimationFrame(paintFrame.current)
    cancelAnimationFrame(settleFrame.current)
    window.clearTimeout(wheelTimer.current)
  }
  const queuePan = (value: number) => {
    panRef.current = count > 1 ? value : 0
    targetPan.current = panRef.current
    cancelAnimationFrame(paintFrame.current)
    paintFrame.current = requestAnimationFrame(() => setPan(panRef.current))
  }
  const settle = (destination = restingPan(panRef.current)) => {
    cancelMotion()
    targetPan.current = count > 1 ? destination : 0
    const from = panRef.current, to = targetPan.current
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(from - to) < .1) {
      panRef.current = to; setPan(to); return
    }
    const started = performance.now()
    const duration = Math.min(460, 260 + Math.abs(to - from) * .45)
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration)
      const eased = 1 - (1 - progress) ** 4
      panRef.current = from + (to - from) * eased
      setPan(panRef.current)
      if (progress < 1) settleFrame.current = requestAnimationFrame(tick)
    }
    settleFrame.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    if (!open) {
      setCandidate(null)
      return
    }
    if (!originProfile.current) originProfile.current = activeId
    const rect = badge.current?.getBoundingClientRect()
    if (rect) setAnchor({ top: rect.top, right: rect.left, height: rect.height })
  }, [open, records.length, activeId])



  const cardAt = (clientX: number, clientY: number) => {
    const target = document.elementFromPoint(clientX, clientY)
    const card = target?.closest?.('[data-profile]') as HTMLElement | null
    return card?.dataset.profile ?? null
  }

  const close = () => {
    if (closing) return
    cancelMotion()
    dragging.current = false
    holding.current = false
    setClosing(true)
    closeTimer.current = window.setTimeout(() => {
      setClosing(false)
      setOpen(false)
      setCandidate(null)
      setPan(0)
      rotation.current = 0
      panRef.current = 0
      targetPan.current = 0
      originProfile.current = null
      badge.current?.focus({ preventScroll: true })
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 190)
  }

  const startDrag = (e: ReactPointerEvent, el: HTMLElement | null) => {
    if (!e.isPrimary || e.button !== 0 || closing) return
    const rect = badge.current?.getBoundingClientRect()
    if (rect) setAnchor({ top: rect.top, right: rect.left, height: rect.height })
    cancelMotion()
    velocity.current = 0
    lastMove.current = { y: e.clientY, time: e.timeStamp }
    el?.setPointerCapture?.(e.pointerId)
    dragging.current = true
    moved.current = false
    origin.current = { x: e.clientX, y: e.clientY }
    rotation.current = panRef.current
  }

  const moveDrag = (e: ReactPointerEvent) => {
    if (!dragging.current || closing) return
    const dx = e.clientX - origin.current.x
    const dy = e.clientY - origin.current.y
    if (!moved.current && Math.hypot(dx, dy) < 8) return
    moved.current = true
    if (Math.abs(dy) >= Math.abs(dx)) {
      const elapsed = e.timeStamp - lastMove.current.time
      if (elapsed > 0) velocity.current = .65 * velocity.current + .35 * (e.clientY - lastMove.current.y) / elapsed
      lastMove.current = { y: e.clientY, time: e.timeStamp }
      queuePan(rotation.current + dy)
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


  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('resize', resize); window.clearTimeout(closeTimer.current); cancelMotion() }
  }, [])

  useEffect(() => {
    if (!open) return
    const element = shell.current
    const wheel = (event: WheelEvent) => {
      if (closing || dragging.current) return
      event.preventDefault()
      cancelMotion()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1
      setCandidate(null)
      queuePan(panRef.current - event.deltaY * unit)
      wheelTimer.current = window.setTimeout(() => settle(), 120)
    }
    element?.addEventListener('wheel', wheel, { passive: false })
    return () => { element?.removeEventListener('wheel', wheel); window.clearTimeout(wheelTimer.current) }
  }, [open, closing, count])

  useEffect(() => {
    if (open) shell.current?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setCandidate(null)
        settle(restingPan(targetPan.current) + (event.key === 'ArrowDown' ? -STEP : STEP))
        shell.current?.focus({ preventScroll: true })
      }
      if ((event.key === 'Enter' || event.key === ' ') && event.target === shell.current) {
        event.preventDefault(); commit(currentChoice())
      }
      if (event.key === 'Tab') {
        const buttons = Array.from(shell.current?.querySelectorAll<HTMLButtonElement>('button:not([tabindex="-1"])') ?? [])
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === shell.current || !shell.current?.contains(document.activeElement))) {
          event.preventDefault(); last?.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !shell.current?.contains(document.activeElement))) {
          event.preventDefault(); first?.focus()
        }
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  })

  if (!records.length) return <span className="hint">No profiles available</span>

  return (
    <div className="deckwrap">
      {open && createPortal(
        <div ref={shell} className="deckoverlay" id={dialogId} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Profile carousel">
          <div
            className={`deckveil${closing ? ' closing' : ''}`}
            onPointerUp={() => commit(null)}
          />
          <div
            className={`deckfan${closing ? ' closing' : ''}`}
            style={{
              top: '50%',
              transform: 'translateY(-50%)',
              right: Math.min(viewport.width - CARD_W - 16, Math.max(16, viewport.width - anchor.right / 2 - CARD_W / 2)),
            }}
            onPointerDown={(e) => startDrag(e, e.currentTarget)}
            onPointerCancel={() => { dragging.current = false; holding.current = false; moved.current = false; settle() }}
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
              // A held opening gesture selects; browsing settles without selecting.
              if (holding.current) commit(currentChoice())
              else settle(restingPan(panRef.current, !matchMedia('(prefers-reduced-motion: reduce)').matches && e.timeStamp - lastMove.current.time < 100 ? velocity.current : 0))
            }}
          >
            <div className="decktrack">
              {carouselSeats(center, count, visible).map(({ index, recordIndex, distance, accessible }) => {
                const record = records[recordIndex]
                const appearance = cardAppearance(distance, visible)
                const on = record.id === highlighted
                const content = contents[recordIndex]
                return (
                  <button
                    type="button"
                    key={index}
                    tabIndex={accessible ? 0 : -1}
                    aria-hidden={!accessible}
                    aria-label={`Select ${record.profile?.title ?? 'Untitled'}`}
                    aria-pressed={record.id === activeId}
                    onClick={event => { if (event.detail === 0) commit(record.id) }}
                    data-profile={record.id}
                    className={`deckcard${on ? ' on' : ''}`}
                    style={{
                      top: 0,
                      zIndex: 60 - Math.round(Math.abs(distance) * 10),
                      transform: `translate3d(0, ${distance * STEP}px, 0) translateY(-50%) scale(${appearance.scale})`,
                      opacity: appearance.opacity,
                      pointerEvents: appearance.opacity > .08 ? 'auto' : 'none',
                      ['--deck-detail-opacity' as string]: appearance.detailOpacity,
                    }}
                    onPointerUp={(e) => {
                      if (moved.current) return
                      e.stopPropagation()
                      commit(record.id)
                    }}
                  >
                    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width={CARD_W - 32} height={54} aria-hidden="true">
                      <path
                        d={content.curve}
                        fill="none"
                        stroke={on ? 'var(--bar)' : 'var(--muted)'}
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="display deckname">{record.profile?.title ?? 'Untitled'}</span>
                    <span className="deckfacts">
                      {content.facts.map((fact) => (
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
          <button type="button" className="icon-button deck-close" aria-label="Close profile carousel" onClick={close}>×</button>
          <div className="deck-guidance"><span className="eyebrow">{slot + 1} / {records.length} profiles</span><span>Scroll or drag · tap to select</span><span className="sr-only">Use up and down arrow keys to browse, Enter to select, and Escape to close.</span></div>
        </div>, document.body,
      )}

      <button
        type="button"
        className="deckbadge"
        ref={badge}
        aria-label={`Choose profile: ${active?.profile?.title ?? 'No profile'}`}
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={event => { if (event.detail === 0) setOpen(true) }}
        onPointerDown={(e) => {
          if (!e.isPrimary || e.button !== 0 || closing) return
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
            shell.current?.focus({ preventScroll: true })
            return
          }
          commit(cardAt(e.clientX, e.clientY) ?? currentChoice())
        }}
        onPointerCancel={() => {
          dragging.current = false
          moved.current = false
          holding.current = false
          settle()
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
