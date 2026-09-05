import { useEffect, useState } from 'react'
import { catalog } from '../api/catalog'

type Status = 'idle' | 'checking' | 'available' | 'none'

export function useRoasterCatalog(roaster: string | undefined, delay = 700) {
  const [status, setStatus] = useState<Status>('idle')
  const [count, setCount] = useState(0)
  const [nonce, setNonce] = useState(0)
  const recheck = () => setNonce((n) => n + 1)

  useEffect(() => {
    const name = (roaster ?? '').trim()
    if (name.length < 2) {
      setStatus('idle')
      setCount(0)
      return
    }

    let cancelled = false
    setStatus('checking')
    const timer = window.setTimeout(() => {
      catalog
        .probe(name)
        .then((result) => {
          if (cancelled) return
          setCount(result.count ?? 0)
          setStatus(result.available ? 'available' : 'none')
        })
        .catch(() => {
          if (!cancelled) setStatus('none')
        })
    }, delay)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [roaster, delay, nonce])

  return { status, count, recheck }
}
