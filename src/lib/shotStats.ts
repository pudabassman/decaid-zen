import type { ShotRecord } from '../api/types'

export interface ShotStats {
  seconds: number
  endPressure: number
  endFlow: number
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
  // the graph ends on the last sample, so the swatch reads the same number;
  // annotations.actualYield is the app's own figure and can differ
  const endWeight = weights[weights.length - 1] || Math.max(...weights)


  return {
    seconds,
    endPressure: points[points.length - 1].machine.pressure,
    endFlow: points[points.length - 1].machine.flow,
    endBrewTemp: points[points.length - 1].machine.mixTemperature,
    yieldValue: byWeight ? endWeight : Math.max(...volumes),
    yieldUnit: byWeight ? 'g' : 'ml',
    dose: shot?.annotations?.actualDoseWeight ?? shot?.workflow?.context?.targetDoseWeight,
  }
}
