import { useCallback, useRef, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  onClick?: () => void | Promise<void>
  width?: number
  height?: number
  round?: boolean
  quiet?: boolean
  disabled?: boolean
  hot?: boolean
  /** fires when the button is held for holdMs; the border traces round meanwhile */
  onHold?: () => void
  holdMs?: number
  /** a release after this long is a cancelled hold, not a tap */
  tapWindowMs?: number
  onHoldChange?: (holding: boolean) => void
}

export function Button({
  children, onClick, width = 168, height = 56, round, quiet, disabled, hot,
  onHold, holdMs = 3000, tapWindowMs, onHoldChange,
}: Props) {
  const [tracing, setTracing] = useState(false)
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const holdTimer = useRef<number | undefined>(undefined)
  const pressedAt = useRef(0)
  const completed = useRef(false)

  const endHold = useCallback((cancelled: boolean) => {
    window.clearTimeout(holdTimer.current)
    setHolding(false)
    if (cancelled) onHoldChange?.(false)
  }, [onHoldChange])

  const beginHold = useCallback(() => {
    if (disabled || !onHold) return
    completed.current = false
    pressedAt.current = Date.now()
    setHolding(true)
    onHoldChange?.(true)
    holdTimer.current = window.setTimeout(() => {
      completed.current = true
      endHold(false)
      onHold()
    }, holdMs)
  }, [disabled, endHold, holdMs, onHold, onHoldChange])

  const releaseHold = useCallback(() => {
    if (!onHold || completed.current) return
    endHold(true)
  }, [endHold, onHold])

  const fire = useCallback(() => {
    if (disabled) return
    if (completed.current) return
    if (onHold && tapWindowMs !== undefined && Date.now() - pressedAt.current >= tapWindowMs) return
    setTracing(false)
    window.clearTimeout(timer.current)
    requestAnimationFrame(() => setTracing(true))
    timer.current = window.setTimeout(() => setTracing(false), 1200)
    void onClick?.()
  }, [disabled, onClick])

  const size = round ? { width: height, height } : { width, height }
  const classes = ['btn', round && 'round', quiet && 'quiet', hot && 'hot', tracing && 'tracing', holding && 'holding']
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={classes}
      style={{ ...size, ...(onHold ? { ['--hold-ms' as string]: `${holdMs}ms` } : {}) }}
      onClick={fire}
      disabled={disabled}
      onPointerDown={beginHold}
      onPointerUp={releaseHold}
      onPointerLeave={releaseHold}
      onPointerCancel={releaseHold}
    >
      <svg className="trace" viewBox={`0 0 ${size.width} ${size.height}`}>
        {round ? (
          <circle cx={size.width / 2} cy={height / 2} r={height / 2 - 1} pathLength={100} />
        ) : (
          <rect
            x={0.75}
            y={0.75}
            width={size.width - 1.5}
            height={height - 1.5}
            rx={(height - 1.5) / 2}
            pathLength={100}
          />
        )}
      </svg>
      {children}
    </button>
  )
}
