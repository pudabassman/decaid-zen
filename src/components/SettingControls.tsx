import { useState, type ReactNode } from 'react'
import { EditableValue } from './EditableValue'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 34 }}>
      <div className="cap strong" style={{ marginBottom: 14 }}>{title}</div>
      <div>{children}</div>
    </section>
  )
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div
      className="row between"
      style={{
        gap: 24,
        padding: '14px 0',
        borderTop: '1px solid var(--rule-soft)',
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="display" style={{ fontSize: 20 }}>{label}</div>
        {hint && <div className="cap" style={{ marginTop: 4 }}>{hint}</div>}
      </div>
      <div className="row" style={{ gap: 12, flex: '0 0 auto' }}>{children}</div>
    </div>
  )
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      className={`toggle${on ? ' on' : ''}`}
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  )
}

export function Choice<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (next: T) => void
}) {
  return (
    <div className="choice">
      {options.map((option) => (
        <button
          key={String(option.value)}
          className={option.value === value ? 'on' : undefined}
          onClick={() => onChange(option.value)}
        >
          <span className="cap">{option.label}</span>
        </button>
      ))}
    </div>
  )
}

export function NumberValue({
  value,
  unit,
  digits = 1,
  step,
  onCommit,
}: {
  value: number | undefined
  unit?: string
  digits?: number
  step?: number
  onCommit: (next: number) => void
}) {
  const commit = (raw: string) => {
    const parsed = Number.parseFloat(raw)
    if (Number.isFinite(parsed)) onCommit(parsed)
  }

  const current = Number.isFinite(value) ? (value as number) : 0

  return (
    <div className="row" style={{ gap: 10, alignItems: 'center' }}>
      {step !== undefined && (
        <button className="nudge" onClick={() => onCommit(+(current - step).toFixed(3))}>
          −
        </button>
      )}
      <EditableValue
        className="num"
        style={{ fontSize: 24 }}
        value={current.toFixed(digits)}
        suffix={unit}
        numeric
        width={90}
        onCommit={commit}
      />
      {step !== undefined && (
        <button className="nudge" onClick={() => onCommit(+(current + step).toFixed(3))}>
          +
        </button>
      )}
    </div>
  )
}

export function MultiSelect({
  options,
  chosen,
  max,
  empty,
  onToggle,
}: {
  options: Array<{ value: string; label: string }>
  chosen: string[]
  max?: number
  empty: string
  onToggle: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const summary = chosen.length ? `${chosen.length} of ${max ?? options.length}` : empty

  const needle = query.trim().toLowerCase()
  const shown = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options

  return (
    <div className="multiwrap">
      <button
        className="multibutton"
        onClick={() => {
          setQuery('')
          setOpen((was) => !was)
        }}
      >
        <span className="cap">{summary}</span>
        <span className={`multicaret${open ? ' open' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth={1.4} strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <>
          <div className="multiveil" onPointerDown={() => setOpen(false)} />
          <div className="multipanel">
            {options.length > 3 && (
              <div className="multisearch">
                <input
                  className="search"
                  autoFocus
                  value={query}
                  placeholder="Search profiles"
                  enterKeyHint="search"
                  autoComplete="off"
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}
            {shown.map((option) => {
              const on = chosen.includes(option.value)
              const full = !on && max !== undefined && chosen.length >= max
              return (
                <button
                  key={option.value}
                  className={`multirow${on ? ' on' : ''}`}
                  disabled={full}
                  onClick={() => onToggle(option.value)}
                >
                  <span className="multitick">{on ? '·' : ''}</span>
                  <span className="display">{option.label}</span>
                </button>
              )
            })}
            {shown.length === 0 && (
              <div className="cap" style={{ padding: '14px 16px' }}>
                {options.length ? `Nothing matches "${query}"` : 'Nothing to choose'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
