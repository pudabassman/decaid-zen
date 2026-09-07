export const BAND_SECONDS = 2
export const MIN_SHOTS = 2
export const MIN_SECONDS = 8

export type Verdict = 'steady' | 'long' | 'fast'

export interface Spread {
  times: number[]
  center: number
  band: number
  latest: number
  verdict: Verdict
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function spreadOf(times: number[], band = BAND_SECONDS): Spread | null {
  const usable = times.filter((t) => Number.isFinite(t) && t >= MIN_SECONDS)
  if (usable.length < MIN_SHOTS) return null

  const center = median(usable)
  const latest = usable[usable.length - 1]
  const verdict: Verdict = latest > center + band ? 'long' : latest < center - band ? 'fast' : 'steady'

  return { times: usable, center, band, latest, verdict }
}
