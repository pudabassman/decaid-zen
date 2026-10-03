import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { EditableValue } from './EditableValue'
import { Overlay } from './Overlay'

export const SETTINGS_CATEGORIES = ['Brewing', 'Machine & devices', 'Screen & sleep', 'Skin', 'Advanced', 'About'] as const
export type SettingsCategory = typeof SETTINGS_CATEGORIES[number]
export const SettingsCategoryContext = createContext<SettingsCategory | null>(null)
export const SettingsSaveContext = createContext({ busy: false, message: null as string | null })
const RowLabel = createContext('Value')
const sectionCategory: Record<string, SettingsCategory> = {
  Machine: 'Brewing', 'Steam and water': 'Brewing', 'Cup warmer': 'Brewing',
  Devices: 'Machine & devices', Lights: 'Machine & devices', 'Scale and safety': 'Machine & devices',
  'Screen and sleep': 'Screen & sleep', 'Wake schedules': 'Screen & sleep',
  Skin: 'Skin', Skins: 'Skin', Plugins: 'Skin', Heating: 'Advanced', 'Water and calibration': 'Advanced',
  App: 'Advanced', 'Reset machine': 'Advanced', About: 'About',
}
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const category = useContext(SettingsCategoryContext)
  if (category && sectionCategory[title] !== category) return null
  return <section className="settings-section"><h2 className="section-title">{title}</h2>{children}</section>
}
export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <RowLabel.Provider value={label}><div className="setting-row" data-setting={label}>
    <div className="setting-description"><div className="setting-label">{label}</div>{hint && <div className="setting-hint">{hint}</div>}</div>
    <div className="setting-control">{children}</div>
  </div></RowLabel.Provider>
}
export function Toggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  const label = useContext(RowLabel)
  return <button type="button" className={`toggle${on ? ' on' : ''}`} role="switch" aria-label={label} aria-checked={on} onClick={() => onChange(!on)}><span /></button>
}
export function Choice<T extends string | number>({ value, options, onChange }: {
  value: T; options: Array<{ value: T; label: string }>; onChange: (next: T) => void
}) {
  return <div className="choice" role="group" aria-label={useContext(RowLabel)}>{options.map(option =>
    <button type="button" key={String(option.value)} aria-pressed={option.value === value} className={option.value === value ? 'on' : undefined} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>
}
export function SingleSelect<T extends string | number>({ value, options, onChange }: {
  value: T; options: Array<{ value: T; label: string }>; onChange: (next: T) => void
}) {
  const label = useContext(RowLabel)
  return <select className="select-control" aria-label={label} value={String(value)} onChange={e => {
    const option = options.find(o => String(o.value) === e.target.value)
    if (option) onChange(option.value)
  }}>{options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}</select>
}
export function NumberValue({ value, unit, digits = 1, step, min = 0, max = Infinity, onCommit }: {
  value: number | undefined; unit?: string; digits?: number; step?: number; min?: number; max?: number; onCommit: (next: number) => void
}) {
  const label = useContext(RowLabel)
  const current = Number.isFinite(value) ? value as number : 0
  return <div className="number-control">
    {step !== undefined && <button type="button" className="nudge" aria-label={`Decrease ${label}`} disabled={current <= min} onClick={() => onCommit(Math.max(min, +(current - step).toFixed(3)))}>−</button>}
    <EditableValue className="num" value={current.toFixed(digits)} suffix={unit} numeric min={min} max={max} width={90} label={label} onCommit={raw => onCommit(Number(raw))} />
    {step !== undefined && <button type="button" className="nudge" aria-label={`Increase ${label}`} disabled={current >= max} onClick={() => onCommit(Math.min(max, +(current + step).toFixed(3)))}>+</button>}
  </div>
}
export function MultiSelect({ options, chosen, max, empty, onToggle }: {
  options: Array<{ value: string; label: string }>; chosen: string[]; max?: number; empty: string; onToggle: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { busy, message } = useContext(SettingsSaveContext)
  const label = useContext(RowLabel)
  const id = useId()
  const shown = options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
  return <>
    <button type="button" className="select-control" aria-label={label} aria-expanded={open} onClick={() => { setQuery(''); setOpen(true) }}>{chosen.length ? `${chosen.length} selected` : empty} <span aria-hidden="true">⌄</span></button>
    {open && <Overlay title={label} onClose={() => setOpen(false)} footer={<div><span className="hint">{busy ? 'Saving…' : `Choose up to ${max ?? options.length} profiles. Changes save immediately.`}</span>{message && <p className="error-text" role="alert">{message}</p>}</div>}>
      <label className="sr-only" htmlFor={id}>Search profiles</label><input id={id} className="search" value={query} placeholder="Search profiles" onChange={e => setQuery(e.target.value)} />
      <div className="selection-list">{shown.map(option => {
        const on = chosen.includes(option.value)
        return <button type="button" key={option.value} className={`selection-row ${on ? 'on' : ''}`} aria-pressed={on}
          disabled={busy || (!on && max !== undefined && chosen.length >= max)} onClick={() => onToggle(option.value)}>
          <span>{option.label}</span><span aria-hidden="true">{on ? '✓' : '+'}</span>
        </button>
      })}</div>{!shown.length && <p className="hint">No profiles match this search.</p>}
    </Overlay>}
  </>
}
