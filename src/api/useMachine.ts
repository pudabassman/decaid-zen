import { useCallback, useEffect, useRef, useState } from 'react'
import { client } from './client'
import { MOCK, mockScale, mockSnapshot, mockWater, mockWorkflow } from '../lib/mock'
import { MOCK_SHOT, pourAt } from '../lib/mockPour'
import { useSocket } from './useSocket'
import type { MachineSnapshot, ScaleFrame, ScaleSnapshot, WaterLevels, Workflow } from './types'

export interface Sample {
  t: number
  frame: number
  steam: number
  pressure: number
  flow: number
  weight: number
  mix: number
  targetPressure: number
  targetFlow: number
  targetMix: number
}

const POURING = new Set(['espresso', 'hotWater', 'steam', 'flush'])
/** the clock starts when water actually moves, not while the machine gets ready */
const RUNNING = new Set(['preinfusion', 'pouring'])

export function useMachine() {
  const [snapshot, setSnapshot] = useState<MachineSnapshot | null>(null)
  const [scale, setScale] = useState<ScaleSnapshot | null>(null)
  const [scaleConnected, setScaleConnected] = useState(false)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [water, setWater] = useState<WaterLevels | null>(null)

  const samples = useRef<Sample[]>([])
  const shotStart = useRef<number | null>(null)
  const weight = useRef(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!MOCK) return
    setSnapshot(mockSnapshot())
    setScale(mockScale())
    setScaleConnected(!window.location.search.includes('noscale'))
    client.workflow().then(setWorkflow).catch(() => setWorkflow(mockWorkflow()))
    client.waterLevels().then(setWater).catch(() => setWater(mockWater()))

    if (!MOCK_SHOT) return
    const startedAt = Date.now()
    samples.current = []
    const id = window.setInterval(() => {
      const raw = (Date.now() - startedAt) / 1000
      const preparing = raw < 2
      const t = Math.max(0, raw - 2)
      const pour = pourAt(t)
      setSnapshot({
        ...mockSnapshot(),
        timestamp: new Date().toISOString(),
        steamTemperature: 138 + Math.min(12, t * 0.6),
        state: {
          state: window.location.search.includes('steam') ? 'steam' : 'espresso',
          substate: preparing ? 'preparingForShot' : 'pouring',
        },
        pressure: pour.pressure,
        flow: pour.flow,
        mixTemperature: pour.mix,
        targetPressure: pour.targetPressure,
        targetFlow: pour.targetFlow,
        targetMixTemperature: pour.targetMix,
        profileFrame: t < 6 ? 1 : t < 20 ? 2 : 3,
      })
      setScale({ timestamp: new Date().toISOString(), weight: pour.weight })
      if (preparing) return
      samples.current.push({
        t,
        frame: t < 6 ? 1 : t < 20 ? 2 : 3,
        steam: 138 + Math.min(12, t * 0.6),
        pressure: pour.pressure,
        flow: pour.flow,
        weight: pour.weight,
        mix: pour.mix,
        targetPressure: pour.targetPressure,
        targetFlow: pour.targetFlow,
        targetMix: pour.targetMix,
      })
      setElapsed(t)
    }, 100)
    return () => window.clearInterval(id)
  }, [])

  const machineStatus = useSocket<MachineSnapshot>('/machine/snapshot', (frame) => {
    if (MOCK) return
    setSnapshot(frame)
    const pouring = POURING.has(frame.state.state)
    const now = Date.parse(frame.timestamp) || Date.now()

    const running = pouring && RUNNING.has(frame.state.substate)
    if (running && shotStart.current === null) {
      shotStart.current = now
      samples.current = []
    }
    if (!pouring && shotStart.current !== null) {
      shotStart.current = null
      setElapsed(0)
    }

    if (shotStart.current !== null) {
      const t = (now - shotStart.current) / 1000
      samples.current.push({
        t,
        frame: frame.profileFrame,
        steam: frame.steamTemperature,
        pressure: frame.pressure,
        flow: frame.flow,
        weight: weight.current,
        mix: frame.mixTemperature,
        targetPressure: frame.targetPressure,
        targetFlow: frame.targetFlow,
        targetMix: frame.targetMixTemperature,
      })
      if (samples.current.length > 3000) samples.current.splice(0, samples.current.length - 3000)
      setElapsed(t)
    }
  })

  // the app exposes water levels on a socket only; there is no REST GET for them
  useSocket<WaterLevels>('/machine/waterLevels', (frame) => {
    if (MOCK) return
    if (frame && typeof frame.currentLevel === 'number') setWater(frame)
  })

  useSocket<ScaleFrame>('/scale/snapshot', (frame) => {
    if (MOCK) return
    if ('status' in frame) {
      setScaleConnected(frame.status === 'connected')
      return
    }
    weight.current = frame.weight
    setScale(frame)
  })

  const refreshWorkflow = useCallback(() => {
    client.workflow().then(setWorkflow).catch(() => setWorkflow(null))
  }, [])

  useEffect(() => {
    if (MOCK) return
    refreshWorkflow()
  }, [refreshWorkflow])

  const pouring = snapshot ? POURING.has(snapshot.state.state) : false

  return {
    snapshot,
    scale,
    scaleConnected,
    workflow,
    water,
    pouring,
    elapsed: pouring ? elapsed : 0,
    samples,
    connection: machineStatus,
    refreshWorkflow,
  }
}
