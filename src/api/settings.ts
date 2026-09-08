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
  keepAwakeUntil?: string | null
}

export interface WakeSchedule {
  id: string
  enabled: boolean
  time: string
  daysOfWeek: number[]
  keepAwakeFor?: number
}

export interface ShotSettings {
  steamSetting: number
  targetSteamTemp: number
  targetSteamDuration: number
  targetHotWaterTemp: number
  targetHotWaterVolume: number
  targetHotWaterDuration: number
  targetShotVolume: number
  groupTemp: number
}

export interface CupWarmer {
  temperature: number
  enabled: boolean
  currentTemperature: number | null
}

export interface CupWarmerPreheat {
  enabled: boolean
  leadMinutes: number
  active: boolean
}

/** 12 hex characters, RRRRGGGGBBBB at 16 bits a channel */
export interface ZoneLed {
  sleeping: string
  awake: string
}

export interface LedStrip {
  frontStrip: ZoneLed
  backStrip: ZoneLed
  frontSwitch?: ZoneLed
}

export interface DeviceEntry {
  id: string
  name: string
  type: 'machine' | 'scale' | 'sensor'
  state: 'connected' | 'disconnected'
  available: boolean
}

export interface SkinEntry {
  id: string
  name: string
  version: string
  description?: string
  isBundled?: boolean
}

export interface PluginEntry {
  id: string
  name?: string
  version?: string
  enabled?: boolean
  loaded?: boolean
  autoLoad?: boolean
}

export interface AppUpdateState {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'error'
  currentVersion: string
  latestVersion?: string | null
  releaseUrl?: string
  installable?: boolean
}

export interface BuildInfo {
  version: string
  buildNumber?: string
  commitShort?: string
  localIp?: string
}

export interface MachineInfo {
  version?: string
  model?: string
  GHC?: boolean
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

  holdScreenAwake: () => call<DisplayState>('/display/wakelock', { method: 'POST' }),
  releaseScreen: () => call<DisplayState>('/display/wakelock', { method: 'DELETE' }),

  presence: () => call<PresenceSettings>('/presence/settings'),
  savePresence: (patch: Partial<PresenceSettings>) => post('/presence/settings', patch),

  setRefillLevel: (refillLevel: number) => post('/machine/waterLevels', { refillLevel }),

  saveShotSettings: (settings: ShotSettings) => post('/machine/shotSettings', settings),

  cupWarmer: () => call<CupWarmer>('/machine/cupWarmer'),
  saveCupWarmer: (patch: Partial<Pick<CupWarmer, 'temperature' | 'enabled'>>) =>
    call<void>('/machine/cupWarmer', { method: 'PUT', body: JSON.stringify(patch) }),

  preheat: () => call<CupWarmerPreheat>('/machine/cupWarmer/preheat'),
  savePreheat: (patch: Partial<Pick<CupWarmerPreheat, 'enabled' | 'leadMinutes'>>) =>
    call<void>('/machine/cupWarmer/preheat', { method: 'PUT', body: JSON.stringify(patch) }),

  ledStrip: () => call<LedStrip>('/machine/ledStrip'),
  saveLedStrip: (next: LedStrip) =>
    call<void>('/machine/ledStrip', { method: 'PUT', body: JSON.stringify(next) }),

  flowCalibration: () => call<{ flowMultiplier: number }>('/machine/calibration'),
  saveFlowCalibration: (flowMultiplier: number) => post('/machine/calibration', { flowMultiplier }),

  resetMachine: () => call<void>('/machine/settings/reset', { method: 'DELETE' }),

  schedules: () => call<WakeSchedule[]>('/presence/schedules'),
  saveSchedule: (schedule: WakeSchedule) =>
    call<void>(`/presence/schedules/${encodeURIComponent(schedule.id)}`, {
      method: 'PUT',
      body: JSON.stringify(schedule),
    }),

  devices: () => call<DeviceEntry[]>('/devices'),
  forgetDevice: (id: string) =>
    call<void>('/devices/forget', { method: 'PUT', body: JSON.stringify({ id }) }),

  skins: () => call<SkinEntry[]>('/webui/skins'),
  defaultSkin: () => call<SkinEntry>('/webui/skins/default'),
  setDefaultSkin: (skinId: string) =>
    call<void>('/webui/skins/default', { method: 'PUT', body: JSON.stringify({ skinId }) }),
  checkSkinUpdates: () => post('/webui/skins/update', {}),

  plugins: () => call<PluginEntry[]>('/plugins'),
  enablePlugin: (id: string, on: boolean) =>
    post(`/plugins/${encodeURIComponent(id)}/${on ? 'enable' : 'disable'}`, {}),
  checkPluginUpdates: () => post('/plugins/update', {}),

  update: () => call<AppUpdateState>('/update'),
  buildInfo: () => call<BuildInfo>('/info'),
  machineInfo: () => call<MachineInfo>('/machine/info'),
}

/** Color16 is RRRRGGGGBBBB; the browser wants #rrggbb */
export const asHex = (color: string | undefined) => {
  if (!color || color.length < 12) return '#000000'
  const channel = (i: number) => color.slice(i * 4, i * 4 + 2)
  return `#${channel(0)}${channel(1)}${channel(2)}`.toLowerCase()
}

export const fromHex = (hex: string) => {
  const clean = hex.replace('#', '')
  const channel = (i: number) => `${clean.slice(i * 2, i * 2 + 2)}00`.toUpperCase()
  return `${channel(0)}${channel(1)}${channel(2)}`
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
