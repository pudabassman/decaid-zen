import { useSyncExternalStore } from 'react'
import '../styles/palette-tokens.css'
import { PALETTE_TOKENS, type Palette } from './paletteTokens'

// Canvas cannot resolve var(--color) itself. Read the same resolved root values
// used by CSS/SVG and normalize CSS color syntax for the native colour controls.
const pixel = document.createElement('canvas')
pixel.width = pixel.height = 1
const context = pixel.getContext('2d', { willReadFrequently: true })!
export function readCssPalette(): Palette {
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(PALETTE_TOKENS.map(({ key }) => {
    const value = style.getPropertyValue(`--${key}`).trim()
    if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(value)) return [key, value.toLowerCase()]
    if (!value || !CSS.supports('color', value)) throw new Error(`Missing or invalid skin colour: --${key}`)
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
    return [key, '#' + [r, g, b, ...(a === 255 ? [] : [a])].map(channel => channel.toString(16).padStart(2, '0')).join('')]
  }))
}

let colors = readCssPalette()
const listeners = new Set<() => void>()
let frame = 0
export function refreshCssPalette() {
  const next = readCssPalette()
  if (PALETTE_TOKENS.every(({ key }) => next[key] === colors[key])) return
  colors = next
  listeners.forEach(listener => listener())
}
const scheduleRefresh = () => {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(refreshCssPalette)
}
// Also follow direct CSS-variable edits, theme classes and stylesheet updates.
const observer = new MutationObserver(scheduleRefresh)
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] })
observer.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'media', 'disabled'] })
document.head.addEventListener('load', scheduleRefresh, true)
window.addEventListener('resize', scheduleRefresh)
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const useCssPalette = () => useSyncExternalStore(subscribe, () => colors)
