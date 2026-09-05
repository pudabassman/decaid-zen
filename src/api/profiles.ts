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
const PREFERRED_KEY = 'preferredProfiles'
export const MAX_PREFERRED = 5

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = init?.body ? { 'content-type': 'application/json', ...init?.headers } : init?.headers
  const res = await fetch(api(path), { ...init, headers })
  if (!res.ok) throw new Error(`${res.status}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export function profileKey(profile: Profile | undefined) {
  const steps = profile?.steps ?? []
  if (!steps.length) return profile?.title ?? ''
  const shape = steps
    .map((step) => `${step.pump ?? '?'}:${step.pressure ?? 0}:${step.flow ?? 0}:${step.seconds ?? 0}`)
    .join('|')
  return `${profile?.title ?? ''}::${shape}`
}

export function matchRecord(records: ProfileRecord[], profile: Profile | undefined) {
  if (!profile) return null
  const key = profileKey(profile)
  const exact = records.find((r) => profileKey(r.profile) === key)
  if (exact) return exact
  const shape = key.split('::')[1]
  const sameShape = records.find((r) => profileKey(r.profile).split('::')[1] === shape)
  if (sameShape) return sameShape
  return records.find((r) => r.profile?.title === profile.title) ?? null
}

export const profiles = {
  list: () => json<ProfileRecord[]>('/profiles?visibility=visible'),
  grindMemory: () =>
    json<Record<string, string> | null>(`/store/${STORE}/${GRIND_KEY}`).catch(() => null),
  saveGrindMemory: (map: Record<string, string>) =>
    json<void>(`/store/${STORE}/${GRIND_KEY}`, { method: 'POST', body: JSON.stringify(map) }),
  preferred: () => json<string[] | null>(`/store/${STORE}/${PREFERRED_KEY}`).catch(() => null),
  savePreferred: (ids: string[]) =>
    json<void>(`/store/${STORE}/${PREFERRED_KEY}`, {
      method: 'POST',
      body: JSON.stringify(ids.slice(0, MAX_PREFERRED)),
    }),
}

/** the deck shows the chosen few; with none chosen it falls back to the first five */
export function preferredRecords(records: ProfileRecord[], ids: string[] | null) {
  if (!ids?.length) return records.slice(0, MAX_PREFERRED)
  const chosen = ids.map((id) => records.find((r) => r.id === id)).filter(Boolean) as ProfileRecord[]
  return chosen.length ? chosen.slice(0, MAX_PREFERRED) : records.slice(0, MAX_PREFERRED)
}
