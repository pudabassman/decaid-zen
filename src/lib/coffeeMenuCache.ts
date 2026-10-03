import type { CatalogCoffee } from '../api/catalog'

export interface CoffeeMenuSnapshot {
  coffees: readonly CatalogCoffee[]
  fetchedAt: number | null
}

/** Session cache: menu mounts reuse both the data and its established ordering. */
export function createCoffeeMenuCache(fetchSnapshot: (roaster: string, refresh: boolean) => Promise<CoffeeMenuSnapshot>) {
  const snapshots = new Map<string, CoffeeMenuSnapshot>()
  const pending = new Map<string, Promise<CoffeeMenuSnapshot>>()
  const keyFor = (roaster: string) => roaster.trim().toLowerCase()

  return {
    peek(roaster: string) {
      return snapshots.get(keyFor(roaster))
    },
    load(roaster: string, refresh = false): Promise<CoffeeMenuSnapshot> {
      const key = keyFor(roaster)
      const cached = snapshots.get(key)
      if (!refresh && cached) return Promise.resolve(cached)
      const inFlight = pending.get(key)
      if (inFlight) return inFlight

      // The request belongs to the cache, so closing the menu does not discard it.
      const request = Promise.resolve()
        .then(() => fetchSnapshot(roaster.trim(), refresh))
        .then(snapshot => {
          snapshots.set(key, snapshot)
          return snapshot
        })
        .finally(() => pending.delete(key))
      pending.set(key, request)
      return request
    },
  }
}
