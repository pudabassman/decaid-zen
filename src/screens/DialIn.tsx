import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button'
import { EditableValue } from '../components/EditableValue'
import { BeanIcon } from '../components/icons'
import { useRoasterCatalog } from '../lib/useRoasterCatalog'
import { CoffeePicker } from '../components/CoffeePicker'
import { RoasterSite } from '../components/RoasterSite'
import { Dots } from '../components/Dots'
import { client } from '../api/client'
import type { Grinder, Workflow } from '../api/types'
import {
  matchRecord,
  preferredRecords,
  profiles as profileApi,
  type ProfileRecord,
} from '../api/profiles'
import { ProfileDeck } from '../components/ProfileDeck'
import { useSwipe } from '../lib/useSwipe'
import { useAction } from '../lib/useAction'

const Stepper = ({ onLess, onMore }: { onLess: () => void; onMore: () => void }) => (
  <div className="row" style={{ gap: 12 }}>
    <Button round height={60} onClick={onLess}>
      <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4} fill="none"><path d="M5 12h14" /></svg>
    </Button>
    <Button round height={60} onClick={onMore}>
      <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4} fill="none"><path d="M12 5v14M5 12h14" /></svg>
    </Button>
  </div>
)

export function DialIn({ initial, onDone }: { initial: Workflow | null; onDone: () => void }) {
  const [draft, setDraft] = useState<Workflow | null>(initial)
  const [dirty, setDirty] = useState(false)
  const [picking, setPicking] = useState(false)
  const [grinders, setGrinders] = useState<Grinder[]>([])
  const [records, setRecords] = useState<ProfileRecord[]>([])
  const [preferred, setPreferred] = useState<string[]>([])
  const [grinds, setGrinds] = useState<Record<string, string>>({})
  const { run, message, busy } = useAction()
  const screen = useRef<HTMLDivElement>(null)
  useSwipe(screen, { onLeft: (fromRightEdge) => fromRightEdge && onDone() })

  useEffect(() => setDraft(initial), [initial])

  useEffect(() => {
    client.grinders().then(setGrinders).catch(() => setGrinders([]))
    profileApi.list().then(setRecords).catch(() => setRecords([]))
    profileApi.preferred().then((ids) => setPreferred(ids ?? [])).catch(() => undefined)
    profileApi.grindMemory().then((map) => setGrinds(map ?? {})).catch(() => undefined)
  }, [])

  const pickProfile = (record: ProfileRecord) => {
    const remembered = grinds[record.id]
    setDirty(true)
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            profile: record.profile,
            context: {
              ...prev.context,
              ...(remembered ? { grinderSetting: remembered } : {}),
            },
          }
        : prev,
    )
  }

  const togglePreferred = (id: string) => {
    const next = preferred.includes(id)
      ? preferred.filter((other) => other !== id)
      : [...preferred, id].slice(-5)
    setPreferred(next)
    profileApi.savePreferred(next).catch(() => undefined)
  }

  const chooseGrinder = async (model: string) => {
    const name = model.trim()
    if (!name) return
    const known = grinders.find((g) => g.model.toLowerCase() === name.toLowerCase())
    if (known) {
      patch({ grinderId: known.id, grinderModel: known.model })
      return
    }
    try {
      const created = await client.createGrinder(name)
      setGrinders((prev) => [...prev, created])
      patch({ grinderId: created.id, grinderModel: created.model })
    } catch {
      patch({ grinderModel: name })
    }
  }

  const ctx = draft?.context ?? {}
  const listing = useRoasterCatalog(ctx.coffeeRoaster)
  const dose = ctx.targetDoseWeight ?? 18
  const target = ctx.targetYield ?? 36

  const num = (raw: string, fallback: number) => {
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const patch = (next: Partial<typeof ctx>) => {
    setDirty(true)
    setDraft((prev) => (prev ? { ...prev, context: { ...prev.context, ...next } } : prev))
  }

  const save = () =>
    run('Save workflow', async () => {
      if (!draft) return
      await client.saveWorkflow(draft)
      setDirty(false)
      onDone()
    })

  return (
    <div className="screen" ref={screen}>
      <div className="row between" style={{ marginBottom: 34 }}>
        <span className="display" style={{ fontSize: 42, letterSpacing: '-0.01em' }}>Dial in</span>
        <span className="cap">{draft?.name ?? 'workflow'}{dirty ? ' · unsaved' : ''}</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="row" style={{ gap: 14 }}>
            <span className="cap">
              <EditableValue
                className="cap"
                label="Roaster"
                value={ctx.coffeeRoaster ?? ''}
                placeholder="No roaster"
                width={260}
                onCommit={(next) => patch({ coffeeRoaster: next })}
              />
            </span>
            {listing.status === 'available' && (
              <button
                className="beanpill"
                aria-label={`${listing.count} coffees from ${ctx.coffeeRoaster}`}
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
          </div>
        </div>

        <div className="display" style={{ fontSize: 44, lineHeight: 1.04, letterSpacing: '-0.02em' }}>
          <EditableValue
            className="clamp2 bare"
            label="Bean"
            value={ctx.coffeeName ?? ''}
            placeholder="No bean loaded"
            width={620}
            onCommit={(next) => patch({ coffeeName: next })}
          />
        </div>

        {listing.status === 'none' && (ctx.coffeeRoaster ?? '').length > 2 && (
          <div style={{ marginTop: 12 }}>
            <RoasterSite roaster={ctx.coffeeRoaster ?? ''} onResolved={listing.recheck} />
          </div>
        )}
      </div>

      <div className="grow" style={{ overflowY: 'auto' }}>
        <Field
          label="Dose"
          value={dose.toFixed(1)}
          suffix="g"
          numeric
          onCommit={(next) => patch({ targetDoseWeight: num(next, dose) })}
        >
          <Stepper
            onLess={() => patch({ targetDoseWeight: Math.max(1, +(dose - 0.1).toFixed(1) ) })}
            onMore={() => patch({ targetDoseWeight: +(dose + 0.1).toFixed(1) })}
          />
        </Field>
        <Field
          label={`Target yield · ratio 1:${(target / (dose || 1)).toFixed(1)}`}
          value={target.toFixed(1)}
          suffix="g"
          numeric
          color="var(--weight)"
          onCommit={(next) => patch({ targetYield: num(next, target) })}
        >
          <Stepper
            onLess={() => patch({ targetYield: Math.max(1, +(target - 0.5).toFixed(1)) })}
            onMore={() => patch({ targetYield: +(target + 0.5).toFixed(1) })}
          />
        </Field>
        <div
          className="row"
          style={{
            gap: 40,
            padding: '26px 0',
            borderTop: '1px solid var(--rule-soft)',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{ flex: '0 1 auto', minWidth: 0, paddingRight: 12 }}
          >
            <div className="row" style={{ gap: 40, marginBottom: 8 }}>
              <span className="cap" style={{ width: 96 }}>Grind</span>
              <span className="cap">Grinder</span>
            </div>
            <div className="row baseline" style={{ gap: 40 }}>
              <span style={{ width: 96, flex: '0 0 auto' }}>
                <EditableValue
                  className="num bare"
                  style={{ fontSize: 44 }}
                  label="Grind"
                  value={ctx.grinderSetting ?? ''}
                  placeholder="--"
                  numeric
                  width={90}
                  onCommit={(next) => patch({ grinderSetting: next })}
                />
              </span>
              <span style={{ minWidth: 0 }}>
                <EditableValue
                  className="display bare"
                  style={{ fontSize: 38 }}
                  label="Grinder"
                  value={ctx.grinderModel ?? ''}
                  placeholder="No grinder"
                  options={grinders.map((g) => g.model)}
                  width={360}
                  onCommit={(next) => void chooseGrinder(next)}
                />
              </span>
            </div>
          </div>
          <span style={{ marginLeft: 'auto' }}>
            <Stepper
              onLess={() => patch({ grinderSetting: shift(ctx.grinderSetting, -0.1) })}
              onMore={() => patch({ grinderSetting: shift(ctx.grinderSetting, 0.1) })}
            />
          </span>
        </div>
        <div style={{ padding: '26px 0', borderTop: '1px solid var(--rule-soft)' }}>
          <div className="row between" style={{ marginBottom: 16 }}>
            <ProfileDeck
              records={preferredRecords(records, preferred)}
              activeId={matchRecord(records, draft?.profile)?.id ?? null}
              grinds={grinds}
              onPick={pickProfile}
            />
          </div>

          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {records.map((record) => {
              const on = preferred.includes(record.id)
              return (
                <button
                  key={record.id}
                  className={`beanpill${on ? ' on' : ''}`}
                  style={{ height: 34, padding: '0 14px' }}
                  onClick={() => togglePreferred(record.id)}
                >
                  <span className="display" style={{ fontSize: 16 }}>
                    {record.profile?.title ?? 'Untitled'}
                  </span>
                </button>
              )
            })}
            {records.length === 0 && <span className="cap">No profiles found</span>}
          </div>
        </div>

      </div>

      <div className="rule" style={{ margin: '12px 0' }} />
      <div className="row between">
        <span className="cap" style={{ color: message ? 'var(--temp)' : undefined }}>
          {message ?? draft?.profile?.title ?? 'no profile'}
        </span>
        <div className="row" style={{ gap: 16 }}>
          <Button width={164} quiet onClick={onDone}>
            <span className="cap">Discard</span>
          </Button>
          <Button width={260} onClick={save} disabled={!dirty || busy}>
            <span className="display" style={{ fontSize: 23 }}>{busy ? 'Saving…' : 'Save workflow'}</span>
          </Button>
        </div>
      </div>

      {picking && ctx.coffeeRoaster && (
        <CoffeePicker
          roaster={ctx.coffeeRoaster}
          onClose={() => setPicking(false)}
          onPick={(name) => {
            setPicking(false)
            patch({ coffeeName: name })
          }}
        />
      )}
    </div>
  )
}

const shift = (value: string | undefined, delta: number) => {
  const n = Number.parseFloat(value ?? '')
  return (Number.isFinite(n) ? n + delta : delta).toFixed(1)
}

function Field({
  label, value, color, valueIsText, suffix, numeric, placeholder, options, bare, onCommit, children,
}: {
  label: string
  value: string
  color?: string
  valueIsText?: boolean
  suffix?: string
  numeric?: boolean
  placeholder?: string
  options?: string[]
  bare?: boolean
  onCommit?: (next: string) => void
  children?: React.ReactNode
}) {
  const size = valueIsText ? 38 : 50
  return (
    <div
      className="row between"
      style={
        bare
          ? { gap: 20 }
          : { padding: '26px 0', borderTop: '1px solid var(--rule-soft)' }
      }
    >
      <div>
        <div className="cap" style={{ marginBottom: 8 }}>{label}</div>
        {onCommit ? (
          <EditableValue
            className={valueIsText ? 'display clamp2' : 'num'}
            style={{ fontSize: size, color }}
            label={label}
            value={value}
            placeholder={placeholder}
            suffix={suffix}
            numeric={numeric}
            options={options}
            width={valueIsText ? 520 : 150}
            onCommit={onCommit}
          />
        ) : (
          <span className={valueIsText ? 'display' : 'num'} style={{ fontSize: size, color }}>
            {value}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
