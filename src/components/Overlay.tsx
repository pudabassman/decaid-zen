import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

let activeOverlays = 0

export function Overlay({ title, onClose, children, footer, dismissible = true, className = '', onEntered, style }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; dismissible?: boolean; className?: string; onEntered?: () => void; style?: CSSProperties
}) {
  const [closing, setClosing] = useState(false)
  const panel = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const dismissibleRef = useRef(dismissible)
  dismissibleRef.current = dismissible
  const titleId = useId()
  const entered = useRef(false)
  const enteredRef = useRef(onEntered)
  enteredRef.current = onEntered
  const finishEntering = useCallback(() => {
    if (entered.current) return
    entered.current = true
    enteredRef.current?.()
  }, [])
  useEffect(() => {
    // Also complete when reduced motion disables the animation or a WebView drops its end event.
    const timer = window.setTimeout(finishEntering, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400)
    return () => clearTimeout(timer)
  }, [finishEntering])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    activeOverlays++
    if (root) root.inert = true
    const el = panel.current
    const focusable = () => Array.from(el?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])
      .filter((item) => item.getClientRects().length > 0)
    focusable()[0]?.focus({ preventScroll: true })
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissibleRef.current) { event.preventDefault(); setClosing(true) }
      if (event.key === 'Tab') {
        const items = focusable()
        const first = items[0], last = items[items.length - 1]
        if (event.shiftKey && (document.activeElement === first || !el?.contains(document.activeElement))) {
          event.preventDefault(); last?.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !el?.contains(document.activeElement))) {
          event.preventDefault(); first?.focus()
        }
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      activeOverlays--
      if (root && activeOverlays === 0) root.inert = false
      previous?.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    if (!closing) return
    const id = window.setTimeout(() => closeRef.current(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200)
    return () => clearTimeout(id)
  }, [closing])
  return createPortal(
    <div className={`overlay ${closing ? 'closing' : ''} ${className}`} style={style}>
      <div className="overlay-veil" onClick={() => dismissible && setClosing(true)} />
      <aside ref={panel} className="overlay-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}
        onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === 'overlayPanelIn') finishEntering() }}>
        <header className="overlay-header"><div><h2 id={titleId}>{title}</h2></div>
          <button className="icon-button" aria-label="Close" disabled={!dismissible} onClick={() => dismissible && setClosing(true)}>×</button>
        </header>
        <div className="overlay-body">{children}</div>
        {footer && <footer className="overlay-footer">{footer}</footer>}
      </aside>
    </div>, document.body,
  )
}
