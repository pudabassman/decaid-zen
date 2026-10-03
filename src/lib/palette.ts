import { useSyncExternalStore } from 'react'
import { createPaletteStore } from './paletteState'
import { PALETTE_TOKENS } from './paletteTokens'
import { readCssPalette, refreshCssPalette } from './cssPalette'

const captured = readCssPalette()
const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) }
export const paletteStore = createPaletteStore(captured, storage)
const apply = () => {
  const { colors } = paletteStore.getSnapshot()
  for (const { key } of PALETTE_TOKENS) {
    // Leave unmodified defaults in CSS so they stay easy to edit in one place.
    if (colors[key] === captured[key]) document.documentElement.style.removeProperty(`--${key}`)
    else document.documentElement.style.setProperty(`--${key}`, colors[key])
  }
  refreshCssPalette()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.ground.slice(0, 7))
}
apply()
paletteStore.subscribe(apply)
window.addEventListener('pagehide', paletteStore.flush)
export const usePalette = () => useSyncExternalStore(paletteStore.subscribe, paletteStore.getSnapshot)
