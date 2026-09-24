import { useRef, useState } from 'react'
import { Button } from '../components/Button'
import { Metric } from '../components/Metric'
import { ShotGraph } from '../components/ShotGraph'
import { client } from '../api/client'
import type { useMachine } from '../api/useMachine'
import { useAction } from '../lib/useAction'
import { useSwipe } from '../lib/useSwipe'

type Machine = ReturnType<typeof useMachine>

const fmt = (n: number | undefined, digits = 1) => (n === undefined ? '--' : n.toFixed(digits))

export function LiveShot({ machine }: { machine: Machine }) {
  const [drawer, setDrawer] = useState(false)
  const screen = useRef<HTMLDivElement>(null)
  const { run, message, busy } = useAction()

  useSwipe(screen, {
    onLeft: (fromRightEdge) => fromRightEdge && setDrawer(true),
    onRight: () => setDrawer(false),
  })
  const { snapshot, scale, workflow, samples, shotOrigin, elapsed, scaleConnected } = machine

  const dose = workflow?.context?.targetDoseWeight ?? 18
  const target = workflow?.context?.targetYield ?? workflow?.profile?.target_weight ?? 36
  const weight = scale?.weight ?? 0
  const steps = workflow?.profile?.steps ?? []
  const frameIndex = snapshot?.profileFrame ?? 0

  const steaming = snapshot?.state.state === 'steam'
  // the frame number still reads from the last shot until the first step begins
  const preparing = snapshot?.state.substate === 'preparingForShot'

  const labels = steaming
    ? [
        { key: 'steam' as const, value: `${fmt(snapshot?.steamTemperature)}°`, caption: 'STEAM' },
        { key: 'flow' as const, value: fmt(snapshot?.flow), caption: 'ML/S' },
      ]
    : [
    { key: 'mix' as const, value: `${fmt(snapshot?.mixTemperature)}°`, caption: 'BREW' },
    { key: 'pressure' as const, value: fmt(snapshot?.pressure), caption: 'BAR' },
    ...(scaleConnected ? [{ key: 'weight' as const, value: fmt(weight), caption: 'GRAMS' }] : []),
    { key: 'flow' as const, value: fmt(snapshot?.flow), caption: 'ML/S' },
      ]

  return (
    <div className="screen" ref={screen}>
      <div className={drawer ? 'shifted' : undefined} style={{ display: 'contents' }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <div className="row" style={{ gap: 16 }}>
            <span className="statusdot live" />
            <span className="cap strong">
              {/* the machine reports steaming as a pour, which reads wrong on the steam screen */}
              {steaming ? 'steaming' : snapshot?.state.substate || snapshot?.state.state || 'idle'}
            </span>
            {!steaming && !preparing && (
              <span className="cap">
                Frame {frameIndex + 1} of {steps.length || '—'}
                {steps[frameIndex]?.name ? ` · ${steps[frameIndex].name}` : ''}
              </span>
            )}
          </div>
          <div className="row baseline" style={{ gap: 10 }}>
            <span className="num" style={{ fontSize: 34 }}>{elapsed.toFixed(1)}</span>
            <span className="cap">seconds</span>
          </div>
        </div>

        <ShotGraph
          samples={samples}
          origin={shotOrigin}
          live
          window={elapsed}
          steps={steaming ? [] : steps.map((profileStep) => profileStep.seconds ?? 0)}
          targetYield={steaming || !scaleConnected ? 0 : target}
          labels={labels}
        />

        <div className="row" style={{ gap: 46, marginTop: 32 }}>
          {steaming ? (
            <Metric label="Steam" value={`${fmt(snapshot?.steamTemperature)} °`} color="var(--temp)" />
          ) : scaleConnected ? (
            <>
              <Metric label="Ratio" value={`1:${(weight / (dose || 1)).toFixed(2)}`} color="var(--weight)" />
              <Metric label="Weight" value={`${fmt(weight)} g`} />
            </>
          ) : (
            <button
              className="findscale"
              disabled={busy}
              onClick={() => run('Looking for the scale', () => client.findDevices())}
            >
              <Metric label="Scale" value="not connected" size={28} />
            </button>
          )}
          {!steaming && <Metric label="Dose" value={`${fmt(dose)} g`} />}
        </div>

        <div className="rule" style={{ margin: '12px 0' }} />

        <div className="row between">
          <span className="cap" style={{ color: message ? 'var(--temp)' : undefined }}>
            {message ?? ''}
            {message ? '' : workflow?.context?.coffeeName ?? 'No bean selected'}
            {workflow?.profile?.title ? ` · ${workflow.profile.title}` : ''}
            {workflow?.context?.grinderModel ? ` · ${workflow.context.grinderModel} ${workflow.context.grinderSetting ?? ''}` : ''}
          </span>
          <Button
            width={196}
            height={52}
            hot
            disabled={busy}
            onClick={() =>
              // a replay has no machine behind it, so stopping is purely local
              machine.replay ? machine.stopReplay() : run('Stop', () => client.requestState('idle'))
            }
          >
            <span className="display" style={{ fontSize: 24, letterSpacing: '0.03em' }}>Stop</span>
          </Button>
        </div>
      </div>

      <button className="grip right" onClick={() => setDrawer(true)} aria-label="Machine detail">
        <span />
      </button>

      {drawer && (
        <>
        <div className="drawerveil" onPointerDown={() => setDrawer(false)} />
        <aside className="drawer">
          <button className="grip" style={{ left: -24 }} onClick={() => setDrawer(false)} aria-label="Close">
            <span />
          </button>
          <div className="row between" style={{ paddingBottom: 24 }}>
            <span className="cap strong">Machine detail</span>
          </div>
          <DetailRow label="Brew temp" color="var(--temp)" value={fmt(snapshot?.mixTemperature)} unit={`of ${fmt(snapshot?.targetMixTemperature)} °C`} />
          <DetailRow label="Pressure" color="var(--bar)" value={fmt(snapshot?.pressure)} unit={`of ${fmt(snapshot?.targetPressure)} bar`} />
          <DetailRow label="Weight" color="var(--weight)" value={fmt(weight)} unit={`of ${fmt(target)} g`} />
          <DetailRow label="Flow" color="var(--flow)" value={fmt(snapshot?.flow)} unit={`of ${fmt(snapshot?.targetFlow)} ml/s`} />
          <DetailRow label="Group" value={fmt(snapshot?.groupTemperature)} unit={`of ${fmt(snapshot?.targetGroupTemperature)} °C`} />
          <DetailRow label="Steam" value={fmt(snapshot?.steamTemperature)} unit="°C" />

          <div className="cap" style={{ margin: '30px 0 14px' }}>
            Profile · {workflow?.profile?.title ?? 'none'}
          </div>
          {steps.map((step, i) => {
            const live = i + 1 === frameIndex
            return (
              <div
                key={`${step.name}-${i}`}
                className="row between baseline"
                style={{
                  padding: '13px 0',
                  borderTop: `1px solid ${live ? 'var(--ink)' : 'var(--rule-soft)'}`,
                }}
              >
                <span className="display" style={{ fontSize: 22, color: live ? 'var(--ink)' : 'var(--muted)' }}>
                  {i + 1}&nbsp;&nbsp;{step.name}
                </span>
                <span className="cap" style={{ color: live ? 'var(--ink)' : undefined }}>
                  {step.pump === 'flow'
                    ? `${(step.flow ?? 0).toFixed(1)} ml/s`
                    : `${(step.pressure ?? 0).toFixed(1)} bar`}
                  {step.seconds !== undefined ? ` · ${step.seconds} s` : ''}
                </span>
              </div>
            )
          })}
        </aside>
        </>
      )}
    </div>
  )
}

function DetailRow({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  return (
    <div className="panel-row">
      <span className="cap" style={{ color }}>{label}</span>
      <div className="row baseline" style={{ gap: 8 }}>
        <span className="num" style={{ fontSize: 30 }}>{value}</span>
        <span className="cap">{unit}</span>
      </div>
    </div>
  )
}
