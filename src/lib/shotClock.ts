import type { ShotMeasurement } from '../api/types'

export const RUNNING_ESPRESSO = new Set(['preinfusion', 'pouring'])

export const isPreparing = (point: ShotMeasurement) => point.machine.state.substate === 'preparingForShot'

export function clockStart(points: ShotMeasurement[]): number {
  const first = points.find((point) => RUNNING_ESPRESSO.has(point.machine.state.substate)) ?? points[0]
  return first ? Date.parse(first.machine.timestamp) : NaN
}
