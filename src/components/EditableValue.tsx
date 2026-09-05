import { useEffect, useRef, useState, type CSSProperties } from 'react'

interface Props {
  value: string
  onCommit: (next: string) => void | Promise<void>
  placeholder?: string
  numeric?: boolean
  className?: string
  style?: CSSProperties
  width?: number
  suffix?: string
  label?: string
  options?: string[]
}

const MAX_SUGGESTIONS = 7

export function EditableValue({
  value, onCommit, placeholder, numeric, className, style, width, suffix, label, options,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [highlight, setHighlight] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (!editing) return
    const el = input.current
    if (!el) return
    el.focus()
    el.select()
  }, [editing])

  const query = draft.trim().toLowerCase()
  const suggestions = options
    ? options
        .filter((option) => !query || option.toLowerCase().includes(query))
        .filter((option) => option.toLowerCase() !== query)
        .slice(0, MAX_SUGGESTIONS)
    : []

  const close = (next: string) => {
    setEditing(false)
    setHighlight(0)
    const trimmed = next.trim()
    if (trimmed !== value) void onCommit(trimmed)
  }

  if (editing) {
    return (
      <span className="editwrap">
        <input
          ref={input}
          className={`editable input ${className ?? ''}`}
          style={{ ...style, width: width ?? undefined }}
          value={draft}
          inputMode={numeric ? 'decimal' : 'text'}
          enterKeyHint="done"
          autoComplete="off"
          aria-label={label}
          onChange={(e) => {
            setDraft(e.target.value)
            setHighlight(0)
          }}
          onBlur={() => close(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              close(suggestions[highlight] && highlight > 0 ? suggestions[highlight] : draft)
            }
            if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
            if (e.key === 'ArrowDown' && suggestions.length) {
              e.preventDefault()
              setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
            }
            if (e.key === 'ArrowUp' && suggestions.length) {
              e.preventDefault()
              setHighlight((h) => Math.max(h - 1, 0))
            }
          }}
        />
        {suggestions.length > 0 && (
          <span className="suggest" style={{ width: width ?? undefined }}>
            {suggestions.map((option, index) => (
              <button
                key={option}
                type="button"
                className={`suggest-row${index === highlight ? ' on' : ''}`}
                onPointerDown={(e) => {
                  e.preventDefault()
                  setDraft(option)
                  close(option)
                }}
              >
                {option}
              </button>
            ))}
          </span>
        )}
      </span>
    )
  }

  return (
    <span
      className={`editable ${className ?? ''}`}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setEditing(true)
      }}
    >
      {value || placeholder || '--'}
      {suffix ? <span style={{ marginLeft: 6 }}>{suffix}</span> : null}
    </span>
  )
}
