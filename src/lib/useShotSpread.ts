import { useEffect, useState } from 'react'
import { client } from '../api/client'
import { shotStats } from './shotStats'
import { spreadOf, type Spread } from './shotSpread'

const seconds = new Map<string, number>()

async function durationOf(id: string): Promise<number | null> {
  const known = seconds.get(id)
  if (known !== undefined) return known
  const stats = shotStats(await client.shot(id))
  if (!stats) return null
  seconds.set(id, stats.seconds)
  return stats.seconds
}

export type Basis = 'bean' | 'profile'

export interface Reading {
  spread: Spread
  /** how wide the net had to be cast to find enough shots */
  basis: Basis
}

export function useShotSpread(coffeeName: string | undefined, profileTitle: string | undefined, count = 8) {
  const [reading, setReading] = useState<Reading | null>(null)

  useEffect(() => {
    if (!profileTitle) {
      setReading(null)
      return
    }

    let cancelled = false

    const durations = async (filter: { coffeeName?: string; profileTitle: string }) => {
      const page = await client.shots(count, 0, filter)
      const times: number[] = []
      for (const item of [...page.items].reverse()) {
        if (cancelled) return times
        const value = await durationOf(item.id).catch(() => null)
        if (value !== null) times.push(value)
      }
      return times
    }

    const load = async () => {
      const onBean = spreadOf(coffeeName ? await durations({ coffeeName, profileTitle }) : [])
      if (cancelled) return
      if (onBean) {
        setReading({ spread: onBean, basis: 'bean' })
        return
      }
      const onProfile = spreadOf(await durations({ profileTitle }))
      if (cancelled) return
      setReading(onProfile ? { spread: onProfile, basis: 'profile' } : null)
    }

    load().catch(() => {
      if (!cancelled) setReading(null)
    })

    return () => {
      cancelled = true
    }
  }, [coffeeName, profileTitle, count])

  return reading
}
