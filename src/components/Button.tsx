import { BorderTrace } from './BorderTrace'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  label?: string
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
  label, children, onClick, width = 168, height = 56, round, quiet, disabled, hot,
  onHold, holdMs = 3000, tapWindowMs, onHoldChange,
}: Props) {
  const button = useRef<HTMLButtonElement>(null)
  const [holding, setHolding] = useState(false)
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

  useEffect(() => () => window.clearTimeout(holdTimer.current), [])
  const fire = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.detail !== 0 && (completed.current || (onHold && tapWindowMs !== undefined && Date.now() - pressedAt.current >= tapWindowMs))) return
    void onClick?.()
  }

  const size = round ? { width: height, height } : { width, height }
  const classes = ['btn', round && 'round', quiet && 'quiet', hot && 'hot', holding && 'holding']
    .filter(Boolean)
    .join(' ')

  return (
    <button
      ref={button}
      type="button"
      aria-label={label}
      className={classes}
      style={{ ...size, ...(onHold ? { ['--hold-ms' as string]: `${holdMs}ms` } : {}) }}
      onClick={fire}
      disabled={disabled}
      onPointerDown={(event) => { if (event.button === 0) beginHold() }}
      onPointerUp={releaseHold}
      onPointerLeave={releaseHold}
      onPointerCancel={releaseHold}
    >
      {onHold && <BorderTrace target={button} />}
      {children}
    </button>
  )
}
