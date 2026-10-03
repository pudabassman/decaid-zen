import { useCallback, useEffect, useRef, useState } from 'react'
import { Overlay } from '../components/Overlay'
import { MachineStatus } from '../components/MachineStatus'
import { Button } from '../components/Button'
import { EditableValue } from '../components/EditableValue'
import { useRoasterCatalog } from '../lib/useRoasterCatalog'
import { CoffeeMenuButton } from '../components/CoffeeMenuButton'
import { RoasterSite } from '../components/RoasterSite'
import { Dots } from '../components/Dots'
import { GearIcon } from '../components/icons'
import { client } from '../api/client'
import type { useMachine } from '../api/useMachine'
import type { ShotRecord } from '../api/types'
import { LastShotGraph } from '../components/LastShotGraph'
import { shotStats } from '../lib/shotStats'
import { useAction } from '../lib/useAction'
import { useSwipe } from '../lib/useSwipe'
import { MOCK } from '../lib/mock'
import { useWaterBudget } from '../lib/waterBudget'
import { settingsApi } from '../api/settings'
import {
  activeProfileId,
  grindKey,
  preferredRecords,
  profileYield,
  profiles as profileApi,
  rememberedGrind,
  type ProfileRecord,
} from '../api/profiles'
import { ProfileDeck } from '../components/ProfileDeck'
import { ShotSpread } from '../components/ShotSpread'
import { useShotSpread } from '../lib/useShotSpread'
import { useDemoMode } from '../lib/demoMode'
import { reloadThenReplay } from '../lib/demoReplay'

type Machine = ReturnType<typeof useMachine>

const fmt = (n: number | undefined, digits = 1) => (n === undefined ? '--' : n.toFixed(digits))

