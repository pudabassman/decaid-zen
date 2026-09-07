import { api } from '../lib/gateway'
import { settingsApi, type PluginEntry } from './settings'

export interface BundledPlugin {
  id: string
  version: string
  name: string
  manifest: Record<string, unknown>
  source: string
}

let cached: Promise<BundledPlugin | null> | undefined

const asset = (file: string) => new URL(`plugin/${file}`, document.baseURI).href

async function read(): Promise<BundledPlugin | null> {
  const [manifestRes, sourceRes] = await Promise.all([fetch(asset('manifest.json')), fetch(asset('plugin.js'))])
  if (!manifestRes.ok || !sourceRes.ok) return null
  const manifest = (await manifestRes.json()) as Record<string, unknown>
  const id = manifest.id as string | undefined
  const version = manifest.version as string | undefined
  if (!id || !version) return null
  return { id, version, name: (manifest.name as string) ?? id, manifest, source: await sourceRes.text() }
}

export function bundledPlugin() {
  cached ??= read().catch(() => null)
  return cached
}

/** true when a is a higher version than b, comparing dot-separated numbers */
export function newerThan(a: string, b: string) {
  const parts = (v: string) => v.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  const left = parts(a)
  const right = parts(b)
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

export async function installBundledPlugin(bundled: BundledPlugin) {
  const res = await fetch(api(`/plugins/${encodeURIComponent(bundled.id)}/source`), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ manifest: bundled.manifest, plugin: bundled.source }),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  await settingsApi.enablePlugin(bundled.id, true).catch(() => undefined)
}

/** installs the bundled plugin only when the machine has no copy at all */
export async function ensureBundledPlugin() {
  const bundled = await bundledPlugin()
  if (!bundled) return
  const installed: PluginEntry[] = await settingsApi.plugins().catch(() => [])
  if (installed.some((plugin) => plugin.id === bundled.id)) return
  await installBundledPlugin(bundled).catch(() => undefined)
}
