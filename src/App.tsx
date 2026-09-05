import { useEffect, useState } from 'react'
import { useMachine } from './api/useMachine'
import { Idle } from './screens/Idle'
import { LiveShot } from './screens/LiveShot'
import { Journal } from './screens/Journal'
import { DialIn } from './screens/DialIn'
import { Settings } from './screens/Settings'

type View = 'home' | 'journal' | 'dialin' | 'settings'

export function App() {
  const machine = useMachine()
  const [view, setView] = useState<View>('home')

  useEffect(() => {
    if (machine.pouring) setView('home')
  }, [machine.pouring])

  if (machine.pouring) return <LiveShot machine={machine} />

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
