import { useEffect, useRef } from 'react'
import { client } from '../api/client'

const COOLDOWN = 30_000

/**
 * The scale usually sleeps with the machine and does not always come back on
 * its own, so waking the app is a good moment to go looking for it.
 */
export function useScaleRevive(asleep: boolean, scaleConnected: boolean, onAttempt?: () => void) {
  const lastTry = useRef(0)
  const wasAsleep = useRef(asleep)

  useEffect(() => {
    const attempt = () => {
      if (scaleConnected) return
      const now = Date.now()
      if (now - lastTry.current < COOLDOWN) return
      lastTry.current = now
      onAttempt?.()
      client.findDevices().catch(() => undefined)
    }

    if (wasAsleep.current && !asleep) attempt()
    wasAsleep.current = asleep

    const onVisible = () => {
      if (document.visibilityState === 'visible') attempt()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [asleep, scaleConnected, onAttempt])
}
