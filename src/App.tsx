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

type View = 'home' | 'journal' | 'dialin' | 'settings'

const opening = (): View =>
  MOCK && window.location.search.includes('settings') ? 'settings' : 'home'

export function App() {
  const machine = useMachine()
  const [view, setView] = useState<View>(opening)

  const state = machine.snapshot?.state.state
  const asleep = state === 'sleeping' || state === 'booting'

  // the scale sleeps with the machine; waking is the moment to go looking for it
  useScaleRevive(asleep, machine.scaleConnected)

  useEffect(() => {
    ensureBundledPlugin().catch(() => undefined)
  }, [])

  useEffect(() => {
    if (machine.pouring) setView('home')
  }, [machine.pouring])

  if (machine.pouring) return <LiveShot machine={machine} />

  if (asleep) return <Sleep onWake={() => setView('home')} />

  if (view === 'journal') return <Journal onBack={() => setView('home')} />

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
