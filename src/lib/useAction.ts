import { useCallback, useRef, useState } from 'react'
import { ApiError } from '../api/client'

const describe = (label: string, error: unknown) => {
  if (error instanceof ApiError) {
    if (error.body.includes('block_no_scale')) return 'No scale connected — espresso is blocked in settings'
    if (error.body.includes('block_tare_during_shot')) return 'Tare is blocked while a shot is running'
    try {
      const parsed = JSON.parse(error.body) as { details?: string; type?: string }
      if (parsed.details) return parsed.details
    } catch {
      /* fall through to the generic message */
    }
    return `${label} failed (${error.status})`
  }
  return `${label} failed — no response from the machine`
}

export function useAction() {
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const run = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    window.clearTimeout(timer.current)
    setBusy(true)
    try {
      await fn()
      setMessage(null)
    } catch (error) {
      setMessage(describe(label, error))
      timer.current = window.setTimeout(() => setMessage(null), 6000)
    } finally {
      setBusy(false)
    }
  }, [])

  return { run, message, busy }
}
