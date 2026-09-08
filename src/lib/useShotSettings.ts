import { useState } from 'react'
import { useSocket } from '../api/useSocket'
import { settingsApi, type ShotSettings } from '../api/settings'
import { MOCK, mockShotSettings } from './mock'

export function useShotSettings() {
  const [settings, setSettings] = useState<ShotSettings | null>(MOCK ? mockShotSettings() : null)

  useSocket<ShotSettings>(MOCK ? '' : '/machine/shotSettings', (frame) => {
    if (frame && typeof frame.targetSteamTemp === 'number') setSettings(frame)
  })

  // the machine parses the whole object, so a partial patch would fail on the missing keys
  const patch = (next: Partial<ShotSettings>) => {
    if (!settings) return Promise.resolve()
    const merged = { ...settings, ...next }
    setSettings(merged)
    return settingsApi.saveShotSettings(merged)
  }

  return { settings, patch }
}
