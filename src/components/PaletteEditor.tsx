import { memo, useState, type CSSProperties } from 'react'
import { Overlay } from './Overlay'
import { paletteStore, usePalette } from '../lib/palette'
import { PALETTE_TOKENS } from '../lib/paletteTokens'
import { contrastRatio } from '../lib/paletteState'

const groups = [...new Set(PALETTE_TOKENS.map(token => token.group))]
const pairs = [
  ['Primary text', 'ink', 'ground'], ['Drawer text', 'ink', 'panel'], ['Secondary text', 'ink-soft', 'panel'],
  ['Muted labels', 'muted', 'ground'], ['Button text', 'ink', 'button-fill'], ['Danger button', 'hot-text', 'hot-fill'],
] as const
const ColorField = memo(function ColorField({ token, value }: { token: typeof PALETTE_TOKENS[number]; value: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const opacity = value.length === 9 ? Math.round(parseInt(value.slice(7), 16) / 255 * 100) : 100
  const change = (color: string) => paletteStore.setColor(token.key, color)
  return <div className="palette-color-row">
    <label className="palette-color-name" htmlFor={`palette-${token.key}`}>{token.label}</label>
    <input id={`palette-${token.key}`} aria-label={token.label} type="color" onChange={() => {}} value={value.slice(0, 7)} onFocus={() => paletteStore.beginEdit()} onPointerDown={() => paletteStore.beginEdit()} onInput={event => change(event.currentTarget.value + (value.length === 9 ? value.slice(7) : ''))} />
    <input className="palette-hex" aria-label={`${token.label} hex`} value={draft ?? value} maxLength={9} spellCheck={false}
      onFocus={() => paletteStore.beginEdit()} onChange={event => { const next = event.target.value; setDraft(next); if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(next)) change(next) }}
      onBlur={() => setDraft(null)} onKeyDown={event => { if (event.key === 'Enter') { setDraft(null); event.currentTarget.blur() } }} />
    <label className="palette-opacity">Opacity <input type="range" onChange={() => {}} min="0" max="100" value={opacity} aria-label={`${token.label} opacity`} onFocus={() => paletteStore.beginEdit()} onPointerDown={() => paletteStore.beginEdit()} onInput={event => change(value.slice(0, 7) + Math.round(Number(event.currentTarget.value) * 2.55).toString(16).padStart(2, '0'))} /><span>{opacity}%</span></label>
  </div>
})

export function PaletteEditor({ onClose }: { onClose: () => void }) {
  const state = usePalette()
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const needle = query.trim().toLowerCase()
  const warnings = pairs.map(([label, fg, bg]) => ({ label, ratio: contrastRatio(state.colors[fg], state.colors[bg], state.colors.ground) })).filter(item => item.ratio < 4.5)
  const editorColors = { '--editor-bg': state.defaults.panel, '--editor-fg': state.defaults.ink, '--editor-muted': state.defaults['ink-soft'], '--editor-line': state.defaults.rule, '--editor-input': state.defaults.ground } as CSSProperties
  return <Overlay style={editorColors} className="palette-editor" title="Colour palette" onClose={onClose} footer={<div className="palette-recovery" style={editorColors}>
    <button type="button" disabled={!state.canUndo} onClick={() => paletteStore.undo()}>Undo</button>
    <button type="button" onClick={() => { paletteStore.choose('default'); setMessage('Default restored') }}>Reset to Default</button>
    <span>Default is protected</span>
  </div>}>
    <div className="palette-controls" style={editorColors}>
      <p className="palette-intro">Changes apply immediately. Saved palettes stay on this device.</p>
      <label className="palette-label">Saved palettes<select aria-label="Saved palettes" value={state.selected} onChange={event => { paletteStore.choose(event.target.value); setMessage('') }}>
        <option value="" disabled>Custom · unsaved palette</option><option value="default">Default · protected</option>
        {state.saved.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select></label>
      <form className="palette-save" onSubmit={event => { event.preventDefault(); const error = paletteStore.save(name); setMessage(error ?? `Saved “${name.trim()}”`); if (!error) setName('') }}>
        <input aria-label="Palette name" placeholder="Name this palette" maxLength={60} value={name} onChange={event => setName(event.target.value)} /><button type="submit" disabled={!name.trim()}>Save palette</button>
      </form>
      {(state.error || message) && <p className="palette-message" role="status">{state.error || message}</p>}
      <details className="palette-contrast"><summary>{warnings.length ? `${warnings.length} contrast hints` : 'Text contrast looks good'}</summary>
        <p>4.5:1 is a useful target for small text. These hints do not limit your choices.</p>
        {warnings.map(item => <div key={item.label}>{item.label}: {item.ratio.toFixed(1)}:1</div>)}
      </details>
      <input className="palette-search" aria-label="Find a colour" placeholder={`Find a colour · ${PALETTE_TOKENS.length} colours`} value={query} onChange={event => setQuery(event.target.value)} />
      {groups.map(group => {
        const tokens = PALETTE_TOKENS.filter(token => token.group === group && (!needle || `${token.label} ${token.key} ${token.group}`.toLowerCase().includes(needle)))
        if (!tokens.length) return null
        return <details className="palette-group" key={`${group}-${!!needle}`} open={!!needle || group === 'Surfaces'}><summary>{group}<span>{tokens.length}</span></summary>
          {tokens.map(token => <ColorField key={token.key} token={token} value={state.colors[token.key]} />)}
        </details>
      })}
    </div>
  </Overlay>
}
