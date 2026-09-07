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
  const waking = useRef(false)

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

  const wake = () => {
    if (waking.current) return
    waking.current = true
    onWake()
    client.requestState('idle').catch(() => undefined)
    if (MOCK) return
    const previous = restore.current
    settingsApi
      .setBrightness(previous?.brightness ?? 100)
      .then(() => (previous?.wakeLockEnabled ? settingsApi.holdScreenAwake() : undefined))
      .catch(() => undefined)
  }

  return (
    <div className="sleepscreen" onPointerDown={wake} role="button" tabIndex={0} aria-label="Tap to wake">
      <div className="sleepdrift">
        <div className="num sleepclock">{now}</div>
        <div className="cap sleepdate">{date}</div>
      </div>
    </div>
  )
}
