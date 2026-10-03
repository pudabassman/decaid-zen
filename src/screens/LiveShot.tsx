import { useRef, useState } from 'react'
import { Button } from '../components/Button'
import { Metric } from '../components/Metric'
import { ShotGraph } from '../components/ShotGraph'
import { Overlay } from '../components/Overlay'
import { MachineStatus, stateLabel } from '../components/MachineStatus'
import { client } from '../api/client'
import type { useMachine } from '../api/useMachine'
import { useAction } from '../lib/useAction'
import { useSwipe } from '../lib/useSwipe'
import { profileStepIndex } from '../lib/validation'

type Machine = ReturnType<typeof useMachine>
const fmt = (n: number | undefined, digits = 1) => n === undefined ? '—' : n.toFixed(digits)
export function LiveShot({ machine }: { machine: Machine }) {
  const [drawer, setDrawer] = useState(false)
  const screen = useRef<HTMLDivElement>(null)
  const { run, message, busy } = useAction()
  const scaleAction = useAction()
  useSwipe(screen, { onLeft: edge => edge && setDrawer(true), onRight: () => setDrawer(false) })
  const { snapshot, scale, workflow, samples, shotOrigin, elapsed, scaleConnected } = machine
  const dose = workflow?.context?.targetDoseWeight ?? 18
  const target = workflow?.context?.targetYield ?? workflow?.profile?.target_weight ?? 36
  const weight = scale?.weight ?? 0
  const steps = workflow?.profile?.steps ?? []
  const frame = profileStepIndex(snapshot?.profileFrame ?? 0, steps.length)
  const mode = snapshot?.state.state
  const steaming = mode === 'steam'
  const espresso = mode === 'espresso'
  const preparing = snapshot?.state.substate === 'preparingForShot'
  const labels = steaming ? [
    { key: 'steam' as const, value: `${fmt(snapshot?.steamTemperature)}°`, caption: 'STEAM' },
    { key: 'flow' as const, value: fmt(snapshot?.flow), caption: 'ML/S' },
  ] : [
    { key: 'mix' as const, value: `${fmt(snapshot?.mixTemperature)}°`, caption: espresso ? 'BREW' : 'WATER' },
    ...(espresso ? [{ key: 'pressure' as const, value: fmt(snapshot?.pressure), caption: 'BAR' }] : []),
    ...((espresso || mode === 'hotWater') && scaleConnected ? [{ key: 'weight' as const, value: fmt(weight), caption: 'GRAMS' }] : []),
    { key: 'flow' as const, value: fmt(snapshot?.flow), caption: 'ML/S' },
  ]
  const stop = () => machine.replay ? machine.stopReplay() : run('Stop', () => client.requestState('idle'))
  const stopButton = <Button width={184} height={54} hot disabled={busy} onClick={stop}>{busy ? 'Stopping…' : machine.replay ? 'Stop replay' : 'Stop'}</Button>
  return <div className="screen live-screen" ref={screen}>
    <header className="live-header"><div><MachineStatus machine={machine} /><div className="hint">{espresso ? preparing ? 'Preparing your shot' : `${stateLabel(snapshot?.state.substate)} · ${steps[frame]?.name ?? 'Extraction'}${steps.length ? ` · ${frame + 1} / ${steps.length}` : ''}` : stateLabel(mode)}</div></div>
      <div className="live-clock"><span className="num">{elapsed.toFixed(1)}</span><span className="eyebrow">Seconds</span></div>
    </header>
    <ShotGraph samples={samples} origin={shotOrigin} live={!machine.stale && machine.connection === 'open'} window={elapsed} steps={espresso ? steps.map(s => s.seconds ?? 0) : []} targetYield={espresso && scaleConnected ? target : 0} labels={labels} />
    <div className="live-metrics">
      {espresso ? <><Metric label="Ratio" value={scaleConnected ? `1:${(weight / (dose || 1)).toFixed(2)}` : '—'} color="var(--weight)" /><Metric label="In the cup" value={scaleConnected ? `${fmt(weight)} g` : 'No scale'} /><Metric label="Target" value={`${fmt(target)} g`} /><Metric label="Dose" value={`${fmt(dose)} g`} /></> : <><Metric label={steaming ? 'Steam temperature' : 'Water temperature'} value={`${fmt(steaming ? snapshot?.steamTemperature : snapshot?.mixTemperature)}°`} color="var(--temp)" /><Metric label="Flow" value={`${fmt(snapshot?.flow)} ml/s`} /></>}
    </div>
    <footer className="page-footer live-footer"><div><div className="hint">{espresso ? workflow?.context?.coffeeName || 'No coffee selected' : steaming ? 'Steam wand' : mode === 'flush' ? 'Group rinse' : 'Hot water'}</div><div className="eyebrow">{espresso ? [workflow?.profile?.title, workflow?.context?.grinderModel, workflow?.context?.grinderSetting].filter(Boolean).join(' · ') : ''}</div><div className="error-text" role="alert">{message}</div></div><div className="row"><Button quiet width={124} height={54} onClick={() => setDrawer(true)}>Details</Button>{stopButton}</div></footer>
    {drawer && <Overlay title="Machine details" onClose={() => setDrawer(false)} footer={<div className="row between"><span className="error-text" role="alert">{message}</span>{stopButton}</div>}>
      <DetailRow label={steaming ? 'Steam' : 'Brew temperature'} color="var(--temp)" value={fmt(steaming ? snapshot?.steamTemperature : snapshot?.mixTemperature)} unit={steaming ? '°C' : `target ${fmt(snapshot?.targetMixTemperature)} °C`} />
      {espresso && <DetailRow label="Pressure" color="var(--bar)" value={fmt(snapshot?.pressure)} unit={`target ${fmt(snapshot?.targetPressure)} bar`} />}
      {scaleConnected && !steaming && <DetailRow label="Weight" color="var(--weight)" value={fmt(weight)} unit={espresso ? `target ${fmt(target)} g` : 'g'} />}
      <DetailRow label="Flow" color="var(--flow)" value={fmt(snapshot?.flow)} unit={`target ${fmt(snapshot?.targetFlow)} ml/s`} />
      <DetailRow label="Group" value={fmt(snapshot?.groupTemperature)} unit={`target ${fmt(snapshot?.targetGroupTemperature)} °C`} />
      {!steaming && <DetailRow label="Steam temperature" value={fmt(snapshot?.steamTemperature)} unit="°C" />}
      {!scaleConnected && !machine.replay && <div className="panel-row"><span className="hint">No scale connected</span><Button quiet disabled={scaleAction.busy} onClick={() => scaleAction.run('Find scale', () => client.findDevices())}>{scaleAction.busy ? 'Searching…' : 'Find scale'}</Button></div>}
      {scaleAction.message && <p className="error-text" role="alert">{scaleAction.message}</p>}
      {espresso && <><h3 className="section-title">{workflow?.profile?.title}</h3><ol className="phase-list">{steps.map((step, i) => <li key={i} className={!preparing && i === frame ? 'current' : ''} aria-current={!preparing && i === frame ? 'step' : undefined}><span className="phase-number">{i + 1}</span><span>{step.name}</span><span className="hint">{step.pump === 'flow' ? `${fmt(step.flow)} ml/s` : `${fmt(step.pressure)} bar`}{step.seconds !== undefined ? ` · ${step.seconds} s` : ''}</span></li>)}</ol></>}
    </Overlay>}
  </div>
}
function DetailRow({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  return <div className="panel-row"><span className="hint" style={{ color }}>{label}</span><div className="row baseline"><span className="num" style={{ fontSize: 30 }}>{value}</span><span className="hint">{unit}</span></div></div>
}
