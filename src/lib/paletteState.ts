import { PALETTE_TOKENS, type Palette } from './paletteTokens.ts'

export const PALETTE_STORAGE_KEY = 'decaid.skin-palettes.v1'
const validColor = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}([\da-f]{2})?$/i.test(value)
export function cleanPalette(value: unknown, fallback: Palette): Palette {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return Object.fromEntries(PALETTE_TOKENS.map(({ key }) => [key, validColor(input[key]) ? input[key].toLowerCase() : fallback[key]]))
}
export function colorWithAlpha(color: string, opacity: number) {
  const alpha = color.length === 9 ? parseInt(color.slice(7), 16) / 255 : 1
  return color.slice(0, 7) + Math.round(alpha * Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0')
}
function rgb(color: string) { return [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255) }
export function contrastRatio(foreground: string, background: string, ground = '#ffffff') {
  const composite = (front: string, back: number[]) => {
    const alpha = front.length === 9 ? parseInt(front.slice(7), 16) / 255 : 1
    return rgb(front).map((channel, index) => channel * alpha + back[index] * (1 - alpha))
  }
  const bg = composite(background, rgb(ground))
  const fg = composite(foreground, bg)
  const luminance = (channels: number[]) => channels.map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0)
  const a = luminance(fg), b = luminance(bg)
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
}
export type SavedPalette = { id: string; name: string; colors: Palette }
type Snapshot = { colors: Palette; defaults: Palette; saved: SavedPalette[]; selected: string; canUndo: boolean; error: string }
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function createPaletteStore(capturedDefaults: Palette, storage?: Storage) {
  const listeners = new Set<() => void>()
  const history: Array<{ colors: Palette; selected: string }> = []
  let editKey = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  let state: Snapshot = { colors: { ...capturedDefaults }, defaults: { ...capturedDefaults }, saved: [], selected: 'default', canUndo: false, error: '' }
  try {
    const raw = storage?.getItem(PALETTE_STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      const defaults = cleanPalette(data.defaults, capturedDefaults)
      const saved: SavedPalette[] = []
      if (Array.isArray(data.saved)) for (const item of data.saved) {
        if (typeof item?.id !== 'string' || item.id === 'default' || typeof item.name !== 'string' || !item.name.trim() || item.name.trim().toLowerCase() === 'default' || saved.some(p => p.id === item.id || p.name.toLowerCase() === item.name.trim().toLowerCase())) continue
        saved.push({ id: item.id, name: item.name.trim().slice(0, 60), colors: cleanPalette(item.colors, defaults) })
      }
      const colors = cleanPalette(data.colors, defaults)
      const selected = data.selected === 'default' || saved.some(item => item.id === data.selected) ? data.selected : ''
      state = { ...state, defaults, colors, saved, selected }
    }
  } catch { state.error = 'Saved palettes could not be read. Default is still available.' }
  const emit = () => listeners.forEach(listener => listener())
  const flush = () => {
    clearTimeout(timer)
    if (!storage) return
    try {
      storage.setItem(PALETTE_STORAGE_KEY, JSON.stringify({ version: 1, defaults: state.defaults, colors: state.colors, saved: state.saved, selected: state.selected }))
      if (state.error) { state = { ...state, error: '' }; emit() }
    } catch { state = { ...state, error: 'Could not save on this device. Changes are visible, but may not survive a reload.' }; emit() }
  }
  const remember = () => {
    history.push({ colors: state.colors, selected: state.selected })
    if (history.length > 40) history.shift()
  }
  const publish = (next: Snapshot, immediate = false) => {
    state = { ...next, canUndo: history.length > 0 }
    emit()
    clearTimeout(timer)
    if (immediate) flush()
    else timer = setTimeout(flush, 150)
  }
  // Capture Default before any edits; later launches retain this protected snapshot.
  if (!state.error) flush()
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    beginEdit() { editKey = '' },
    setColor(key: string, value: string) {
      if (!PALETTE_TOKENS.some(token => token.key === key) || !validColor(value) || state.colors[key] === value.toLowerCase()) return
      if (editKey !== key) remember()
      editKey = key
      publish({ ...state, colors: { ...state.colors, [key]: value.toLowerCase() }, selected: '' })
    },
    choose(id: string) {
      const colors = id === 'default' ? state.defaults : state.saved.find(item => item.id === id)?.colors
      if (!colors) return
      editKey = ''; remember()
      publish({ ...state, colors: { ...colors }, selected: id }, true)
    },
    undo() {
      const previous = history.pop()
      if (!previous) return
      editKey = ''
      publish({ ...state, ...previous }, true)
    },
    save(name: string): string | null {
      const trimmed = name.trim()
      if (!trimmed || trimmed.length > 60) return 'Use a name between 1 and 60 characters.'
      if (trimmed.toLowerCase() === 'default') return 'Default is protected. Choose a different name.'
      if (state.saved.some(item => item.name.toLowerCase() === trimmed.toLowerCase())) return 'That name already exists. Choose a new name.'
      const id = `palette-${Date.now()}-${state.saved.length}`
      editKey = ''
      publish({ ...state, saved: [...state.saved, { id, name: trimmed, colors: { ...state.colors } }], selected: id }, true)
      return null
    },
    flush,
  }
}
