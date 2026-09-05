import { useCallback, useEffect, useState } from 'react'
import { catalog, type CatalogCoffee } from '../api/catalog'
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

export function CoffeePicker({ roaster, onPick, onClose }: Props) {
  const [coffees, setCoffees] = useState<CatalogCoffee[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    (refresh: boolean) => {
      setBusy(true)
      setError(null)
      return catalog
        .coffees(roaster, refresh)
        .then((result) => {
          setBusy(false)
          if (!result.available) setError(`Nothing listed for ${roaster}`)
          setCoffees(result.coffees ?? [])
          setFetchedAt(result.fetchedAt ?? null)
        })
        .catch(() => {
          setBusy(false)
          setError('Could not reach the roaster')
        })
    },
    [roaster],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  const needle = query.trim().toLowerCase()
  const shown = (coffees ?? []).filter((coffee) => !needle || coffee.name.toLowerCase().includes(needle))

  return (
    <>
      <div className="drawerveil" onPointerDown={onClose} />
      <aside className="drawer" style={{ width: 560 }}>
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
          <Button width={130} quiet disabled={busy} onClick={() => void load(true)}>
            <span className="cap">{busy ? <>Reading<Dots /></> : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      <input
        className="search"
        value={query}
        placeholder="Search coffees"
        enterKeyHint="search"
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      <div style={{ flex: '1 1 auto', overflowY: 'auto', maxHeight: 620 }}>
        {error && <div className="cap">{error}</div>}
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

      <div className="row between" style={{ paddingTop: 18 }}>
        <span className="cap">Tap a coffee to load it</span>
        <Button width={150} quiet onClick={onClose}>
          <span className="cap">Close</span>
        </Button>
      </div>
      </aside>
    </>
  )
}
