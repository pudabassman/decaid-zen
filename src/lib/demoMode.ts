import { useCallback, useEffect, useState } from 'react'
import { api } from './gateway'

const KEY = 'demoMode'

async function read(): Promise<boolean> {
  const res = await fetch(api(`/store/decaid-zen/${KEY}`))
  if (!res.ok) return false
  const text = await res.text()
  if (!text) return false
  const value = JSON.parse(text) as { on?: boolean } | boolean
  return typeof value === 'boolean' ? value : value.on === true
}

async function write(on: boolean): Promise<void> {
  await fetch(api(`/store/decaid-zen/${KEY}`), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ on }),
  })
}

export function useDemoMode() {
  const [on, setOn] = useState(false)

  useEffect(() => {
    read().then(setOn).catch(() => setOn(false))
  }, [])

  const set = useCallback((next: boolean) => {
    setOn(next)
    write(next).catch(() => undefined)
  }, [])

  return { on, set }
}
