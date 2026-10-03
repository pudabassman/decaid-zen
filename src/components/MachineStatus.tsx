import type { useMachine } from '../api/useMachine'
export function stateLabel(state: string | undefined) {
  const labels: Record<string, string> = { idle: 'Ready', ready: 'Ready', heating: 'Heating', preheating: 'Warming up', booting: 'Starting up', sleeping: 'Asleep', preparingForShot: 'Preparing', pouring: 'Pouring', preinfusion: 'Preinfusion', pouringDone: 'Complete', espresso: 'Espresso', steam: 'Steaming', hotWater: 'Hot water', flush: 'Rinsing', steamRinse: 'Rinsing steam wand' }
  return labels[state ?? ''] ?? (state ?? 'Connecting').replace(/([a-z])([A-Z])/g, '$1 $2')
}
export function MachineStatus({ machine }: { machine: ReturnType<typeof useMachine> }) {
  const offline = machine.connection !== 'open' || machine.stale
  const label = machine.replay ? 'Replay' : offline ? machine.snapshot ? 'Reconnecting · readings paused' : 'Connecting to machine' : stateLabel(machine.snapshot?.state.state)
  return <div className={`machine-status ${offline ? 'offline' : ''}`} role="status"><span className="statusdot" /><span>{label}</span></div>
}
