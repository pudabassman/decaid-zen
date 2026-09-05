import { useState } from 'react'
import { catalog } from '../api/catalog'
import { Button } from './Button'
import { Dots } from './Dots'

interface Props {
  roaster: string
  onResolved: () => void
}

export function RoasterSite({ roaster, onResolved }: Props) {
  const [site, setSite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    const domain = site.trim()
    if (!domain) return
    setBusy(true)
    setError(null)
    catalog
      .resolve(roaster, domain)
      .then((result) => {
        setBusy(false)
        if (!result.available) {
          setError(result.error ?? 'No coffee list on that site')
          return
        }
        setSite('')
        onResolved()
      })
      .catch(() => {
        setBusy(false)
        setError('Could not reach that site')
      })
  }

  return (
    <div className="row" style={{ gap: 12 }}>
      <input
        className="search"
        style={{ width: 300 }}
        value={site}
        placeholder={`${roaster} website`}
        enterKeyHint="go"
        autoComplete="off"
        onChange={(e) => setSite(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
        }}
      />
      <Button width={150} quiet disabled={busy || !site.trim()} onClick={save}>
        <span className="cap">{busy ? <>Reading<Dots /></> : 'Use site'}</span>
      </Button>
      {error && <span className="cap" style={{ color: 'var(--temp)' }}>{error}</span>}
    </div>
  )
}
