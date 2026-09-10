import { api } from '../lib/gateway'
import type {
  Grinder, MachineSnapshot, MachineStateName, ShotAnnotations, ShotRecord, ShotsPage, WaterLevels, Workflow,
} from './types'

export interface ShotFilter {
  coffeeName?: string
  coffeeRoaster?: string
  profileTitle?: string
  beanId?: string
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`${status}: ${body.slice(0, 200)}`)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = init?.body ? { 'content-type': 'application/json', ...init?.headers } : init?.headers
  const res = await fetch(api(path), { ...init, headers })
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''))
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const client = {
  machineState: () => request<MachineSnapshot>('/machine/state'),
  requestState: (next: MachineStateName) => request<void>(`/machine/state/${next}`, { method: 'PUT' }),
  waterLevels: () => request<WaterLevels>('/machine/waterLevels'),
  workflow: () => request<Workflow>('/workflow'),
  saveWorkflow: (body: Workflow) => request<Workflow>('/workflow', { method: 'PUT', body: JSON.stringify(body) }),
  tare: () => request<void>('/scale/tare', { method: 'PUT' }),
  /**
   * Scans and fills the empty machine / scale slots without touching what is
   * connected. `quick` returns at once and leaves the scan running, so the UI
   * does not sit on a 15 second BLE window.
   */
  findDevices: (quick = true) =>
    request<unknown[]>(`/devices/scan?connect=true${quick ? '&quick=true' : ''}`),
  connectDevice: (deviceId: string) =>
    request<void>('/devices/connect', { method: 'PUT', body: JSON.stringify({ deviceId }) }),
  grinders: () => request<Grinder[]>('/grinders'),
  createGrinder: (model: string) =>
    request<Grinder>('/grinders', { method: 'POST', body: JSON.stringify({ model }) }),
  shots: (limit = 20, offset = 0, filter?: ShotFilter) => {
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    for (const [key, value] of Object.entries(filter ?? {})) {
      if (value) query.set(key, value)
    }
    return request<ShotsPage>(`/shots?${query}`)
  },
  latestShot: () => request<ShotRecord>('/shots/latest'),
  shot: (id: string) => request<ShotRecord>(`/shots/${encodeURIComponent(id)}`),
  annotateShot: (id: string, annotations: ShotAnnotations) =>
    request<ShotRecord>(`/shots/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ annotations }),
    }),
}
