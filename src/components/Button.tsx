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
}

export function Button({ children, onClick, width = 168, height = 56, round, quiet, disabled, hot }: Props) {
  const [tracing, setTracing] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const fire = useCallback(() => {
    if (disabled) return
    setTracing(false)
    window.clearTimeout(timer.current)
    requestAnimationFrame(() => setTracing(true))
    timer.current = window.setTimeout(() => setTracing(false), 1200)
    void onClick?.()
  }, [disabled, onClick])

  const size = round ? { width: height, height } : { width, height }
  const classes = ['btn', round && 'round', quiet && 'quiet', hot && 'hot', tracing && 'tracing']
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} style={size} onClick={fire} disabled={disabled}>
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
