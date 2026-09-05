import { api } from '../lib/gateway'
import type {
  MachineSnapshot, MachineStateName, ShotAnnotations, ShotRecord, ShotsPage, WaterLevels, Workflow,
} from './types'

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
  shots: (limit = 20, offset = 0) => request<ShotsPage>(`/shots?limit=${limit}&offset=${offset}`),
  latestShot: () => request<ShotRecord>('/shots/latest'),
  shot: (id: string) => request<ShotRecord>(`/shots/${encodeURIComponent(id)}`),
  annotateShot: (id: string, annotations: ShotAnnotations) =>
    request<ShotRecord>(`/shots/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ annotations }),
    }),
}