export function Idle({
  machine,
  onJournal,
  onDialIn,
  onSettings,
}: {
  machine: Machine
  onJournal: () => void
  onDialIn: () => void
  onSettings: () => void
}) {
  const { snapshot, scale, workflow, water } = machine
  const [lastLoading, setLastLoading] = useState(true)
  const [lastError, setLastError] = useState(false)
  const [scaleOverride, setScaleOverride] = useState(false)
  const [loadKey, setLoadKey] = useState(0)
  const [last, setLast] = useState<ShotRecord | null>(null)
  const [records, setRecords] = useState<ProfileRecord[]>([])
  const [grinds, setGrinds] = useState<Record<string, string>>({})
  const [preferred, setPreferred] = useState<string[] | null>(null)
  const [exiting, setExiting] = useState(false)
  const [seeking, setSeeking] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const exitLabel = useRef<number | undefined>(undefined)
  const screen = useRef<HTMLDivElement>(null)
  const { run, message, busy, status } = useAction()

  useSwipe(screen, {
    onLeft: (fromRightEdge) => fromRightEdge && onJournal(),
    onRight: (fromLeftEdge) => fromLeftEdge && onDialIn(),
  })

  useEffect(() => {
    profileApi.list().then(setRecords).catch(() => setRecords([]))
    profileApi.grindMemory().then((map) => setGrinds(map ?? {})).catch(() => undefined)
    profileApi.preferred().then(setPreferred).catch(() => undefined)
    settingsApi.app().then((app) => setBlocking(app.blockOnNoScale)).catch(() => undefined)
  }, [])

  useEffect(() => {
    setLastLoading(true)
    setLastError(false)
    client
      .latestShot()
      .then((summary) => (summary?.id ? client.shot(summary.id) : null))
      .then(setLast)
      .catch(() => setLastError(true))
      .finally(() => setLastLoading(false))
  }, [loadKey])

  useEffect(() => {
    if (machine.scaleConnected) setSeeking(false)
  }, [machine.scaleConnected])

  const markSeeking = useCallback(() => {
    setSeeking(true)
    window.setTimeout(() => setSeeking(false), 25_000)
  }, [])

  const budget = useWaterBudget(water, snapshot?.state.state, snapshot?.flow)
  const tankPercent = water ? Math.round((water.currentLevel / budget.maxLevel) * 100) : null
  const tankLabel = budget.mlLeft === null ? '' : `tank ${budget.mlLeft} ml`
  // the tank speaks up only when the next drink would not fit whole
  const waterNote =
    budget.nextDrink === 'shot'
      ? 'Water: espresso only, not a milk drink'
      : budget.nextDrink === 'none'
        ? 'Water: top up before the next shot'
        : ''

  const stats = shotStats(last)
  const asleep = snapshot?.state.state === 'sleeping' || snapshot?.state.state === 'booting'


  const ctx = workflow?.context
  const roaster = ctx?.coffeeRoaster ?? ''
  const activeId = activeProfileId(records, workflow)
  const beanLength = (ctx?.coffeeName ?? '').length
  const beanClass = beanLength > 46 ? 'long' : beanLength > 28 ? 'mid' : ''
  const listing = useRoasterCatalog(roaster)
  const reading = useShotSpread(ctx?.coffeeName, workflow?.profile?.title)
  const demo = useDemoMode()
  const dose = ctx?.targetDoseWeight ?? 18
  const target = ctx?.targetYield ?? workflow?.profile?.target_weight ?? 36

  const patchWorkflow = (next: Partial<NonNullable<typeof ctx>>) =>
    run('Save workflow', async () => {
      if (!workflow) return
      await client.saveWorkflow({ ...workflow, context: { ...workflow.context, ...next } })
      machine.refreshWorkflow()
    })

  const pickProfile = (record: ProfileRecord) =>
    run('Switch profile', async () => {
      if (!workflow) return
      const remembered = rememberedGrind(grinds, record.id, ctx?.coffeeName)
      await client.saveWorkflow({
        ...workflow,
        profile: record.profile,
        context: {
          ...workflow.context,
          profileId: record.id,
          grinderSetting: remembered ?? '',
          ...profileYield(record.profile),
        },
      })
      machine.refreshWorkflow()
    })

  const rememberGrind = async (value: string) => {
    if (!activeId) return
    const next = { ...grinds, [grindKey(activeId, ctx?.coffeeName)]: value }
    await profileApi.saveGrindMemory(next)
    setGrinds(next)
  }

  /** a new coffee brings its own grind for the profile in play */
  const pickCoffee = (coffeeName: string) => {
    patchWorkflow({
      coffeeName,
      grinderSetting: rememberedGrind(grinds, activeId, coffeeName) ?? '',
    })
  }

  const deckGrinds = Object.fromEntries(
    records.map((record) => [record.id, rememberedGrind(grinds, record.id, ctx?.coffeeName) ?? '']),
  )

  const number = (raw: string, fallback: number) => {
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const waterFill = Math.max(0, Math.min(100, tankPercent ?? 0))

  return (
    <div className="screen home-screen" ref={screen}>
      <div inert={busy} className="row between home-header" style={{ alignItems: 'flex-start', gap: 'clamp(16px, 2.6vw, 40px)' }}>
        <div className="headercol" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 14, marginBottom: 'clamp(6px, 1.4vh, 18px)' }}>
          <span className="cap strong">
            <EditableValue
              className="cap strong"
              label="Roaster"
              value={ctx?.coffeeRoaster ?? ''}
              placeholder={workflow ? 'Add a roaster' : 'Connecting…'}
              width={260}
              onCommit={(next) => patchWorkflow({ coffeeRoaster: next })}
            />
          </span>
          {listing.status === 'available' && (
            <CoffeeMenuButton roaster={roaster} count={listing.count} onPick={pickCoffee} />
          )}
            {listing.status === 'checking' && (
              <span className="cap">
                searching
                <Dots />
              </span>
            )}
            {listing.status === 'none' && roaster.length > 2 && (
              <RoasterSite roaster={roaster} onResolved={listing.recheck} />
            )}
          </div>

          <div style={{ minWidth: 0 }}>
          <div
            className={`display beanname ${beanClass}`}
            style={{ lineHeight: 0.98, letterSpacing: '-0.02em' }}
          >
            <EditableValue
              className="clamp2 bare"
              label="Bean"
              value={ctx?.coffeeName ?? ''}
              placeholder={workflow ? 'Choose your coffee' : 'Loading your recipe…'}
              width={620}
              onCommit={pickCoffee}
            />
          </div>
          </div>
          <div
            className="row baseline recipe-readings"
            style={{ gap: 'clamp(16px, 2.6vw, 40px)', marginTop: 'clamp(6px, 1.4vh, 16px)' }}
          >
          <EditableReading
            label="Dose"
            value={fmt(dose)}
            suffix="g"
            numeric
            onCommit={(next) => patchWorkflow({ targetDoseWeight: number(next, dose) })}
          />
          <EditableReading
            label="Yield"
            value={fmt(target)}
            suffix="g"
            numeric
            onCommit={(next) => patchWorkflow({ targetYield: number(next, target) })}
          />
          <Reading label="Ratio" value={`1:${(target / (dose || 1)).toFixed(1)}`} size="var(--type-value)" color="var(--weight)" />
          <EditableReading
            label="Grind"
            value={ctx?.grinderSetting ?? ''}
            placeholder="--"
            numeric
              onCommit={(next) => {
                run('Save grind', async () => {
                  if (!workflow) return
                  await client.saveWorkflow({ ...workflow, context: { ...workflow.context, grinderSetting: next } })
                  try { await rememberGrind(next) } finally { machine.refreshWorkflow() }
                })
              }}
            />
          </div>
        </div>

        <div className="headerright">
          <div className="row machine-overview">
          <div className="machine-readings" style={{ opacity: asleep ? 0.45 : 1 }}>
            <Reading inline label="Group" value={`${fmt(snapshot?.groupTemperature)}°`} />
            <Reading inline label="Steam" value={`${fmt(snapshot?.steamTemperature)}°`} />
            {machine.scaleConnected ? (
              <Reading inline label="Scale" value={`${fmt(scale?.weight ?? 0)} g`} />
            ) : (
              <button
                className="findscale"
                disabled={seeking}
                onClick={() => {
                  markSeeking()
                  run('Looking for the scale', () => client.findDevices())
                }}
              >
                <Reading inline label="Scale" value={seeking ? 'looking' : 'none'} color="var(--muted)" />
              </button>
            )}
          </div>
            <MachineStatus machine={machine} />
          </div>
          {reading && <ShotSpread reading={reading} />}
          <ProfileDeck
            records={preferredRecords(records, preferred)}
            activeId={activeId}
            grinds={deckGrinds}
            onPick={pickProfile}
          />
        </div>
      </div>

      {blocking && !machine.scaleConnected && (
        <div className="noscale row" style={{ gap: 18 }}>
          <span className="cap" style={{ color: 'var(--temp)' }}>
            Connect a scale before your next shot
          </span>
          <Button
            width={150}
            height={40}
            quiet
            disabled={seeking}
            onClick={() => {
              markSeeking()
              run('Looking for the scale', () => client.findDevices())
            }}
          >
            <span className="cap">{seeking ? 'looking' : 'reconnect'}</span>
          </Button>
          <Button
            width={150}
            height={40}
            quiet
            onClick={() => setScaleOverride(true)}
          >
            <span className="cap">Allow no scale</span>
          </Button>
        </div>
      )}

      <div
        style={{
          position: 'relative',
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
      <div
        className={`waterrail${
          budget.lastDrink ||
          budget.nextDrink === 'shot' ||
          budget.nextDrink === 'none' ||
          (MOCK && window.location.search.includes('low'))
            ? ' low'
            : ''
        }`}
        aria-label={
          budget.lastDrink
            ? 'Water low: one shot and steam left'
            : `Water ${Math.round(waterFill)}%`
        }
      >
        <span style={{ height: `${waterFill}%` }} />
      </div>



      <div className="row between" style={{ height: 0, alignItems: 'center' }}>
        {waterNote && (
          <span className="cap waternote" style={{ color: 'var(--water-low)' }}>
            {waterNote}
          </span>
        )}
        <span className="cap strong lastshotlabel">
          Last shot
          {last ? ` · ${new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          {stats ? ` · ${stats.seconds.toFixed(1)} s` : ''}
        </span>
        {stats && (
          <div className="row lastshotstats" style={{ gap: 'clamp(12px, 2vw, 30px)', alignItems: 'center' }}>
            <Swatch color="var(--temp)" value={`${stats.endBrewTemp.toFixed(1)}°`} label="brew" />
            <Swatch color="var(--bar)" value={stats.endPressure.toFixed(1)} label="bar" />
            <Swatch color="var(--weight)" value={stats.yieldValue.toFixed(1)} label={stats.yieldUnit === 'g' ? 'grams' : 'ml volume'} />
            <Swatch color="var(--flow)" value={stats.endFlow.toFixed(1)} label="ml/s" />
          </div>
        )}
      </div>

      <LastShotGraph shot={last} loading={lastLoading} error={lastError} onRetry={() => setLoadKey(v => v + 1)} />
      </div>

      <div style={{ height: 'clamp(4px, 1vh, 18px)' }} />

      <div className="page-footer home-footer">
        <nav className="row" aria-label="Main navigation" style={{ gap: 14 }}>
          <Button width={150} height={52} onClick={onJournal}>
            <span className="display" style={{ fontSize: 22 }}>Journal</span>
          </Button>
          <Button width={150} height={52} onClick={onDialIn}>
            <span className="display" style={{ fontSize: 22 }}>Dial in</span>
          </Button>
          {machine.scaleConnected && (
            <Button width={130} height={52} quiet disabled={busy} onClick={() => run('Tare', client.tare)}>
              <span className="cap">Tare</span>
            </Button>
          )}
          {demo.on && (
            <Button
              width={150}
              height={52}
              quiet
              disabled={busy}
              onClick={() => reloadThenReplay()}
            >
              <span className="cap">Replay last</span>
            </Button>
          )}
          <button className="gear" aria-label="Settings" onClick={onSettings}>
            <GearIcon size={17} />
          </button>
        </nav>
        <div className="row home-sleep" style={{ gap: 16 }}>
          <span className="cap" style={{ color: message ? 'var(--temp)' : undefined, marginRight: 6 }}>
            {message ?? (busy ? status : tankLabel)}
          </span>
          <Button
            width={196}
            height={52}
            quiet
            disabled={busy}
            holdMs={1000}
            tapWindowMs={500}
            onHoldChange={(holding) => {
              window.clearTimeout(exitLabel.current)
              if (!holding) {
                setExiting(false)
                return
              }
              exitLabel.current = window.setTimeout(() => setExiting(true), 500)
            }}
            onHold={() =>
              run('Sleep and leave', async () => {
                await client.requestState('sleeping')
                window.decentApp?.exitToDashboard?.()
              })
            }
            onClick={() =>
              asleep
                ? run('Wake', () => client.requestState('idle'))
                : run('Sleep', () => client.requestState('sleeping'))
            }
          >
            <span className="display" title="Tap to sleep · hold to leave the app" style={{ fontSize: 24, letterSpacing: '0.03em' }}>
              {asleep ? 'Wake' : exiting ? 'Exit' : 'Sleep'}
            </span>
          </Button>
        </div>
      </div>

      {scaleOverride && <Overlay title="Allow shots without a scale?" onClose={() => setScaleOverride(false)} footer={<div className="row"><Button quiet onClick={() => setScaleOverride(false)}>Keep scale required</Button><Button disabled={busy} onClick={() => run('Allow shots without a scale', async () => { await settingsApi.saveApp({ blockOnNoScale: false }); setBlocking(false); setScaleOverride(false) })}>Allow without scale</Button></div>}><p>This changes your machine settings for future shots, until you turn the scale requirement back on in Settings → Machine &amp; devices.</p><p>It does not start a shot.</p><p className="error-text" role="alert">{message}</p></Overlay>}

    </div>
  )
}

function Swatch({ color, value, label }: { color: string; value: string; label: string }) {
  return (
    <div className="row" style={{ gap: 7, color, alignItems: 'center' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flex: '0 0 auto' }} />
      <span className="num" style={{ fontSize: 'var(--type-swatch)', lineHeight: 1 }}>{value}</span>
      <span className="cap" style={{ color, lineHeight: 1 }}>{label}</span>
    </div>
  )
}

function EditableReading({
  label, value, suffix, numeric, placeholder, onCommit,
}: {
  label: string
  value: string
  suffix?: string
  numeric?: boolean
  placeholder?: string
  onCommit: (next: string) => void
}) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div className="cap" style={{ marginBottom: 5, lineHeight: 1 }}>{label}</div>
      <EditableValue
        className="num bare"
        style={{ fontSize: 'var(--type-value)', lineHeight: 1, display: 'inline-block' }}
        label={label}
        value={value}
        placeholder={placeholder}
        suffix={suffix}
        numeric={numeric}
        min={label === 'Grind' ? 0 : 1}
        width={110}
        onCommit={onCommit}
      />
    </div>
  )
}

function Reading({
  label,
  value,
  size,
  color,
  inline,
}: {
  label: string
  value: string
  size?: string
  color?: string
  inline?: boolean
}) {
  if (inline) {
    return (
      <span className="row" style={{ gap: 7, alignItems: 'baseline' }}>
        <span className="cap" style={{ lineHeight: 1 }}>{label}</span>
        <span className="num" style={{ fontSize: 14, color: color ?? 'var(--ink)', lineHeight: 1 }}>
          {value}
        </span>
      </span>
    )
  }

  return (
    <div style={{ textAlign: 'right' }}>
      <div className="cap" style={{ marginBottom: 4, lineHeight: 1 }}>{label}</div>
      <span className="num" style={{ fontSize: size ?? 'var(--type-reading)', color, lineHeight: 1, display: 'inline-block' }}>
        {value}
      </span>
    </div>
  )
}
