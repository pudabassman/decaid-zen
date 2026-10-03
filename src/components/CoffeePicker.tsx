import { useCallback, useEffect, useRef, useState } from 'react'
import { coffeeMenu } from '../lib/coffeeMenu'
import { Overlay } from './Overlay'
import { Button } from './Button'
import { Dots } from './Dots'

interface Props {
  roaster: string
  onPick: (name: string) => void
  onClose: () => void
}

const age = (fetchedAt: number | null) => {
  if (!fetchedAt) return ''
  const minutes = Math.round((Date.now() - fetchedAt) / 60000)
  if (minutes < 1) return ' · just now'
  if (minutes < 60) return ` · ${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return ` · ${hours}h ago`
}

export function CoffeePicker(props: Props) {
  return <CoffeePickerContent key={props.roaster.trim().toLowerCase()} {...props} />
}

function CoffeePickerContent({ roaster, onPick, onClose }: Props) {
  const [snapshot, setSnapshot] = useState(() => coffeeMenu.peek(roaster))
  const coffees = snapshot?.coffees
  const fetchedAt = snapshot?.fetchedAt ?? null
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(() => !snapshot)
  const [entered, setEntered] = useState(false)
  const request = useRef(0)
  const load = useCallback(async (refresh: boolean) => {
    const id = ++request.current
    const cached = coffeeMenu.peek(roaster)
    if (!refresh && cached) {
      setSnapshot(cached)
      setBusy(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const next = await coffeeMenu.load(roaster, refresh)
      if (id === request.current) setSnapshot(next)
    } catch (error) {
      if (id === request.current) setError(error instanceof Error ? error.message : 'Could not reach the roaster')
    } finally {
      if (id === request.current) setBusy(false)
    }
  }, [roaster])

  useEffect(() => () => { request.current++ }, [])
  useEffect(() => {
    if (entered) void load(false)
  }, [entered, load])

  const needle = query.trim().toLowerCase()
  const shown = (coffees ?? []).filter(coffee => !needle || coffee.name.toLowerCase().includes(needle))

  return (
    <Overlay title={roaster} onClose={onClose} onEntered={() => setEntered(true)} footer={<div className="row between"><span className="hint">Tap a coffee to load it</span><Button width={130} height={44} quiet onClick={onClose}>Close</Button></div>}>
      <div className="row between" style={{ paddingBottom: 16 }}>
        <span className="cap strong">{roaster}</span>
        <div className="row" style={{ gap: 14 }}>
          <span className="cap">
            {busy ? (
              <>reading<Dots /></>
            ) : coffees ? (
              `${shown.length}${needle ? ` of ${coffees.length}` : ''} coffees${age(fetchedAt)}`
            ) : (
              <>loading<Dots /></>
            )}
          </span>
          <Button width={130} quiet disabled={busy || !entered} onClick={() => void load(true)}>
            <span className="cap">{busy ? <>Reading<Dots /></> : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      <input
        className="search"
        aria-label="Search coffees"
        value={query}
        placeholder="Search coffees"
        enterKeyHint="search"
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      <div className="coffee-list" aria-busy={busy}>
        {!coffees && busy && <div className="coffee-skeleton" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <div key={index}><span style={{ width: `${[78, 62, 86, 70, 56, 74][index]}%` }} /></div>)}
        </div>}
        {error && <div className="cap" role="alert">{error}{coffees ? ' · Showing the saved list' : ''}</div>}
        {shown.map((coffee) => (
          <button
            key={coffee.url}
            onClick={() => onPick(coffee.name)}
            style={{
              width: '100%',
              textAlign: 'start',
              padding: '16px 0',
              background: 'transparent',
              border: 0,
              borderTop: '1px solid var(--rule-soft)',
              color: 'inherit',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            <span className="display clamp2" style={{ fontSize: 24 }}>{coffee.name}</span>
          </button>
        ))}
        {coffees && shown.length === 0 && !error && (
          <div className="cap">{needle ? `Nothing matches "${query}"` : 'No coffees listed'}</div>
        )}
      </div>

    </Overlay>
  )
}
