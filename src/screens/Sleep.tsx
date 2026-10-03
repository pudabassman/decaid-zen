import { useEffect, useRef, useState } from 'react'
import { client } from '../api/client'
import { settingsApi, type DisplayState } from '../api/settings'
import { MOCK } from '../lib/mock'

const SLEEP_BRIGHTNESS = 8

const clock = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

const today = () =>
  new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })

export function Sleep({ onWake }: { onWake: () => void }) {
  const [now, setNow] = useState(clock)
  const [date, setDate] = useState(today)
  const restore = useRef<DisplayState | null>(null)
  const [waking, setWaking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const tick = window.setInterval(() => {
      setNow(clock())
      setDate(today())
    }, 15_000)
    return () => window.clearInterval(tick)
  }, [])

  useEffect(() => {
    if (MOCK) return
    let cancelled = false

    settingsApi
      .display()
      .then((state) => {
        if (cancelled) return
        // a reload while asleep reads the dimmed value; never restore to that
        restore.current = { ...state, brightness: state.brightness > SLEEP_BRIGHTNESS ? state.brightness : 100 }
        return settingsApi.setBrightness(SLEEP_BRIGHTNESS)
      })
      .then(() => (restore.current?.wakeLockEnabled ? settingsApi.releaseScreen() : undefined))
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  const wake = async () => {
    if (waking) return
    setWaking(true); setError('')
    try {
      await client.requestState('idle')
      if (!MOCK) {
        const previous = restore.current
        await settingsApi.setBrightness(previous?.brightness ?? 100)
        if (previous?.wakeLockEnabled) await settingsApi.holdScreenAwake()
      }
      onWake()
    } catch { setError('Couldn’t wake the machine. Tap to retry.') }
    finally { setWaking(false) }
  }

  return (
    <button type="button" className="sleepscreen" onClick={() => void wake()} disabled={waking} aria-label="Tap to wake">
      <div className="sleepdrift">
        <div className="num sleepclock">{now}</div>
        <div className="cap sleepdate">{date}</div>
        <div className="sleep-hint" role="status">{error || (waking ? 'Waking your machine…' : 'Tap anywhere to wake')}</div>
      </div>
    </button>
  )
}
