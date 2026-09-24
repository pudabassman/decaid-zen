import { useCallback, useEffect, useRef, useState } from 'react'
import { client } from './client'
import { MOCK, mockScale, mockSnapshot, mockWater, mockWorkflow } from '../lib/mock'
import { MOCK_SHOT, pourAt } from '../lib/mockPour'
import { useSocket } from './useSocket'
import { RUNNING_ESPRESSO, clockStart, isPreparing } from '../lib/shotClock'
import type { MachineSnapshot, ScaleFrame, ScaleSnapshot, ShotRecord, WaterLevels, Workflow } from './types'

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
/** the machine is getting ready, so nothing on screen belongs to the run yet */
const PREPARING = new Set(['preparingForShot'])
/** water has stopped: the trace and the clock hold where they are */
const ENDED = new Set(['pouringDone'])
const PREP_FRAME = -1

export function useMachine() {
  const [snapshot, setSnapshot] = useState<MachineSnapshot | null>(null)
  const [scale, setScale] = useState<ScaleSnapshot | null>(null)
  const [scaleConnected, setScaleConnected] = useState(false)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [water, setWater] = useState<WaterLevels | null>(null)

  const samples = useRef<Sample[]>([])
  const shotStart = useRef<number | null>(null)
  const traceStart = useRef<number | null>(null)
  const shotOrigin = useRef<number | null>(null)
  const weight = useRef(0)
  const [elapsed, setElapsed] = useState(0)
  // a replay drives the same buffers the socket does, so the live screen needs no special case
  const replaying = useRef(false)
  const replayFrame = useRef(0)
  const replayTail = useRef(0)
  const live = useRef<MachineSnapshot | null>(null)
  const [replay, setReplay] = useState(false)

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
    shotOrigin.current = 2
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
      samples.current.push({
        t: raw,
        frame: preparing ? PREP_FRAME : t < 6 ? 1 : t < 20 ? 2 : 3,
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
    live.current = frame
    if (replaying.current) return
    setSnapshot(frame)
    const pouring = POURING.has(frame.state.state)
    const now = Date.parse(frame.timestamp) || Date.now()

    const substate = frame.state.substate
    // an espresso names its steps, so the clock waits for preinfusion and reads the same
    // as the scale's own timer; steam and hot water only ever report a pour
    const running =
      pouring &&
      (frame.state.state === 'espresso'
        ? RUNNING_ESPRESSO.has(substate)
        : !PREPARING.has(substate) && !ENDED.has(substate))
    // the last run stays on screen until the machine starts getting ready for the next one
    const preparing = pouring && PREPARING.has(substate)
    if (preparing && traceStart.current === null) {
      traceStart.current = now
      shotOrigin.current = null
      samples.current = []
    }
    if (running && shotStart.current === null) {
      shotStart.current = now
      if (traceStart.current === null) {
        traceStart.current = now
        samples.current = []
      }
      shotOrigin.current = (now - traceStart.current) / 1000
    }
    if (!pouring) traceStart.current = null
    if (!pouring && shotStart.current !== null) {
      shotStart.current = null
      setElapsed(0)
    }

    // the clock and the trace both freeze when water stops, while the finished shot stays on screen
    if (traceStart.current !== null && (running || preparing)) {
      samples.current.push({
        t: (now - traceStart.current) / 1000,
        frame: preparing ? PREP_FRAME : frame.profileFrame,
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
      if (running && shotStart.current !== null) setElapsed((now - shotStart.current) / 1000)
    }
  })

  // the app exposes water levels on a socket only; there is no REST GET for them
  useSocket<WaterLevels>('/machine/waterLevels', (frame) => {
    if (MOCK) return
    if (frame && typeof frame.currentLevel === 'number') setWater(frame)
  })

  useSocket<ScaleFrame>('/scale/snapshot', (frame) => {
    if (MOCK) return
    if (replaying.current) return
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

  const stopReplay = useCallback(() => {
    if (replayFrame.current) cancelAnimationFrame(replayFrame.current)
    if (replayTail.current) window.clearTimeout(replayTail.current)
    replayFrame.current = 0
    replayTail.current = 0
    replaying.current = false
    setReplay(false)
    shotStart.current = null
    setElapsed(0)
    if (live.current) setSnapshot(live.current)
  }, [])

  const replayShot = useCallback((shot: ShotRecord) => {
    const points = shot.measurements ?? []
    if (points.length < 2) return
    if (replayFrame.current) cancelAnimationFrame(replayFrame.current)

    replaying.current = true
    setReplay(true)
    samples.current = []
    shotStart.current = 0
    const base = Date.parse(points[0].machine.timestamp)
    shotOrigin.current = Math.max(0, (clockStart(points) - base) / 1000)
    const at = (index: number) => (Date.parse(points[index].machine.timestamp) - base) / 1000
    const startedAt = performance.now()
    let next = 0

    const step = () => {
      const now = (performance.now() - startedAt) / 1000
      while (next < points.length && at(next) <= now) {
        const point = points[next]
        const t = at(next)
        setSnapshot(point.machine)
        setScale({ timestamp: point.machine.timestamp, weight: point.scale?.weight ?? 0 })
        samples.current.push({
          t,
          frame: isPreparing(point) ? PREP_FRAME : point.machine.profileFrame,
          steam: point.machine.steamTemperature,
          pressure: point.machine.pressure,
          flow: point.machine.flow,
          weight: point.scale?.weight ?? 0,
          mix: point.machine.mixTemperature,
          targetPressure: point.machine.targetPressure,
          targetFlow: point.machine.targetFlow,
          targetMix: point.machine.targetMixTemperature,
        })
        setElapsed(Math.max(0, t - (shotOrigin.current ?? 0)))
        next += 1
      }
      if (next >= points.length) {
        // the finished trace holds long enough to read, the way a real shot does
        replayFrame.current = 0
        replayTail.current = window.setTimeout(stopReplay, 12000)
        return
      }
      replayFrame.current = requestAnimationFrame(step)
    }

    replayFrame.current = requestAnimationFrame(step)
  }, [stopReplay])

  useEffect(() => () => {
    if (replayFrame.current) cancelAnimationFrame(replayFrame.current)
    if (replayTail.current) window.clearTimeout(replayTail.current)
  }, [])

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
    shotOrigin,
    connection: machineStatus,
    refreshWorkflow,
    replay,
    replayShot,
    stopReplay,
  }
}
