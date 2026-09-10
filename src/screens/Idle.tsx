import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button'
import { EditableValue } from '../components/EditableValue'
import { useRoasterCatalog } from '../lib/useRoasterCatalog'
import { CoffeePicker } from '../components/CoffeePicker'
import { RoasterSite } from '../components/RoasterSite'
import { Dots } from '../components/Dots'
import { BeanIcon, GearIcon } from '../components/icons'
import { client } from '../api/client'
import type { useMachine } from '../api/useMachine'
import type { ShotRecord } from '../api/types'
import { LastShotGraph } from '../components/LastShotGraph'
import { shotStats } from '../lib/shotStats'
import { useAction } from '../lib/useAction'
import { useSwipe } from '../lib/useSwipe'
import { MOCK } from '../lib/mock'
import { useWaterBudget } from '../lib/waterBudget'
import {
  grindKey,
  matchRecord,
  preferredRecords,
  profiles as profileApi,
  rememberedGrind,
  type ProfileRecord,
} from '../api/profiles'
import { ProfileDeck } from '../components/ProfileDeck'
import { ShotSpread } from '../components/ShotSpread'
import { useShotSpread } from '../lib/useShotSpread'

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
  const [last, setLast] = useState<ShotRecord | null>(null)
  const [picking, setPicking] = useState(false)
  const [records, setRecords] = useState<ProfileRecord[]>([])
  const [grinds, setGrinds] = useState<Record<string, string>>({})
  const [preferred, setPreferred] = useState<string[] | null>(null)
  const [exiting, setExiting] = useState(false)
  const [seeking, setSeeking] = useState(false)
  const exitLabel = useRef<number | undefined>(undefined)
  const loaded = useRef(false)
  const screen = useRef<HTMLDivElement>(null)
  const { run, message, busy } = useAction()

  useSwipe(screen, {
    onLeft: (fromRightEdge) => fromRightEdge && onJournal(),
    onRight: (fromLeftEdge) => fromLeftEdge && onDialIn(),
  })

  useEffect(() => {
    profileApi.list().then(setRecords).catch(() => setRecords([]))
    profileApi.grindMemory().then((map) => setGrinds(map ?? {})).catch(() => undefined)
    profileApi.preferred().then(setPreferred).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    client
      .latestShot()
      .then((summary) => (summary?.id ? client.shot(summary.id) : null))
      .then(setLast)
      .catch(() => setLast(null))
  }, [])

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

  const stats = shotStats(last)
  const asleep = snapshot?.state.state === 'sleeping' || snapshot?.state.state === 'booting'


  const ctx = workflow?.context
  const roaster = ctx?.coffeeRoaster ?? ''
  const activeId = matchRecord(records, workflow?.profile)?.id ?? null
  const beanLength = (ctx?.coffeeName ?? '').length
  const beanClass = beanLength > 46 ? 'long' : beanLength > 28 ? 'mid' : ''
  const listing = useRoasterCatalog(roaster)
  const reading = useShotSpread(ctx?.coffeeName, workflow?.profile?.title)
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
        context: { ...workflow.context, grinderSetting: remembered ?? '' },
      })
      machine.refreshWorkflow()
    })

  const rememberGrind = (value: string) => {
    if (!activeId) return
    const next = { ...grinds, [grindKey(activeId, ctx?.coffeeName)]: value }
    setGrinds(next)
    profileApi.saveGrindMemory(next).catch(() => undefined)
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
    <div className="screen" ref={screen}>

      <div className="row between" style={{ alignItems: 'flex-start', gap: 'clamp(16px, 2.6vw, 40px)' }}>
        <div className="headercol" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 14, marginBottom: 'clamp(6px, 1.4vh, 18px)' }}>
          <span className="cap">
            <EditableValue
              className="cap"
              label="Roaster"
              value={ctx?.coffeeRoaster ?? ''}
              placeholder="No roaster"
              width={260}
              onCommit={(next) => patchWorkflow({ coffeeRoaster: next })}
            />
          </span>
          {listing.status === 'available' && (
            <button
              className="beanpill"
              aria-label={`${listing.count} coffees from ${roaster}`}
              onClick={() => setPicking(true)}
            >
              <BeanIcon size={13} />
              <span className="num">{listing.count}</span>
            </button>
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
              placeholder="No bean loaded"
              width={620}
              onCommit={pickCoffee}
            />
          </div>
          </div>
          <div
            className="row baseline"
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
                rememberGrind(next)
                patchWorkflow({ grinderSetting: next })
              }}
            />
          </div>
        </div>

        <div className="headerright">
          <div className="row baseline" style={{ gap: 'clamp(14px, 2.2vw, 34px)', opacity: asleep ? 0.45 : 1 }}>
            <Reading label="Group" value={`${fmt(snapshot?.groupTemperature)}°`} />
            <Reading label="Steam" value={`${fmt(snapshot?.steamTemperature)}°`} />
            {machine.scaleConnected ? (
              <Reading label="Scale" value={`${fmt(scale?.weight ?? 0)} g`} />
            ) : (
              <button
                className="findscale"
                disabled={seeking}
                onClick={() => {
                  markSeeking()
                  run('Looking for the scale', () => client.findDevices())
                }}
              >
                <Reading label="Scale" value={seeking ? 'looking' : 'none'} color="var(--muted)" />
              </button>
            )}
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
        className={`waterrail${budget.lastDrink || (MOCK && window.location.search.includes('low')) ? ' low' : ''}`}
        aria-label={
          budget.lastDrink
            ? 'Water low: one shot and steam left'
            : `Water ${Math.round(waterFill)}%`
        }
      >
        <span style={{ height: `${waterFill}%` }} />
      </div>



      <div className="row between" style={{ height: 0, alignItems: 'center' }}>
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

      <LastShotGraph shot={last} />
      </div>

      <div style={{ height: 'clamp(4px, 1vh, 18px)' }} />

      <div className="row between">
        <div className="row" style={{ gap: 14 }}>
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
          <button className="gear" aria-label="Settings" onClick={onSettings}>
            <GearIcon size={17} />
          </button>
        </div>
        <div className="row" style={{ gap: 16 }}>
          <span className="cap" style={{ color: message ? 'var(--temp)' : undefined, marginRight: 6 }}>
            {message ?? tankLabel}
          </span>
          <Button
            width={196}
            height={52}
            hot
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
            <span className="display" style={{ fontSize: 24, letterSpacing: '0.03em' }}>
              {asleep ? 'Wake' : exiting ? 'Exit' : 'Sleep'}
            </span>
          </Button>
        </div>
      </div>

      {picking && (
        <CoffeePicker
          roaster={roaster}
          onClose={() => setPicking(false)}
          onPick={(name) => {
            setPicking(false)
            pickCoffee(name)
          }}
        />
      )}
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
        width={110}
        onCommit={onCommit}
      />
    </div>
  )
}

function Reading({ label, value, size, color }: { label: string; value: string; size?: string; color?: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div className="cap" style={{ marginBottom: 4, lineHeight: 1 }}>{label}</div>
      <span className="num" style={{ fontSize: size ?? 'var(--type-reading)', color, lineHeight: 1, display: 'inline-block' }}>
        {value}
      </span>
    </div>
  )
}
