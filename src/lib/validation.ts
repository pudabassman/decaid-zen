export function parseNumber(raw: string, min = 0, max = Infinity): number | null {
  const text = raw.trim()
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) && value >= min && value <= max ? value : null
}

/** Gateway frames are zero-based; keep presentation and graph indexing identical. */
export function profileStepIndex(frame: number, count: number): number {
  return Math.max(0, Math.min(Math.max(0, count - 1), Math.floor(Number.isFinite(frame) ? frame : 0)))
}

export function weightCeiling(target: number, measured: number, floor = 40): number {
  return Math.ceil(Math.max(floor, target * 1.15, measured * 1.1) / 10) * 10
}
