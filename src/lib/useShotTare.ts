import { useEffect, useRef } from 'react'
import { client } from '../api/client'
import type { MachineSnapshot } from '../api/types'

/** substates the machine passes through before any water reaches the puck */
const BEFORE_THE_POUR = ['preparingForShot', 'idle']

/**
 * The app only tares when it has a fresh scale sample and stop-at-weight is
 * live, so a scale that joined late keeps the cup's weight in the reading.
 * Taring once as the shot spins up costs nothing and never runs mid-pour.
 */
export function useShotTare(snapshot: MachineSnapshot | null, scaleConnected: boolean) {
  const tared = useRef(false)

  useEffect(() => {
    const state = snapshot?.state.state
    const substate = snapshot?.state.substate ?? ''

    if (state !== 'espresso') {
      tared.current = false
      return
    }
    if (tared.current || !scaleConnected) return
    if (!BEFORE_THE_POUR.includes(substate)) return

    tared.current = true
    client.tare().catch(() => undefined)
  }, [snapshot, scaleConnected])
}
