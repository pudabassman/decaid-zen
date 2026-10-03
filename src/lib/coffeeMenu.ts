import { catalog } from '../api/catalog'
import { client } from '../api/client'
import { createCoffeeMenuCache } from './coffeeMenuCache'

export const coffeeMenu = createCoffeeMenuCache(async (roaster, refresh) => {
  let historyTimer: number | undefined
  // Rank once per load; slow or unavailable history must not block the catalog.
  const history = Promise.race([
    client.shots(100, 0).then(page => {
      const counts: Record<string, number> = {}
      for (const shot of page.items) {
        const name = shot.workflow?.context?.coffeeName?.trim().toLowerCase()
        if (name) counts[name] = (counts[name] ?? 0) + 1
      }
      return counts
    }).catch(() => ({} as Record<string, number>)),
    new Promise<Record<string, number>>(resolve => { historyTimer = window.setTimeout(() => resolve({}), 1000) }),
  ]).finally(() => clearTimeout(historyTimer))
  const [result, counts] = await Promise.all([catalog.coffees(roaster, refresh), history])
  if (!result.available) throw new Error(result.error || `Nothing listed for ${roaster}`)

  const coffees = [...(result.coffees ?? [])].sort((a, b) => {
    const used = (counts[b.name.trim().toLowerCase()] ?? 0) - (counts[a.name.trim().toLowerCase()] ?? 0)
    return used !== 0 ? used : a.name.localeCompare(b.name)
  })
  return { coffees, fetchedAt: result.fetchedAt ?? null }
})
