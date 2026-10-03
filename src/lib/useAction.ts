import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'

const describe = (label: string, error: unknown) => {
  if (error instanceof ApiError) {
    if (error.body.includes('block_no_scale')) return 'No scale connected — espresso is blocked in settings'
    if (error.body.includes('block_tare_during_shot')) return 'Tare is blocked while a shot is running'
    try {
      const parsed = JSON.parse(error.body) as { details?: string }
      if (parsed.details) return parsed.details
    } catch { /* use the action label below */ }
    return `${label} failed (${error.status}). Please try again.`
  }
  return error instanceof Error && error.message.startsWith('Saved workflow')
    ? error.message : `${label} failed. Check the connection and try again.`
}

export function useAction() {
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const lock = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const run = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setMessage(null)
    setStatus(`${label}…`)
    try {
      await fn()
      if (mounted.current) setStatus(`${label} · done`)
    } catch (error) {
      if (mounted.current) { setMessage(describe(label, error)); setStatus('') }
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }, [])
  return { run, message, busy, status }
}
