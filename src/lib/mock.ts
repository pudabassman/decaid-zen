import type { MachineSnapshot, ScaleSnapshot, ShotRecord, WaterLevels, Workflow } from '../api/types'

const search = typeof window === 'undefined' ? '' : window.location.search

export const MOCK =
  search.includes('mock') || (import.meta.env.DEV && !search.includes('live'))

const at = (t: number) => new Date(Date.now() - (30 - t) * 1000).toISOString()

const curve = (t: number) => {
  const pressure = t < 2 ? t * 1.5 : t < 8 ? 3 + (t - 2) * 0.9 : t < 22 ? 8.9 - (t - 8) * 0.12 : 7.2 - (t - 22) * 0.35
  const flow = t < 8 ? 0.6 + t * 0.18 : 2.1 - (t - 8) * 0.02
  const weight = t < 6 ? 0 : Math.min(38.4, (t - 6) * 1.62)
  const mix = t < 4 ? 88 + t * 0.8 : 92.4 - (t - 4) * 0.06
  return { pressure, flow, weight, mix }
}

export const mockSnapshot = (): MachineSnapshot => {
  const { pressure, flow, mix } = curve(30)
  return {
    timestamp: new Date().toISOString(),
    state: { state: 'idle', substate: 'ready' },
    flow,
    pressure,
    targetFlow: 2,
    targetPressure: 9,
    mixTemperature: mix,
    groupTemperature: 92.8,
    targetMixTemperature: 92,
    targetGroupTemperature: 92,
    profileFrame: 0,
    steamTemperature: 148.6,
  }
}

export const mockScale = (): ScaleSnapshot => ({
  timestamp: new Date().toISOString(),
  weight: 0.4,
  batteryLevel: 82,
})

export const mockWater = (): WaterLevels => ({ currentLevel: 28, refillLevel: 5 })

export const mockWorkflow = (): Workflow => ({
  name: 'Morning',
  profile: {
    title: 'Blooming Espresso',
    target_weight: 38,
    steps: [
      { name: 'fill', pump: 'flow', flow: 4, seconds: 6 },
      { name: 'bloom', pump: 'flow', flow: 0, seconds: 20 },
      { name: 'ramp', pump: 'pressure', pressure: 9, seconds: 6 },
      { name: 'decline', pump: 'pressure', pressure: 6, seconds: 20 },
    ],
  },
  context: {
    coffeeRoaster: 'Peony',
    coffeeName: 'Kenya Kirinyaga Kabingara Washed',
    grinderModel: 'Niche Zero',
    grinderSetting: '17',
    targetDoseWeight: 18,
    targetYield: 38,
  },
})

export const mockProfiles = () => [
  {
    id: 'profile:lrv2',
    profile: {
      title: "Damian's LRv2",
      steps: [
        { name: 'fill', pump: 'flow' as const, flow: 6, seconds: 4 },
        { name: 'preinfuse', pump: 'pressure' as const, pressure: 3, seconds: 10 },
        { name: 'ramp', pump: 'pressure' as const, pressure: 8.6, seconds: 6 },
        { name: 'decline', pump: 'pressure' as const, pressure: 5.4, seconds: 18 },
      ],
    },
  },
  { id: 'profile:blooming', profile: mockWorkflow().profile! },
  {
    id: 'profile:dflow',
    profile: {
      title: 'D-Flow',
      steps: [
        { name: 'fill', pump: 'flow' as const, flow: 8, seconds: 3 },
        { name: 'infuse', pump: 'flow' as const, flow: 2.2, seconds: 12 },
        { name: 'hold', pump: 'flow' as const, flow: 1.8, seconds: 14 },
      ],
    },
  },
  {
    id: 'profile:italian',
    profile: {
      title: 'Classic Italian',
      steps: [
        { name: 'ramp', pump: 'pressure' as const, pressure: 9, seconds: 4 },
        { name: 'hold', pump: 'pressure' as const, pressure: 9, seconds: 24 },
      ],
    },
  },
  {
    id: 'profile:aflow',
    profile: {
      title: 'A-Flow light',
      steps: [
        { name: 'fill', pump: 'flow' as const, flow: 5, seconds: 5 },
        { name: 'bloom', pump: 'pressure' as const, pressure: 2, seconds: 14 },
        { name: 'push', pump: 'pressure' as const, pressure: 7.4, seconds: 16 },
      ],
    },
  },
]

export const mockGrinds = (): Record<string, string> => ({
  'profile:lrv2': '16.5',
  'profile:blooming': '17.5',
  'profile:italian': '12.5',
})

export const mockShot = (): ShotRecord => ({
  id: 'mock-shot',
  timestamp: new Date(Date.now() - 26 * 60 * 1000).toISOString(),
  workflow: mockWorkflow(),
  annotations: { actualDoseWeight: 18, actualYield: 38.4, drinkTds: 8.7, drinkEy: 20.4, enjoyment: 4 },
  measurements: Array.from({ length: 121 }, (_, i) => {
    const t = i / 4
    const { pressure, flow, weight, mix } = curve(t)
    return {
      machine: {
        timestamp: at(t),
        state: { state: 'espresso' as const, substate: 'pouring' },
        flow,
        pressure,
        targetFlow: 2,
        targetPressure: 9,
        mixTemperature: mix,
        groupTemperature: 92.8,
        targetMixTemperature: 92,
        targetGroupTemperature: 92,
        profileFrame: t < 6 ? 1 : t < 20 ? 2 : t < 26 ? 3 : 4,
        steamTemperature: 148.6,
      },
      scale: { timestamp: at(t), weight, weightFlow: t < 6 ? 0 : 1.6 },
      volume: weight * 1.02,
    }
  }),
})
