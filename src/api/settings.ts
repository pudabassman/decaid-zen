import { api } from '../lib/gateway'

export interface AppSettings {
  gatewayMode: 'full' | 'tracking' | 'disabled'
  themeMode: string
  logLevel: string
  weightFlowMultiplier: number
  volumeFlowMultiplier: number
  hotWaterFlowMultiplier: number
  scalePowerMode: 'disabled' | 'displayOff' | 'disconnect'
  blockOnNoScale: boolean
  blockTareDuringShot: boolean
  stopHotWaterAtWeight: boolean
  preferredMachineId: string | null
  preferredScaleId: string | null
  defaultSkinId: string | null
  automaticUpdateCheck: boolean
  chargingMode: 'disabled' | 'longevity' | 'balanced' | 'highAvailability'
  nightModeEnabled: boolean
  nightModeSleepTime: number
  nightModeMorningTime: number
  lowBatteryBrightnessLimit: boolean
  keepAwake: boolean
}

export interface MachineSettings {
  fan: number
  usb: boolean
  flushTemp: number
  flushTimeout: number
  flushFlow: number
  hotWaterFlow: number
  steamFlow: number
  tankTemp: number
  steamPurgeMode: number
}

export interface AdvancedSettings {
  heaterPh1Flow: number
  heaterPh2Flow: number
  heaterIdleTemp: number
  heaterPh2Timeout: number
  heaterVoltage: number
  refillKitSetting: number
}

export interface DisplayState {
  brightness: number
  wakeLockEnabled: boolean
  lowBatteryBrightnessActive: boolean
}

export interface PresenceSettings {
  userPresenceEnabled: boolean
  sleepTimeoutMinutes: number
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = init?.body ? { 'content-type': 'application/json', ...init?.headers } : init?.headers
  const res = await fetch(api(path), { ...init, headers })
  if (!res.ok) throw new Error(`${res.status}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const post = (path: string, body: unknown) =>
  call<void>(path, { method: 'POST', body: JSON.stringify(body) })

export const settingsApi = {
  app: () => call<AppSettings>('/settings'),
  saveApp: (patch: Partial<AppSettings>) => post('/settings', patch),

  machine: () => call<MachineSettings>('/machine/settings'),
  saveMachine: (patch: Partial<MachineSettings>) => post('/machine/settings', patch),

  advanced: () => call<AdvancedSettings>('/machine/settings/advanced'),
  saveAdvanced: (patch: Partial<AdvancedSettings>) => post('/machine/settings/advanced', patch),

  display: () => call<DisplayState>('/display'),
  setBrightness: (brightness: number) =>
    call<void>('/display/brightness', { method: 'PUT', body: JSON.stringify({ brightness }) }),

  presence: () => call<PresenceSettings>('/presence/settings'),
  savePresence: (patch: Partial<PresenceSettings>) => post('/presence/settings', patch),

  setRefillLevel: (refillLevel: number) => post('/machine/waterLevels', { refillLevel }),
}

/** minutes past midnight, as the app stores night mode */
export const asClock = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24
  const m = Math.round(minutes % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const fromClock = (value: string, fallback: number) => {
  const match = value.trim().match(/^(\d{1,2})[:.]?(\d{2})?$/)
  if (!match) return fallback
  const h = Number(match[1])
  const m = Number(match[2] ?? 0)
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return fallback
  return h * 60 + m
}
