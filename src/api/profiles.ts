import { api } from '../lib/gateway'
import type { Profile } from './types'

export interface ProfileRecord {
  id: string
  profile: Profile
  isDefault?: boolean
  visibility?: string
}

const STORE = 'decaid-zen'
const GRIND_KEY = 'grindByProfile'

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = init?.body ? { 'content-type': 'application/json', ...init?.headers } : init?.headers
  const res = await fetch(api(path), { ...init, headers })
  if (!res.ok) throw new Error(`${res.status}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const profiles = {
  list: () => json<ProfileRecord[]>('/profiles?visibility=visible'),
  grindMemory: () =>
    json<Record<string, string> | null>(`/store/${STORE}/${GRIND_KEY}`).catch(() => null),
  saveGrindMemory: (map: Record<string, string>) =>
    json<void>(`/store/${STORE}/${GRIND_KEY}`, { method: 'POST', body: JSON.stringify(map) }),
}
