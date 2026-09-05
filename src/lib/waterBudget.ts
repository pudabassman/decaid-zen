import { useEffect, useRef, useState } from 'react'
import { api } from './gateway'
import type { MachineStateName, WaterLevels } from '../api/types'

const STORE = 'decaid-zen'
const KEY = 'waterUse'
const KEEP = 5
const DEFAULT_MAX_MM = 45

interface WaterUse {
  shot: number[]
  steam: number[]
  maxLevel: number
  /** millilitres pumped per millimetre of tank drop, learned from espresso */
  mlPerMm: number[]
}

const empty: WaterUse = { shot: [], steam: [], maxLevel: DEFAULT_MAX_MM, mlPerMm: [] }

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

const load = async (): Promise<WaterUse> => {
  try {
    const res = await fetch(api(`/store/${STORE}/${KEY}`))
    if (!res.ok) return empty
    const text = await res.text()
    const parsed = text ? (JSON.parse(text) as Partial<WaterUse> | null) : null
    if (!parsed) return empty
    return {
      shot: parsed.shot ?? [],
      steam: parsed.steam ?? [],
      maxLevel: parsed.maxLevel ?? DEFAULT_MAX_MM,
      mlPerMm: parsed.mlPerMm ?? [],
    }
  } catch {
    return empty
  }
}

const save = (use: WaterUse) =>
  fetch(api(`/store/${STORE}/${KEY}`), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(use),
  }).catch(() => undefined)

const POURING: MachineStateName[] = ['espresso', 'steam']

export function useWaterBudget(
  water: WaterLevels | null,
  state: MachineStateName | undefined,
  flow: number | undefined,
  enabled = true,
) {
  const [use, setUse] = useState<WaterUse>(empty)
  const started = useRef<{ state: MachineStateName; level: number } | null>(null)
  const previous = useRef<MachineStateName | undefined>(undefined)
  const pumped = useRef(0)
  const lastTick = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    const now = Date.now()
    const previousTick = lastTick.current
    lastTick.current = now
    if (state !== 'espresso') {
      pumped.current = 0
      return
    }
    if (previousTick === null) return
    const dt = Math.min(1.5, (now - previousTick) / 1000)
    pumped.current += Math.max(0, flow ?? 0) * dt
  }, [flow, state, enabled])

  useEffect(() => {
    if (!enabled) return
    load().then(setUse)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const level = water?.currentLevel
    const was = previous.current
    previous.current = state
    if (level === undefined || state === undefined) return

    if (state !== was && POURING.includes(state)) {
      started.current = { state, level }
      return
    }

    if (was !== undefined && POURING.includes(was) && state !== was) {
      const mark = started.current
      started.current = null
      if (!mark || mark.state !== was) return
      const drop = mark.level - level
      if (drop <= 0 || drop > 20) return
      const pumpedMl = pumped.current
      pumped.current = 0
      setUse((prev) => {
        const key = was === 'espresso' ? 'shot' : 'steam'
        const next: WaterUse = {
          ...prev,
          [key]: [...prev[key], Number(drop.toFixed(2))].slice(-KEEP),
        }
        if (was === 'espresso' && pumpedMl > 5) {
          next.mlPerMm = [...prev.mlPerMm, Number((pumpedMl / drop).toFixed(2))].slice(-KEEP)
        }
        void save(next)
        return next
      })
    }
  }, [water?.currentLevel, state, enabled])

  useEffect(() => {
    const level = water?.currentLevel
    if (!enabled || level === undefined || level <= use.maxLevel) return
    setUse((prev) => {
      const next = { ...prev, maxLevel: Math.ceil(level) }
      void save(next)
      return next
    })
  }, [water?.currentLevel, use.maxLevel, enabled])

  const perShot = mean(use.shot)
  const perSteam = mean(use.steam)
  const perDrink = perShot !== null && perSteam !== null ? perShot + perSteam : null
  const usable = water ? Math.max(0, (water.currentLevel ?? 0) - (water.refillLevel ?? 0)) : 0
  const drinksLeft = perDrink && perDrink > 0 ? usable / perDrink : null
  const mlPerMm = mean(use.mlPerMm)
  const mlLeft = mlPerMm !== null && water ? Math.round(usable * mlPerMm) : null

  return {
    maxLevel: Math.max(use.maxLevel, DEFAULT_MAX_MM),
    perShot,
    perSteam,
    drinksLeft,
    mlLeft,
    mlPerMm,
    samples: { shot: use.shot.length, steam: use.steam.length },
    /** one shot plus its steam is all that is left in the tank */
    lastDrink: drinksLeft !== null && drinksLeft < 2,
  }
}
