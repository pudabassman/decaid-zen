import { useState } from 'react'
import { useSocket } from '../api/useSocket'
import { settingsApi, type ShotSettings } from '../api/settings'
import { MOCK, mockShotSettings } from './mock'

export function useShotSettings() {
  const [settings, setSettings] = useState<ShotSettings | null>(MOCK ? mockShotSettings() : null)

  useSocket<ShotSettings>(MOCK ? '' : '/machine/shotSettings', (frame) => {
    if (frame && typeof frame.targetSteamTemp === 'number') setSettings(frame)
  })

  const patch = (next: Partial<ShotSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...next } : prev))
    return settingsApi.saveShotSettings(next)
  }

  return { settings, patch }
}
