import type { ShotRecord } from '../api/types'

export interface ShotStats {
  seconds: number
  peakPressure: number
  avgFlow: number
  endBrewTemp: number
  yieldValue: number
  yieldUnit: 'g' | 'ml'
  dose?: number
}

export function shotStats(shot: ShotRecord | null): ShotStats | null {
  const points = shot?.measurements ?? []
  if (points.length === 0) return null

  const t0 = Date.parse(points[0].machine.timestamp)
  const seconds = (Date.parse(points[points.length - 1].machine.timestamp) - t0) / 1000

  const weights = points.map((m) => m.scale?.weight ?? 0)
  const byWeight = weights.some((w) => w > 0)
  const volumes = points.map((m) => m.volume ?? 0)

  const pouring = points.filter((m) => m.machine.flow > 0.2)
  const avgFlow = pouring.length
    ? pouring.reduce((sum, m) => sum + m.machine.flow, 0) / pouring.length
    : 0

  return {
    seconds,
    peakPressure: Math.max(...points.map((m) => m.machine.pressure)),
    avgFlow,
    endBrewTemp: points[points.length - 1].machine.mixTemperature,
    yieldValue: byWeight
      ? shot?.annotations?.actualYield ?? Math.max(...weights)
      : Math.max(...volumes),
    yieldUnit: byWeight ? 'g' : 'ml',
    dose: shot?.annotations?.actualDoseWeight ?? shot?.workflow?.context?.targetDoseWeight,
  }
}
