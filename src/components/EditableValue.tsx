import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { parseNumber } from '../lib/validation'

interface Props {
  value: string
  onCommit: (next: string) => void | Promise<void>
  placeholder?: string
  numeric?: boolean
  min?: number
  max?: number
  className?: string
  style?: CSSProperties
  width?: number
  suffix?: string
  label?: string
  options?: string[]
}

export function EditableValue({ value, onCommit, placeholder, numeric, min = 0, max = Infinity,
  className, style, width, suffix, label, options }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [highlight, setHighlight] = useState(-1)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const committing = useRef(false)
  const id = useId()
  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])
  useEffect(() => {
    if (!editing) return
    input.current?.focus()
    input.current?.select()
    input.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [editing])
  const query = draft.trim().toLowerCase()
  const suggestions = (options ?? []).filter(o => (!query || o.toLowerCase().includes(query)) && o.toLowerCase() !== query).slice(0, 7)
  const close = async (next: string) => {
    if (committing.current) return
    const trimmed = next.trim()
    if (numeric && parseNumber(trimmed, min, max) === null) {
      setError(Number.isFinite(max) ? `Enter a number from ${min} to ${max}.` : `Enter a number of ${min} or more.`)
      return
    }
    committing.current = true
    try {
      if (trimmed !== value) await onCommit(trimmed)
      setEditing(false); setHighlight(-1); setError('')
    } catch { setError('Could not save. Please try again.') }
    finally { committing.current = false }
  }
  if (editing) return <span className="editwrap">
    <input ref={input} className={`editable input ${className ?? ''}`} style={{ ...style, width }} value={draft}
      inputMode={numeric ? 'decimal' : 'text'} enterKeyHint="done" autoComplete="off"
      aria-label={label ?? 'Value'} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
      role={options ? 'combobox' : undefined} aria-expanded={options ? suggestions.length > 0 : undefined}
      aria-controls={options ? `${id}-list` : undefined} aria-autocomplete={options ? 'list' : undefined}
      aria-activedescendant={highlight >= 0 ? `${id}-${highlight}` : undefined}
      onChange={e => { setDraft(e.target.value); setHighlight(-1); setError('') }}
      onBlur={() => { void close(draft) }}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); void close(highlight >= 0 ? suggestions[highlight] ?? draft : draft) }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDraft(value); setError(''); setEditing(false) }
        if (e.key === 'ArrowDown' && suggestions.length) { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)) }
        if (e.key === 'ArrowUp' && suggestions.length) { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
      }} />
    {error && <span id={`${id}-error`} className="field-error" role="alert">{error}</span>}
    {suggestions.length > 0 && <span className="suggest" role="listbox" id={`${id}-list`} aria-label={`${label ?? 'Value'} suggestions`}>
      {suggestions.map((option, index) => <button key={option} id={`${id}-${index}`} type="button" role="option"
        aria-selected={index === highlight} className={`suggest-row${index === highlight ? ' on' : ''}`}
        onPointerDown={e => e.preventDefault()} onClick={() => { setDraft(option); void close(option) }}>{option}</button>)}
    </span>}
  </span>
  return <button type="button" className={`editable ${className ?? ''}`} style={style}
    aria-label={label} title={`Edit ${label?.toLowerCase() ?? 'value'}`} onClick={() => setEditing(true)}>
    {value || placeholder || '—'}{suffix && <span className="value-unit">{suffix}</span>}
  </button>
}
