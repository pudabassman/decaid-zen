import { api } from '../lib/gateway'

const PLUGIN = 'coffee-catalog.reaplugin'

export interface CatalogCoffee {
  name: string
  title: string
  url: string
}

export interface CatalogResult {
  available: boolean
  searched?: boolean
  discovered?: boolean
  roaster?: string
  he?: string
  domain?: string
  count?: number
  cached?: boolean
  fetchedAt?: number
  coffees?: CatalogCoffee[]
  error?: string
}

async function call(query: string): Promise<CatalogResult> {
  const res = await fetch(api(`/plugins/${PLUGIN}/coffees?${query}`))
  if (!res.ok) return { available: false }
  return (await res.json()) as CatalogResult
}

export const catalog = {
  probe: (roaster: string) => call(`roaster=${encodeURIComponent(roaster)}&probe=1&discover=1`),
  coffees: (roaster: string, refresh = false) =>
    call(`roaster=${encodeURIComponent(roaster)}${refresh ? '&refresh=1' : ''}`),
  resolve: async (roaster: string, site: string): Promise<CatalogResult> => {
    const res = await fetch(
      api(`/plugins/${PLUGIN}/resolve?roaster=${encodeURIComponent(roaster)}&site=${encodeURIComponent(site)}`),
    )
    if (!res.ok) return { available: false }
    return (await res.json()) as CatalogResult
  },
}
