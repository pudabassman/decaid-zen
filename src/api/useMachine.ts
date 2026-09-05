import { useCallback, useEffect, useRef, useState } from 'react'
import { client } from './client'
import { MOCK, mockScale, mockSnapshot, mockWater, mockWorkflow } from '../lib/mock'
import { useSocket } from './useSocket'
import type { MachineSnapshot, ScaleFrame, ScaleSnapshot, WaterLevels, Workflow } from './types'

export interface Sample {
  t: number
  pressure: number
  flow: number
  weight: number
  mix: number
  targetPressure: number
  targetFlow: number
  targetMix: number
}

const POURING = new Set(['espresso', 'hotWater', 'steam', 'flush'])

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
    setScaleConnected(true)
    client.workflow().then(setWorkflow).catch(() => setWorkflow(mockWorkflow()))
    client.waterLevels().then(setWater).catch(() => setWater(mockWater()))
  }, [])

  const machineStatus = useSocket<MachineSnapshot>('/machine/snapshot', (frame) => {
    if (MOCK) return
    setSnapshot(frame)
    const pouring = POURING.has(frame.state.state)
    const now = Date.parse(frame.timestamp) || Date.now()

    if (pouring && shotStart.current === null) {
      shotStart.current = now
      samples.current = []
    }
    if (!pouring && shotStart.current !== null) shotStart.current = null

    if (shotStart.current !== null) {
      const t = (now - shotStart.current) / 1000
      samples.current.push({
        t,
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
    let id: number | undefined
    client
      .waterLevels()
      .then((levels) => {
        setWater(levels)
        id = window.setInterval(() => {
          client.waterLevels().then(setWater).catch(() => undefined)
        }, 30_000)
      })
      .catch(() => setWater(null))
    return () => window.clearInterval(id)
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
