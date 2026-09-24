import { useEffect, useState } from 'react'
import { useMachine } from './api/useMachine'
import { Idle } from './screens/Idle'
import { LiveShot } from './screens/LiveShot'
import { Journal } from './screens/Journal'
import { DialIn } from './screens/DialIn'
import { Settings } from './screens/Settings'
import { Sleep } from './screens/Sleep'
import { MOCK } from './lib/mock'
import { ensureBundledPlugin } from './api/bundledPlugin'
import { useScaleRevive } from './lib/useScaleRevive'
import { useShotTare } from './lib/useShotTare'
import { consumePendingReplay } from './lib/demoReplay'
import { client } from './api/client'

type View = 'home' | 'journal' | 'dialin' | 'settings'

const FIRST_FRAME_GRACE_MS = 1500

const opening = (): View =>
  MOCK && window.location.search.includes('settings') ? 'settings' : 'home'

export function App() {
  const machine = useMachine()
  const [view, setView] = useState<View>(opening)
  const [graceOver, setGraceOver] = useState(false)

  const state = machine.snapshot?.state.state
  const asleep = state === 'sleeping' || state === 'booting'

  // the scale sleeps with the machine; waking is the moment to go looking for it
  useScaleRevive(asleep, machine.scaleConnected, machine.pouring)
  useShotTare(machine.snapshot, machine.scaleConnected)

  useEffect(() => {
    const id = window.setTimeout(() => setGraceOver(true), FIRST_FRAME_GRACE_MS)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    ensureBundledPlugin().catch(() => undefined)
  }, [])

  // a demo replay reloads first so it always runs the newest skin build
  useEffect(() => {
    if (!consumePendingReplay()) return
    client
      .latestShot()
      // the latest-shot endpoint answers without measurements
      .then((latest) => client.shot(latest.id))
      .then((shot) => {
        if (shot.measurements?.length) machine.replayShot(shot)
      })
      .catch(() => undefined)
  }, [machine])

  useEffect(() => {
    if (machine.pouring) setView('home')
  }, [machine.pouring])

  if (!MOCK && !machine.snapshot && !graceOver) return null

  if (machine.pouring) return <LiveShot machine={machine} />

  if (asleep) return <Sleep onWake={() => setView('home')} />

  if (view === 'journal')
    return (
      <Journal
        onBack={() => setView('home')}
        onReplay={(shot) => {
          setView('home')
          machine.replayShot(shot)
        }}
      />
    )

  if (view === 'settings') return <Settings onDone={() => setView('home')} />

  if (view === 'dialin') {
    return (
      <DialIn
        initial={machine.workflow}
        onDone={() => {
          machine.refreshWorkflow()
          setView('home')
        }}
      />
    )
  }

  return (
    <Idle
      machine={machine}
      onJournal={() => setView('journal')}
      onDialIn={() => setView('dialin')}
      onSettings={() => setView('settings')}
    />
  )
}
